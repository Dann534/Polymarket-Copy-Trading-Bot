/**
 * MongoDB connection and management
 */

import mongoose from 'mongoose';
import { logger } from '../utils/logger';

let isConnected = false;

export async function connectDatabase(mongoUri?: string): Promise<void> {
  if (!mongoUri) {
    logger.warn('MongoDB URI not provided, running without database persistence');
    return;
  }

  if (isConnected) {
    logger.debug('Database already connected');
    return;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    logger.info('MongoDB connected successfully');

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error', { error: error.message });
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = true;
    });
  } catch (error: any) {
    logger.error('Failed to connect to MongoDB', { error: error.message });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB disconnected');
  } catch (error: any) {
    logger.error('Error disconnecting from MongoDB', { error: error.message });
  }
}

export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
