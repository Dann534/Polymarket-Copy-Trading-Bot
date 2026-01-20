/**
 * Enhanced Trade Executor with MongoDB persistence and retry logic
 */

import { ClobClient, Side, OrderType } from '@polymarket/clob-client';
import { Wallet } from 'ethers';
import { Position, CopyTradingConfig, TradeExecutionResult } from '../types';
import { logger } from '../utils/logger';
import { TradeModel, ITrade } from '../models/Trade';
import { isDatabaseConnected } from '../config/database';

export class TradeExecutor {
  private client: ClobClient;
  private config: Required<CopyTradingConfig>;
  private apiKeyCreated: boolean = false;
  private walletAddress?: string;

  constructor(config: CopyTradingConfig) {
    this.config = {
      enabled: config.enabled,
      privateKey: config.privateKey,
      dryRun: config.dryRun ?? false,
      positionSizeMultiplier: config.positionSizeMultiplier ?? 1.0,
      maxPositionSize: config.maxPositionSize ?? Infinity,
      maxTradeSize: config.maxTradeSize ?? Infinity,
      slippageTolerance: config.slippageTolerance ?? 1.0,
      minTradeSize: config.minTradeSize ?? 1.0,
      chainId: config.chainId ?? 137,
      clobHost: config.clobHost ?? 'https://clob.polymarket.com',
      maxRetryAttempts: config.maxRetryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      onTradeExecuted: config.onTradeExecuted ?? (() => {}),
      onTradeError: config.onTradeError ?? (() => {}),
    };

    const wallet = new Wallet(this.config.privateKey);
    this.walletAddress = wallet.address;

    this.client = new ClobClient(this.config.clobHost, this.config.chainId, wallet as any);
  }

  /**
   * Initialize the executor by creating/deriving API key
   */
  async initialize(): Promise<void> {
    if (this.config.dryRun) {
      logger.info('Trade executor initialized in DRY RUN mode');
      return;
    }

    try {
      logger.info('Initializing trade executor', { wallet: this.walletAddress });
      await this.client.createOrDeriveApiKey();
      this.apiKeyCreated = true;
      logger.info('Trade executor initialized successfully', {
        wallet: this.walletAddress,
      });
    } catch (error: any) {
      logger.error('Failed to initialize trade executor', { error: error.message });
      throw new Error(`Failed to initialize trade executor: ${error.message}`);
    }
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string {
    return this.walletAddress || '';
  }

  /**
   * Check if a trade already exists in database (duplicate prevention)
   */
  private async isDuplicateTrade(
    positionId: string,
    traderAddress: string,
    side: 'buy' | 'sell'
  ): Promise<boolean> {
    if (!isDatabaseConnected()) {
      return false;
    }

    try {
      const existing = await TradeModel.findOne({
        positionId,
        traderAddress,
        side,
        success: true,
      });
      return !!existing;
    } catch (error: any) {
      logger.warn('Error checking duplicate trade', { error: error.message });
      return false;
    }
  }

  /**
   * Save trade to database
   */
  private async saveTrade(
    result: TradeExecutionResult,
    traderAddress: string
  ): Promise<void> {
    if (!isDatabaseConnected() || !result.success) {
      return;
    }

    try {
      const trade = new TradeModel({
        positionId: result.position.id,
        traderAddress,
        marketId: result.position.market.id,
        outcome: result.position.outcome,
        side: result.position.value ? 'buy' : 'sell', // Simplified logic
        quantity: result.executedQuantity || result.position.quantity,
        price: result.executedPrice || result.position.price,
        orderId: result.orderId,
        transactionHash: result.transactionHash,
        executedAt: new Date(),
        dryRun: result.dryRun,
        success: result.success,
        error: result.error,
      });

      await trade.save();
      logger.debug('Trade saved to database', { tradeId: trade._id });
    } catch (error: any) {
      logger.warn('Failed to save trade to database', { error: error.message });
    }
  }

  /**
   * Execute a buy order with retry logic
   */
  async executeBuy(
    position: Position,
    traderAddress: string,
    retryCount: number = 0
  ): Promise<TradeExecutionResult> {
    const result: TradeExecutionResult = {
      success: false,
      position,
      dryRun: this.config.dryRun,
      retryCount,
    };

    try {
      // Check for duplicate
      if (await this.isDuplicateTrade(position.id, traderAddress, 'buy')) {
        logger.info('Duplicate trade detected, skipping', {
          positionId: position.id,
          traderAddress,
        });
        result.error = 'Duplicate trade';
        return result;
      }

      const tokenId = position.id;
      if (!tokenId) {
        throw new Error('Position ID (token ID) is missing');
      }

      // Calculate trade size
      const baseQuantity = parseFloat(position.quantity);
      const tradeQuantity = baseQuantity * this.config.positionSizeMultiplier;
      const tradePrice = parseFloat(position.price);
      const tradeValue = tradeQuantity * tradePrice;

      // Validate trade size
      if (tradeValue < this.config.minTradeSize) {
        const errorMsg = `Trade size $${tradeValue.toFixed(2)} is below minimum $${this.config.minTradeSize}`;
        result.error = errorMsg;
        this.config.onTradeError(new Error(errorMsg), position);
        return result;
      }

      if (tradeValue > this.config.maxTradeSize) {
        const errorMsg = `Trade size $${tradeValue.toFixed(2)} exceeds maximum $${this.config.maxTradeSize}`;
        result.error = errorMsg;
        this.config.onTradeError(new Error(errorMsg), position);
        return result;
      }

      const positionValue = parseFloat(position.value || '0') * this.config.positionSizeMultiplier;
      if (positionValue > this.config.maxPositionSize) {
        const errorMsg = `Position size $${positionValue.toFixed(2)} exceeds maximum $${this.config.maxPositionSize}`;
        result.error = errorMsg;
        this.config.onTradeError(new Error(errorMsg), position);
        return result;
      }

      if (this.config.dryRun) {
        logger.info('DRY RUN: Would execute BUY order', {
          tokenId,
          quantity: tradeQuantity,
          price: tradePrice,
          value: tradeValue,
        });

        result.success = true;
        result.executedQuantity = tradeQuantity.toFixed(4);
        result.executedPrice = tradePrice.toFixed(4);
        await this.saveTrade(result, traderAddress);
        this.config.onTradeExecuted(result);
        return result;
      }

      // Ensure API key is created
      if (!this.apiKeyCreated) {
        await this.initialize();
      }

      // Execute buy order
      logger.info('Executing BUY order', {
        tokenId,
        quantity: tradeQuantity,
        price: tradePrice,
      });

      const orderResponse = await this.client.createAndPostOrder({
        tokenID: tokenId,
        price: tradePrice,
        size: tradeQuantity,
        side: Side.BUY,
        orderType: OrderType.GTC,
      } as any);

      result.success = true;
      result.orderId = orderResponse.orderID;
      result.executedQuantity = tradeQuantity.toFixed(4);
      result.executedPrice = tradePrice.toFixed(4);

      logger.info('BUY order executed successfully', {
        orderId: result.orderId,
        quantity: result.executedQuantity,
        price: result.executedPrice,
      });

      await this.saveTrade(result, traderAddress);
      this.config.onTradeExecuted(result);

      return result;
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      logger.error('Failed to execute BUY order', {
        error: errorMsg,
        retryCount,
      });

      // Retry logic
      if (retryCount < this.config.maxRetryAttempts) {
        logger.info('Retrying BUY order', {
          retryCount: retryCount + 1,
          maxRetries: this.config.maxRetryAttempts,
        });
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
        return this.executeBuy(position, traderAddress, retryCount + 1);
      }

      result.error = errorMsg;
      await this.saveTrade(result, traderAddress);
      this.config.onTradeError(error, position);
      return result;
    }
  }

  /**
   * Execute a sell order with retry logic
   */
  async executeSell(
    position: Position,
    traderAddress: string,
    retryCount: number = 0
  ): Promise<TradeExecutionResult> {
    const result: TradeExecutionResult = {
      success: false,
      position,
      dryRun: this.config.dryRun,
      retryCount,
    };

    try {
      const tokenId = position.id;
      if (!tokenId) {
        throw new Error('Position ID (token ID) is missing');
      }

      const baseQuantity = parseFloat(position.quantity);
      const tradeQuantity = baseQuantity * this.config.positionSizeMultiplier;
      const tradePrice = parseFloat(position.price);

      if (this.config.dryRun) {
        logger.info('DRY RUN: Would execute SELL order', {
          tokenId,
          quantity: tradeQuantity,
          price: tradePrice,
        });

        result.success = true;
        result.executedQuantity = tradeQuantity.toFixed(4);
        result.executedPrice = tradePrice.toFixed(4);
        await this.saveTrade(result, traderAddress);
        this.config.onTradeExecuted(result);
        return result;
      }

      if (!this.apiKeyCreated) {
        await this.initialize();
      }

      logger.info('Executing SELL order', {
        tokenId,
        quantity: tradeQuantity,
        price: tradePrice,
      });

      const orderResponse = await this.client.createAndPostOrder({
        tokenID: tokenId,
        price: tradePrice,
        size: tradeQuantity,
        side: Side.SELL,
        orderType: OrderType.GTC as any,
      } as any);

      result.success = true;
      result.orderId = orderResponse.orderID;
      result.executedQuantity = tradeQuantity.toFixed(4);
      result.executedPrice = tradePrice.toFixed(4);

      logger.info('SELL order executed successfully', {
        orderId: result.orderId,
        quantity: result.executedQuantity,
        price: result.executedPrice,
      });

      await this.saveTrade(result, traderAddress);
      this.config.onTradeExecuted(result);

      return result;
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      logger.error('Failed to execute SELL order', {
        error: errorMsg,
        retryCount,
      });

      // Retry logic
      if (retryCount < this.config.maxRetryAttempts) {
        logger.info('Retrying SELL order', {
          retryCount: retryCount + 1,
          maxRetries: this.config.maxRetryAttempts,
        });
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
        return this.executeSell(position, traderAddress, retryCount + 1);
      }

      result.error = errorMsg;
      await this.saveTrade(result, traderAddress);
      this.config.onTradeError(error, position);
      return result;
    }
  }

  /**
   * Check if executor is in dry run mode
   */
  isDryRun(): boolean {
    return this.config.dryRun;
  }
}
