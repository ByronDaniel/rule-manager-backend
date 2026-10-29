import { MongoClient } from 'mongodb';

export class MongoRepository {
  constructor(database, name, session) {
    this.collection = database.collection(name);
    this.session = session;
  }

  async findOne(filter) {
    return this.collection.findOne(filter, { session: this.session, projection: { _id: 0 } });
  }

  async find(filter = {}, options = {}) {
    let cursor = this.collection.find(filter, { session: this.session, projection: { _id: 0 } });
    if (options.sort) cursor = cursor.sort(options.sort);
    if (options.skip) cursor = cursor.skip(options.skip);
    if (options.limit) cursor = cursor.limit(options.limit);
    return cursor.toArray();
  }

  async count(filter = {}) {
    return this.collection.countDocuments(filter, { session: this.session });
  }

  async insert(document) {
    await this.collection.insertOne({ ...document }, { session: this.session });
    return document;
  }

  async update(filter, update) {
    return this.collection.updateOne(filter, update, { session: this.session });
  }

  async replace(filter, document) {
    return this.collection.replaceOne(filter, document, { session: this.session });
  }
}

export class MongoStore {
  constructor(client, database) {
    this.client = client;
    this.database = database;
  }

  repo(name, session) {
    return new MongoRepository(this.database, name, session);
  }

  async transaction(work) {
    const session = this.client.startSession();
    try {
      let result;
      await session.withTransaction(async () => { result = await work(session); });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async indexes() {
    await Promise.all([
      this.database.collection('parameters').createIndex({ id: 1 }, { unique: true }),
      this.database.collection('parameters').createIndex({ code: 1 }, { unique: true }),
      this.database.collection('versions').createIndex({ parameterId: 1, versionNumber: 1 }, { unique: true }),
      this.database.collection('requests').createIndex({ id: 1 }, { unique: true }),
      this.database.collection('requests').createIndex({ status: 1, createdAt: -1 }),
      this.database.collection('decisions').createIndex({ changeRequestId: 1 }, { unique: true }),
      this.database.collection('audit').createIndex({ id: 1 }, { unique: true }),
      this.database.collection('audit').createIndex({ parameterId: 1, occurredAt: -1 }),
      this.database.collection('users').createIndex({ username: 1 }, { unique: true }),
      this.database.collection('idempotency').createIndex({ actor: 1, key: 1 }, { unique: true }),
      this.database.collection('idempotency').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    ]);
  }
}

export async function connectMongo(uri, databaseName) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const store = new MongoStore(client, client.db(databaseName));
  await store.indexes();
  return store;
}