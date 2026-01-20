/**
 * Polymarket Advanced Copy Trading Bot
 * Main entry point
 */

import dotenv from 'dotenv';
import { AccountMonitor } from './monitor/account-monitor';
import { PolymarketClient } from './api/polymarket-client';
import { CopyTradingMonitor } from './trading/copy-trading-monitor';
import { HealthMonitor } from './health/health-monitor';
import { loadConfig } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Export main classes
export { AccountMonitor } from './monitor/account-monitor';
export { PolymarketClient } from './api/polymarket-client';
export { TradeExecutor } from './trading/trade-executor';
export { CopyTradingMonitor } from './trading/copy-trading-monitor';
export { HealthMonitor } from './health/health-monitor';
export * from './types';

// Main entry point
if (require.main === module) {
  (async () => {
    try {
      // Load configuration
      const config = loadConfig();

      logger.info('🚀 Starting Polymarket Advanced Copy Trading Bot', {
        version: '2.0.0',
        traders: config.targetAddresses.length,
        dryRun: config.dryRun,
      });

      // Connect to database if configured
      if (config.mongoUri) {
        try {
          await connectDatabase(config.mongoUri);
          logger.info('✅ Database connected');
        } catch (error: any) {
          logger.warn('⚠️  Database connection failed, continuing without persistence', {
            error: error.message,
          });
        }
      }

      // Initialize Polymarket client
      const client = new PolymarketClient({
        apiKey: config.polymarketApiKey,
      });

      // Start health monitoring if enabled
      let healthMonitor: HealthMonitor | undefined;
      if (config.healthMonitoringEnabled) {
        healthMonitor = new HealthMonitor(config.healthPort, config.privateKey, config.rpcUrl);
        healthMonitor.start();
      }

      if (config.copyTradingEnabled) {
        // Initialize copy trading monitor
        const copyTradingMonitor = new CopyTradingMonitor(
          client,
          {
            targetAddresses: config.targetAddresses,
            pollInterval: config.pollInterval,
            enableWebSocket: config.enableWebSocket,
            onUpdate: (status, address) => {
              if (process.env.DEBUG === 'true') {
                const monitor = copyTradingMonitor.getAccountMonitor();
                logger.debug('Status update', {
                  trader: address,
                  positions: status.openPositions.length,
                });
              }
            },
            onError: (error, address) => {
              logger.error('Monitor error', {
                trader: address,
                error: error.message,
              });
              if (healthMonitor) {
                healthMonitor.addError(`Monitor error for ${address}: ${error.message}`);
              }
            },
          },
          {
            enabled: true,
            privateKey: config.privateKey,
            dryRun: config.dryRun,
            positionSizeMultiplier: config.positionSizeMultiplier,
            maxPositionSize: config.maxPositionSize,
            maxTradeSize: config.maxTradeSize,
            minTradeSize: config.minTradeSize,
            slippageTolerance: config.slippageTolerance,
            chainId: config.chainId,
            clobHost: config.clobHost,
            maxRetryAttempts: config.maxRetryAttempts,
            retryDelay: config.retryDelay,
            onTradeExecuted: (result) => {
              if (result.dryRun) {
                logger.info('DRY RUN: Trade would be executed', {
                  success: result.success,
                  quantity: result.executedQuantity,
                  price: result.executedPrice,
                  market: result.position.market.question.substring(0, 50),
                });
              } else {
                logger.info('✅ Trade executed successfully', {
                  orderId: result.orderId,
                  quantity: result.executedQuantity,
                  price: result.executedPrice,
                  market: result.position.market.question.substring(0, 50),
                });
              }

              // Update health monitor
              if (healthMonitor) {
                const stats = copyTradingMonitor.getStats();
                healthMonitor.updateCopyTradingStats(stats);
              }
            },
            onTradeError: (error, position) => {
              logger.error('❌ Trade error', {
                error: error.message,
                market: position.market.question.substring(0, 50),
              });

              if (healthMonitor) {
                healthMonitor.addError(`Trade error: ${error.message}`);
              }
            },
          }
        );

        // Start copy trading
        await copyTradingMonitor.start();

        logger.info('✅ Copy trading bot started successfully', {
          traders: config.targetAddresses.length,
          dryRun: config.dryRun,
        });

        // Graceful shutdown
        const shutdown = async () => {
          logger.info('🛑 Shutting down copy trading bot...');
          const stats = copyTradingMonitor.getStats();
          logger.info('📊 Final Statistics', {
            totalTradesExecuted: stats.totalTradesExecuted,
            totalTradesFailed: stats.totalTradesFailed,
            totalVolume: stats.totalVolume,
            activePositions: stats.activePositions,
          });
          copyTradingMonitor.stop();
          await disconnectDatabase();
          process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      } else {
        // Monitoring only mode
        logger.info('📊 Starting Account Monitor (copy trading disabled)...');

        const monitor = new AccountMonitor(client, {
          targetAddresses: config.targetAddresses,
          pollInterval: config.pollInterval,
          enableWebSocket: config.enableWebSocket,
          onUpdate: (status, address) => {
            logger.info('Status update', {
              trader: address,
              positions: status.openPositions.length,
            });
          },
          onError: (error, address) => {
            logger.error('Monitor error', {
              trader: address,
              error: error.message,
            });
          },
        });

        await monitor.start();

        const shutdown = async () => {
          logger.info('🛑 Shutting down monitor...');
          monitor.stop();
          await disconnectDatabase();
          process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      }
    } catch (error: any) {
      logger.error('❌ Failed to start bot', { error: error.message });
      process.exit(1);
    }
  })();
}
