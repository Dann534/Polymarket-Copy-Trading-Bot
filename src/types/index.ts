/**
 * Polymarket API Types and Interfaces
 * Comprehensive type definitions for the copy trading bot
 */

export interface Market {
  id: string;
  question: string;
  slug: string;
  description?: string;
  endDate?: string;
  image?: string;
  icon?: string;
  resolutionSource?: string;
  tags?: string[];
  liquidity?: number;
  volume?: number;
  active?: boolean;
}

export interface Position {
  id: string;
  market: Market;
  outcome: string;
  quantity: string;
  price: string;
  value: string;
  initialValue?: string;
  timestamp: string;
}

export interface Trade {
  id: string;
  market: Market;
  outcome: string;
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  timestamp: string;
  transactionHash?: string;
  user: string;
}

export interface UserPositions {
  user: string;
  positions: Position[];
  totalValue: string;
  timestamp: string;
}

export interface UserTrades {
  user: string;
  trades: Trade[];
  totalTrades: number;
  timestamp: string;
}

export interface TradingStatus {
  user: string;
  totalPositions: number;
  totalValue: string;
  recentTrades: Trade[];
  openPositions: Position[];
  lastUpdated: string;
}

export interface PolymarketConfig {
  apiKey?: string;
  baseUrl?: string;
  dataApiUrl?: string;
  gammaApiUrl?: string;
  clobApiUrl?: string;
}

export interface MonitorOptions {
  targetAddresses: string[];
  pollInterval?: number;
  enableWebSocket?: boolean;
  onUpdate?: (status: TradingStatus, address: string) => void;
  onError?: (error: Error, address: string) => void;
}

export interface CopyTradingConfig {
  enabled: boolean;
  privateKey: string;
  dryRun?: boolean;
  positionSizeMultiplier?: number;
  maxPositionSize?: number;
  maxTradeSize?: number;
  slippageTolerance?: number;
  minTradeSize?: number;
  chainId?: number;
  clobHost?: string;
  maxRetryAttempts?: number;
  retryDelay?: number;
  onTradeExecuted?: (result: TradeExecutionResult) => void;
  onTradeError?: (error: Error, position: Position) => void;
}

export interface TradeExecutionResult {
  success: boolean;
  position: Position;
  orderId?: string;
  transactionHash?: string;
  executedQuantity?: string;
  executedPrice?: string;
  error?: string;
  dryRun: boolean;
  retryCount?: number;
}

export interface CopyTradingStatus {
  enabled: boolean;
  dryRun: boolean;
  totalTradesExecuted: number;
  totalTradesFailed: number;
  totalVolume: string;
  lastTradeTime?: string;
  tradersMonitored: number;
  activePositions: number;
}

export interface HealthMetrics {
  uptime: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  tradesExecuted: number;
  tradesFailed: number;
  lastTradeTime?: string;
  walletBalance: {
    usdc: string;
    pol: string;
  };
  tradersMonitored: number;
  activePositions: number;
  errors: Array<{
    message: string;
    timestamp: string;
  }>;
}

export interface TraderConfig {
  address: string;
  enabled: boolean;
  positionSizeMultiplier?: number;
  maxPositionSize?: number;
  maxTradeSize?: number;
}
