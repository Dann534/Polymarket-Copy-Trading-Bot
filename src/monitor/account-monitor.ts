/**
 * Enhanced Account Monitor with Multi-Trader Support
 * Monitors multiple trader accounts simultaneously
 */

import { PolymarketClient } from '../api/polymarket-client';
import { TradingStatus, MonitorOptions, Position } from '../types';
import { logger } from '../utils/logger';

interface TraderStatus {
  address: string;
  lastStatus?: TradingStatus;
  lastPollTime?: number;
  errorCount: number;
}

export class AccountMonitor {
  private client: PolymarketClient;
  private options: Required<Omit<MonitorOptions, 'targetAddresses'>> & { targetAddresses: string[] };
  private pollIntervalIds: Map<string, NodeJS.Timeout> = new Map();
  private isMonitoring: boolean = false;
  private traderStatuses: Map<string, TraderStatus> = new Map();

  constructor(client: PolymarketClient, options: MonitorOptions) {
    if (!options.targetAddresses || options.targetAddresses.length === 0) {
      throw new Error('At least one target address is required');
    }

    this.client = client;
    this.options = {
      pollInterval: options.pollInterval || 2000,
      enableWebSocket: options.enableWebSocket || false,
      onUpdate: options.onUpdate || (() => {}),
      onError: options.onError || ((error) => logger.error('Monitor error', { error: error.message })),
      targetAddresses: options.targetAddresses,
    };

    // Initialize trader statuses
    this.options.targetAddresses.forEach((address) => {
      this.traderStatuses.set(address, {
        address,
        errorCount: 0,
      });
    });
  }

  /**
   * Start monitoring all target accounts
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Monitor is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting account monitor', {
      traderCount: this.options.targetAddresses.length,
      pollInterval: this.options.pollInterval,
    });

    // Initial fetch for all traders
    await Promise.allSettled(
      this.options.targetAddresses.map((address) => this.updateStatus(address))
    );

    // Start polling for each trader
    this.options.targetAddresses.forEach((address) => {
      const intervalId = setInterval(
        () => this.updateStatus(address),
        this.options.pollInterval
      );
      this.pollIntervalIds.set(address, intervalId);
    });

    logger.info('Account monitor started', {
      tradersMonitored: this.options.targetAddresses.length,
    });

    if (this.options.enableWebSocket) {
      logger.warn('WebSocket monitoring not yet implemented, using polling');
    }
  }

  /**
   * Stop monitoring all accounts
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    this.pollIntervalIds.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.pollIntervalIds.clear();
    logger.info('Account monitor stopped');
  }

  /**
   * Get current trading status for a specific address
   */
  async getStatus(address: string): Promise<TradingStatus> {
    try {
      const positionsResult = await Promise.allSettled([
        this.client.getUserPositions(address),
      ]);

      const positions =
        positionsResult[0].status === 'fulfilled'
          ? positionsResult[0].value
          : {
              user: address,
              positions: [],
              totalValue: '0',
              timestamp: new Date().toISOString(),
            };

      if (positionsResult[0].status === 'rejected') {
        logger.warn('Failed to fetch positions', {
          address,
          error: positionsResult[0].reason?.message,
        });
      }

      const status: TradingStatus = {
        user: address,
        totalPositions: positions.positions.length,
        totalValue: positions.totalValue,
        recentTrades: [],
        openPositions: positions.positions,
        lastUpdated: new Date().toISOString(),
      };

      return status;
    } catch (error: any) {
      logger.error('Error getting status', { address, error: error.message });
      throw error;
    }
  }

  /**
   * Update status for a specific trader and notify if there are changes
   */
  private async updateStatus(address: string): Promise<void> {
    try {
      const status = await this.getStatus(address);
      const traderStatus = this.traderStatuses.get(address)!;
      const hasChanges = this.detectChanges(status, traderStatus.lastStatus);

      // Log polling activity periodically
      const now = Date.now();
      if (
        !traderStatus.lastPollTime ||
        now - traderStatus.lastPollTime > 10000
      ) {
        logger.debug('Polling trader', {
          address,
          positions: status.openPositions.length,
        });
        traderStatus.lastPollTime = now;
      }

      if (hasChanges || !traderStatus.lastStatus) {
        if (traderStatus.lastStatus && hasChanges) {
          this.logChanges(traderStatus.lastStatus, status);
        }

        traderStatus.lastStatus = status;
        traderStatus.errorCount = 0; // Reset error count on success
        this.options.onUpdate(status, address);
      }
    } catch (error: any) {
      const traderStatus = this.traderStatuses.get(address)!;
      traderStatus.errorCount++;
      logger.error('Error during status update', {
        address,
        error: error.message,
        errorCount: traderStatus.errorCount,
      });
      this.options.onError(error, address);
    }
  }

  /**
   * Detect if there are significant changes in the status
   */
  private detectChanges(current: TradingStatus, last?: TradingStatus): boolean {
    if (!last) {
      return true;
    }

    // Check position count changes
    if (current.openPositions.length !== last.openPositions.length) {
      return true;
    }

    // Create maps for easier lookup
    const currentPositionsMap = new Map(current.openPositions.map((p) => [p.id, p]));
    const lastPositionsMap = new Map(last.openPositions.map((p) => [p.id, p]));

    // Check for new positions
    for (const [id] of currentPositionsMap) {
      if (!lastPositionsMap.has(id)) {
        return true;
      }

      // Check quantity changes
      const currentPos = currentPositionsMap.get(id)!;
      const lastPos = lastPositionsMap.get(id)!;
      const currentQty = parseFloat(currentPos.quantity);
      const lastQty = parseFloat(lastPos.quantity);

      if (Math.abs(currentQty - lastQty) > Math.max(1, lastQty * 0.01)) {
        return true;
      }
    }

    // Check for removed positions
    for (const id of lastPositionsMap.keys()) {
      if (!currentPositionsMap.has(id)) {
        return true;
      }
    }

    // Check total value changes
    const lastValue = parseFloat(last.totalValue);
    const currentValue = parseFloat(current.totalValue);
    if (
      Math.abs(currentValue - lastValue) / Math.max(lastValue, 0.01) >
      0.01
    ) {
      return true;
    }

    return false;
  }

  /**
   * Log changes between statuses
   */
  private logChanges(last: TradingStatus, current: TradingStatus): void {
    const newPositions = current.openPositions.filter(
      (p) => !last.openPositions.some((lp) => lp.id === p.id)
    );
    const removedPositions = last.openPositions.filter(
      (lp) => !current.openPositions.some((p) => p.id === lp.id)
    );

    const updatedPositions: Array<{ position: Position; oldQty: string; newQty: string }> = [];
    current.openPositions.forEach((currentPos) => {
      const lastPos = last.openPositions.find((lp) => lp.id === currentPos.id);
      if (lastPos) {
        const currentQty = parseFloat(currentPos.quantity);
        const lastQty = parseFloat(lastPos.quantity);
        if (Math.abs(currentQty - lastQty) > Math.max(1, lastQty * 0.01)) {
          updatedPositions.push({
            position: currentPos,
            oldQty: lastPos.quantity,
            newQty: currentPos.quantity,
          });
        }
      }
    });

    if (newPositions.length > 0) {
      logger.info('New positions detected', {
        address: current.user,
        count: newPositions.length,
      });
      newPositions.forEach((pos) => {
        logger.info('New position', {
          address: current.user,
          market: pos.market.question.substring(0, 50),
          outcome: pos.outcome,
          quantity: pos.quantity,
          price: pos.price,
        });
      });
    }

    if (updatedPositions.length > 0) {
      logger.info('Positions updated', {
        address: current.user,
        count: updatedPositions.length,
      });
    }

    if (removedPositions.length > 0) {
      logger.info('Positions closed', {
        address: current.user,
        count: removedPositions.length,
      });
    }
  }

  /**
   * Get formatted status string for display
   */
  getFormattedStatus(status: TradingStatus): string {
    const lines = [
      `\n╔══════════════════════════════════════════════════════════╗`,
      `║     Polymarket Account Monitor - Open Positions          ║`,
      `╚══════════════════════════════════════════════════════════╝`,
      `👤 Account: ${status.user.substring(0, 10)}...${status.user.substring(status.user.length - 8)}`,
      `🕐 Last Updated: ${new Date(status.lastUpdated).toLocaleString()}`,
    ];

    if (status.openPositions.length > 0) {
      const displayCount = Math.min(10, status.openPositions.length);
      lines.push(
        `\n💼 Currently Open Positions (showing ${displayCount} of ${status.openPositions.length} total):`
      );
      status.openPositions.slice(0, 10).forEach((position, index) => {
        const outcome = position.outcome;
        const quantity = parseFloat(position.quantity).toLocaleString('en-US', {
          maximumFractionDigits: 2,
        });
        const price = parseFloat(position.price).toFixed(4);
        const value = parseFloat(position.value);
        const valueStr = value.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const marketTitle = position.market.question || 'Unknown Market';
        const shortTitle = marketTitle.length > 50 ? marketTitle.substring(0, 47) + '...' : marketTitle;

        lines.push(`   ${index + 1}. ${outcome}: ${quantity} shares @ $${price}`);
        lines.push(`      Current Value: $${valueStr}`);
        lines.push(`      Market: ${shortTitle}`);
      });
    } else {
      lines.push(`\n💼 Currently Open Positions: No active positions`);
    }

    lines.push(`\n╚══════════════════════════════════════════════════════════╝\n`);

    return lines.join('\n');
  }

  /**
   * Check if monitor is currently running
   */
  isRunning(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get all monitored addresses
   */
  getMonitoredAddresses(): string[] {
    return Array.from(this.traderStatuses.keys());
  }

  /**
   * Get status for a specific trader
   */
  getTraderStatus(address: string): TraderStatus | undefined {
    return this.traderStatuses.get(address);
  }
}
