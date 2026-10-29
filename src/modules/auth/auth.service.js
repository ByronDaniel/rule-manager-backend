import argon2 from 'argon2';
import { fail } from '../../shared/errors.js';
import { signToken } from './tokens.js';

export class AuthService {
  constructor(store, config) {
    this.store = store;
    this.config = config;
    // Verified against for unknown users, so a missing account takes as long as a wrong password.
    this.dummyHash = argon2.hash('placeholder-for-unknown-user');
  }

  async issueToken(username, password) {
    const user = await this.store.repo('users').findOne({ username });
    const valid = await argon2.verify(user?.passwordHash ?? await this.dummyHash, password);
    if (!user || !valid) fail(401, 'UNAUTHORIZED', 'Credenciales inválidas.');
    return { accessToken: signToken(user, this.config), tokenType: 'Bearer', expiresIn: this.config.jwtExpiresIn, roles: user.roles };
  }
}
