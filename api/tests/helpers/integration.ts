import { Server } from 'http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CountryTeam } from '../../src/models/CountryTeam';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-with-enough-length';
process.env.MASTER_USER_EMAIL = 'master@wc2026.test';
process.env.SYNC_API_KEY = 'test-sync-key';
process.env.VAPID_PUBLIC_KEY = 'test-public-key';
process.env.VAPID_PRIVATE_KEY = '';
process.env.FOOTBALL_DATA_API_KEY = '';

let mongo: MongoMemoryServer | null = null;
let server: Server | null = null;
let baseUrl = '';

export async function startIntegrationServer(): Promise<string> {
  if (!mongo) {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  }

  if (!server) {
    const { app } = await import('../../src/app');
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, () => resolve(listener));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Unable to determine test server address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  return baseUrl;
}

export async function stopIntegrationServer(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
    server = null;
    baseUrl = '';
  }

  await mongoose.disconnect();

  if (mongo) {
    await mongo.stop();
    mongo = null;
  }
}

export async function clearDatabase(): Promise<void> {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
}

export async function seedTestCountryTeams(): Promise<void> {
  await CountryTeam.insertMany([
    { code: 'ARG', names: { en: 'Argentina', es: 'Argentina' }, crest: '' },
    { code: 'BRA', names: { en: 'Brazil', es: 'Brasil' }, crest: '' },
    { code: 'ESP', names: { en: 'Spain', es: 'Espa\u00f1a' }, crest: '' },
    { code: 'FRA', names: { en: 'France', es: 'Francia' }, crest: '' },
  ]);
}

export async function requestJson<T = any>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; body: T; headers: Headers }> {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}
