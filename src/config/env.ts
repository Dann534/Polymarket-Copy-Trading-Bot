/**
 * Environment configuration loader and validator
 */

import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

export interface EnvConfig {
  // Wallet
  privateKey: string;
  walletAddress?: string;

  // Traders
  targetAddresses: string[];

  // Trading
  copyTradingEnabled: boolean;
  dryRun: boolean;
  positionSizeMultiplier: number;
  maxPositionSize: number;
  maxTradeSize: number;
  minTradeSize: number;
  slippageTolerance: number;

  // Monitoring
  pollInterval: number;
  enableWebSocket: boolean;

  // Database
  mongoUri?: string;

  // Network
  rpcUrl?: string;
  chainId: number;
  clobHost: string;

  // API
  polymarketApiKey?: string;

  // Health
  healthMonitoringEnabled: boolean;
  healthPort: number;

  // Logging
  logLevel: string;
  debug: boolean;

  // Advanced
  maxRetryAttempts: number;
  retryDelay: number;
  tradeAggregationEnabled: boolean;
  tradeAggregationWindow: number;
}

function parseAddresses(addresses: string | undefined): string[] {
  if (!addresses) return [];
  return addresses
    .split(',')
    .map((addr) => addr.trim())
    .filter((addr) => addr.length > 0);
}

function validateConfig(config: Partial<EnvConfig>): EnvConfig {
  const errors: string[] = [];

  if (!config.privateKey) {
    errors.push('PRIVATE_KEY is required');
  }

  if (config.copyTradingEnabled && !config.privateKey) {
    errors.push('PRIVATE_KEY is required when COPY_TRADING_ENABLED is true');
  }

  if (config.targetAddresses.length === 0) {
    errors.push('TARGET_ADDRESSES must contain at least one address');
  }

  if (config.pollInterval < 100) {
    errors.push('POLL_INTERVAL must be at least 100ms');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }

  return config as EnvConfig;
}

export function loadConfig(): EnvConfig {
  const config: Partial<EnvConfig> = {
    privateKey: process.env.PRIVATE_KEY || '',
    walletAddress: process.env.WALLET_ADDRESS,
    targetAddresses: parseAddresses(process.env.TARGET_ADDRESSES),
    copyTradingEnabled: process.env.COPY_TRADING_ENABLED === 'true',
    dryRun: process.env.DRY_RUN === 'true',
    positionSizeMultiplier: parseFloat(process.env.POSITION_SIZE_MULTIPLIER || '1.0'),
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '10000'),
    maxTradeSize: parseFloat(process.env.MAX_TRADE_SIZE || '5000'),
    minTradeSize: parseFloat(process.env.MIN_TRADE_SIZE || '1'),
    slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE || '1.0'),
    pollInterval: parseInt(process.env.POLL_INTERVAL || '2000', 10),
    enableWebSocket: process.env.ENABLE_WEBSOCKET === 'true',
    mongoUri: process.env.MONGO_URI,
    rpcUrl: process.env.RPC_URL,
    chainId: parseInt(process.env.CHAIN_ID || '137', 10),
    clobHost: process.env.CLOB_HOST || 'https://clob.polymarket.com',
    polymarketApiKey: process.env.POLYMARKET_API_KEY,
    healthMonitoringEnabled: process.env.HEALTH_MONITORING_ENABLED !== 'false',
    healthPort: parseInt(process.env.HEALTH_PORT || '3000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    debug: process.env.DEBUG === 'true',
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || '1000', 10),
    tradeAggregationEnabled: process.env.TRADE_AGGREGATION_ENABLED === 'true',
    tradeAggregationWindow: parseInt(process.env.TRADE_AGGREGATION_WINDOW || '300', 10),
  };

  try {
    const validated = validateConfig(config);
    logger.info('Configuration loaded successfully');
    return validated;
  } catch (error: any) {
    logger.error('Failed to load configuration', { error: error.message });
    throw error;
  }
}
