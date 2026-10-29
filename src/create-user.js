import argon2 from 'argon2';
import { loadConfig } from './config.js';
import { connectMongo } from './infrastructure/mongo.js';

const username = process.env.RMA_USERNAME;
const password = process.env.RMA_USER_PASSWORD;
const roles = (process.env.RMA_USER_ROLES || '').split(',').filter(Boolean);
const allowed = ['MAKER', 'CHECKER', 'ADMIN', 'AUDITOR', 'CONSUMER'];
if (!username || !password || password.length < 12 || !roles.length || roles.some(role => !allowed.includes(role))) throw new Error('Set RMA_USERNAME, RMA_USER_PASSWORD (at least 12 characters), and RMA_USER_ROLES');
const config = loadConfig();
const store = await connectMongo(config.mongoUri, config.mongoDatabase);
try {
  await store.repo('users').insert({ username, passwordHash: await argon2.hash(password), roles });
  console.log('User created');
} finally { await store.client.close(); }