import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

let connectionPromise: Promise<void> | null = null;
let activeUri = '';

async function _connect(uriOverride?: string): Promise<void> {
  let uri = uriOverride || env.MONGODB_URI;
  let source = 'configured MongoDB';

  if (!uri) {
    if (!env.USE_IN_MEMORY_DB) {
      throw new Error('MONGODB_URI is required. Set it in api/.env or enable USE_IN_MEMORY_DB=true for disposable local development.');
    }

    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
    source = 'in-memory MongoDB';
  }

  await mongoose.connect(uri);
  activeUri = uri;
  logger.info(`Connected to ${source} (${mongoose.connection.name})`);
}

export async function connectDB(uriOverride?: string): Promise<void> {
  const requestedUri = uriOverride || env.MONGODB_URI;

  if (mongoose.connection.readyState === 1 && (!requestedUri || requestedUri === activeUri)) return;

  if (mongoose.connection.readyState === 1 && requestedUri && requestedUri !== activeUri) {
    await mongoose.disconnect();
    connectionPromise = null;
    activeUri = '';
  }

  if (!connectionPromise) {
    connectionPromise = _connect(uriOverride).catch((error) => {
      connectionPromise = null;
      logger.error({ err: error }, 'MongoDB connection error');
      throw error;
    });
  }

  await connectionPromise;
}
