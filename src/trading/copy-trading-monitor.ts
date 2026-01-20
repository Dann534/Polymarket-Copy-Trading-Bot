/**
 * Enhanced Copy Trading Monitor with Multi-Trader Support
 */

import { AccountMonitor } from '../monitor/account-monitor';
import { PolymarketClient } from '../api/polymarket-client';
import { TradeExecutor } from './trade-executor';
import {
  Position,
  TradingStatus,
  MonitorOptions,
  CopyTradingConfig,
  CopyTradingStatus,
} from '../types';
import { logger } from '../utils/logger';

export class CopyTradingMonitor {
  private accountMonitor: AccountMonitor;
  private tradeExecutor: TradeExecutor;
  private config: CopyTradingConfig;
  private stats: CopyTradingStatus;
  private executedPositions: Map<string, Set<string>> = new Map(); // trader -> position IDs
  private targetPositions: Map<string, Map<string, Position>> = new Map(); // trader -> position map

  constructor(
    client: PolymarketClient,
    monitorOptions: MonitorOptions,
    copyTradingConfig: CopyTradingConfig
  ) {
    this.config = copyTradingConfig;
    this.tradeExecutor = new TradeExecutor(copyTradingConfig);

    this.stats = {
      enabled: copyTradingConfig.enabled,
      dryRun: copyTradingConfig.dryRun ?? false,
      totalTradesExecuted: 0,
      totalTradesFailed: 0,
      totalVolume: '0',
      tradersMonitored: monitorOptions.targetAddresses.length,
      activePositions: 0,
    };

    // Initialize executed positions tracking for each trader
    monitorOptions.targetAddresses.forEach((address) => {
      this.executedPositions.set(address, new Set());
      this.targetPositions.set(address, new Map());
    });

    this.accountMonitor = new AccountMonitor(client, {
      ...monitorOptions,
      onUpdate: (status: TradingStatus, address: string) => {
        if (monitorOptions.onUpdate) {
          monitorOptions.onUpdate(status, address);
        }
        if (this.config.enabled) {
          this.handleStatusUpdate(status, address);
        }
      },
      onError: (error: Error, address: string) => {
        if (monitorOptions.onError) {
          monitorOptions.onError(error, address);
        }
        logger.error('Copy trading monitor error', {
          address,
          error: error.message,
        });
      },
    });
  }

  /**
   * Start monitoring and copy trading
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.warn('Copy trading is disabled. Starting monitor only...');
      await this.accountMonitor.start();
      return;
    }

    logger.info('Starting copy trading monitor', {
      traders: this.accountMonitor.getMonitoredAddresses().length,
      dryRun: this.config.dryRun,
    });

    try {
      await this.tradeExecutor.initialize();
    } catch (error: any) {
      logger.error('Failed to initialize trade executor', { error: error.message });
      if (!this.config.dryRun) {
        throw error;
      }
    }

    await this.accountMonitor.start();
    logger.info('Copy trading monitor started successfully');
  }

  /**
   * Stop monitoring and copy trading
   */
  stop(): void {
    this.accountMonitor.stop();
    logger.info('Copy trading monitor stopped');
  }

  /**
   * Handle status updates and execute copy trades
   */
  private async handleStatusUpdate(status: TradingStatus, traderAddress: string): Promise<void> {
    const currentPositions = new Map<string, Position>();
    status.openPositions.forEach((pos) => {
      currentPositions.set(pos.id, pos);
    });

    const lastPositions = this.targetPositions.get(traderAddress) || new Map();
    const executedForTrader = this.executedPositions.get(traderAddress) || new Set();

    // Detect new positions
    const newPositions: Position[] = [];
    for (const [id, position] of currentPositions) {
      if (!lastPositions.has(id) && !executedForTrader.has(id)) {
        newPositions.push(position);
      }
    }

    // Detect closed positions
    const closedPositions: Position[] = [];
    for (const [id, position] of lastPositions) {
      if (!currentPositions.has(id) && executedForTrader.has(id)) {
        closedPositions.push(position);
      }
    }

    // Execute buy orders for new positions
    for (const position of newPositions) {
      try {
        logger.info('New position detected', {
          trader: traderAddress,
          market: position.market.question.substring(0, 50),
          outcome: position.outcome,
          quantity: position.quantity,
        });

        const result = await this.tradeExecutor.executeBuy(position, traderAddress);

        if (result.success) {
          executedForTrader.add(position.id);
          this.stats.totalTradesExecuted++;
          const tradeValue =
            parseFloat(result.executedQuantity || '0') * parseFloat(result.executedPrice || '0');
          this.stats.totalVolume = (parseFloat(this.stats.totalVolume) + tradeValue).toFixed(2);
          this.stats.lastTradeTime = new Date().toISOString();
          logger.info('Trade executed successfully', {
            trader: traderAddress,
            orderId: result.orderId,
            value: tradeValue,
          });
        } else {
          this.stats.totalTradesFailed++;
          logger.error('Failed to execute trade', {
            trader: traderAddress,
            error: result.error,
          });
        }
      } catch (error: any) {
        this.stats.totalTradesFailed++;
        logger.error('Error executing buy order', {
          trader: traderAddress,
          error: error.message,
        });
      }
    }

    // Execute sell orders for closed positions
    for (const position of closedPositions) {
      try {
        logger.info('Position closed', {
          trader: traderAddress,
          market: position.market.question.substring(0, 50),
          outcome: position.outcome,
        });

        const result = await this.tradeExecutor.executeSell(position, traderAddress);

        if (result.success) {
          executedForTrader.delete(position.id);
          this.stats.totalTradesExecuted++;
          const tradeValue =
            parseFloat(result.executedQuantity || '0') * parseFloat(result.executedPrice || '0');
          this.stats.totalVolume = (parseFloat(this.stats.totalVolume) + tradeValue).toFixed(2);
          this.stats.lastTradeTime = new Date().toISOString();
          logger.info('Sell order executed successfully', {
            trader: traderAddress,
            orderId: result.orderId,
            value: tradeValue,
          });
        } else {
          this.stats.totalTradesFailed++;
          logger.error('Failed to execute sell order', {
            trader: traderAddress,
            error: result.error,
          });
        }
      } catch (error: any) {
        this.stats.totalTradesFailed++;
        logger.error('Error executing sell order', {
          trader: traderAddress,
          error: error.message,
        });
      }
    }

    // Update target positions map
    this.targetPositions.set(traderAddress, currentPositions);
    this.stats.activePositions = Array.from(this.targetPositions.values()).reduce(
      (sum, positions) => sum + positions.size,
      0
    );
  }

  /**
   * Get copy trading statistics
   */
  getStats(): CopyTradingStatus {
    return { ...this.stats };
  }

  /**
   * Check if monitor is running
   */
  isRunning(): boolean {
    return this.accountMonitor.isRunning();
  }

  /**
   * Get account monitor instance
   */
  getAccountMonitor(): AccountMonitor {
    return this.accountMonitor;
  }

  /**
   * Get trade executor instance
   */
  getTradeExecutor(): TradeExecutor {
    return this.tradeExecutor;
  }
}
