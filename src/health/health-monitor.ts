/**
 * Health Monitoring Server
 * Provides HTTP endpoints for health checks and metrics
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { HealthMetrics, CopyTradingStatus } from '../types';
import { logger } from '../utils/logger';
import { isDatabaseConnected } from '../config/database';
import { Wallet, ethers } from 'ethers';

export class HealthMonitor {
  private app: Express;
  private port: number;
  private startTime: number;
  private metrics: HealthMetrics;
  private copyTradingStats?: CopyTradingStatus;
  private walletAddress?: string;
  private rpcUrl?: string;

  constructor(port: number = 3000, privateKey?: string, rpcUrl?: string) {
    this.app = express();
    this.port = port;
    this.startTime = Date.now();
    this.rpcUrl = rpcUrl;

    if (privateKey) {
      const wallet = new Wallet(privateKey);
      this.walletAddress = wallet.address;
    }

    this.metrics = {
      uptime: 0,
      status: 'healthy',
      tradesExecuted: 0,
      tradesFailed: 0,
      walletBalance: {
        usdc: '0',
        pol: '0',
      },
      tradersMonitored: 0,
      activePositions: 0,
      errors: [],
    };

    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.use(cors());
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      this.updateMetrics();
      res.json({
        status: this.metrics.status,
        uptime: this.metrics.uptime,
        timestamp: new Date().toISOString(),
      });
    });

    // Detailed metrics endpoint
    this.app.get('/metrics', async (req: Request, res: Response) => {
      await this.updateMetrics();
      res.json(this.metrics);
    });

    // Stats endpoint
    this.app.get('/stats', (req: Request, res: Response) => {
      res.json({
        copyTrading: this.copyTradingStats || null,
        health: this.metrics,
      });
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        service: 'Polymarket Copy Trading Bot',
        version: '2.0.0',
        endpoints: {
          health: '/health',
          metrics: '/metrics',
          stats: '/stats',
        },
      });
    });
  }

  /**
   * Update health metrics
   */
  private async updateMetrics(): Promise<void> {
    this.metrics.uptime = Math.floor((Date.now() - this.startTime) / 1000);

    if (this.copyTradingStats) {
      this.metrics.tradesExecuted = this.copyTradingStats.totalTradesExecuted;
      this.metrics.tradesFailed = this.copyTradingStats.totalTradesFailed;
      this.metrics.tradersMonitored = this.copyTradingStats.tradersMonitored;
      this.metrics.activePositions = this.copyTradingStats.activePositions;
    }

    // Update wallet balance if RPC URL is available
    if (this.walletAddress && this.rpcUrl) {
      try {
        await this.updateWalletBalance();
      } catch (error: any) {
        logger.warn('Failed to update wallet balance', { error: error.message });
      }
    }

    // Determine status
    if (this.metrics.errors.length > 10) {
      this.metrics.status = 'unhealthy';
    } else if (this.metrics.errors.length > 5) {
      this.metrics.status = 'degraded';
    } else {
      this.metrics.status = 'healthy';
    }
  }

  /**
   * Update wallet balance
   */
  private async updateWalletBalance(): Promise<void> {
    if (!this.walletAddress || !this.rpcUrl) {
      return;
    }

    try {
      const provider = new ethers.JsonRpcProvider(this.rpcUrl);
      const balance = await provider.getBalance(this.walletAddress);
      this.metrics.walletBalance.pol = ethers.formatEther(balance);

      // USDC balance would require contract interaction
      // For now, we'll leave it as 0 or implement if needed
    } catch (error: any) {
      logger.warn('Failed to fetch wallet balance', { error: error.message });
    }
  }

  /**
   * Update copy trading stats
   */
  updateCopyTradingStats(stats: CopyTradingStatus): void {
    this.copyTradingStats = stats;
  }

  /**
   * Add error to metrics
   */
  addError(message: string): void {
    this.metrics.errors.push({
      message,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 20 errors
    if (this.metrics.errors.length > 20) {
      this.metrics.errors = this.metrics.errors.slice(-20);
    }
  }

  /**
   * Start the health monitoring server
   */
  start(): void {
    this.app.listen(this.port, () => {
      logger.info(`Health monitoring server started on port ${this.port}`, {
        endpoints: {
          health: `http://localhost:${this.port}/health`,
          metrics: `http://localhost:${this.port}/metrics`,
          stats: `http://localhost:${this.port}/stats`,
        },
      });
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): HealthMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }
}
