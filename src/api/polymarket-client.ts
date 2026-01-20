/**
 * Enhanced Polymarket API Client
 * Handles communication with Polymarket's various APIs with improved error handling and caching
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  Market,
  Position,
  Trade,
  UserPositions,
  UserTrades,
  PolymarketConfig,
} from '../types';
import { logger } from '../utils/logger';

export class PolymarketClient {
  private client: AxiosInstance;
  private config: PolymarketConfig;
  private marketCache: Map<string, Market> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(config: PolymarketConfig = {}) {
    this.config = {
      baseUrl: 'https://clob.polymarket.com',
      dataApiUrl: 'https://data-api.polymarket.com',
      gammaApiUrl: 'https://gamma-api.polymarket.com',
      clobApiUrl: 'https://clob.polymarket.com',
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.dataApiUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
      },
      timeout: 30000,
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        if (process.env.DEBUG === 'true') {
          logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
      },
      (error) => {
        logger.error('Request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          logger.warn('API Error Response', {
            status: error.response.status,
            url: error.config?.url,
            message: error.message,
          });
        } else if (error.request) {
          logger.error('API Request failed - no response', {
            url: error.config?.url,
          });
        } else {
          logger.error('API Error', { message: error.message });
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get user positions for a specific address with pagination support
   */
  async getUserPositions(userAddress: string): Promise<UserPositions> {
    try {
      let positions: Position[] = [];
      let hasMore = true;
      let page = 0;
      const limit = 100;

      while (hasMore && page < 10) {
        try {
          const response = await this.client.get(`/users/${userAddress}/positions`, {
            params: {
              active: true,
              limit: limit,
              offset: page * limit,
            },
          });

          const pagePositions = response.data.positions || response.data?.data || response.data || [];

          if (Array.isArray(pagePositions)) {
            positions = positions.concat(pagePositions);
            hasMore = pagePositions.length === limit;
            page++;
          } else {
            positions = pagePositions;
            hasMore = false;
          }
        } catch (primaryError: any) {
          // Try alternative endpoint
          try {
            const altResponse = await this.client.get(`/positions`, {
              params: {
                user: userAddress,
                active: true,
                limit: limit,
                offset: page * limit,
              },
            });

            const pagePositions =
              altResponse.data.positions || altResponse.data?.data || altResponse.data || [];

            if (Array.isArray(pagePositions)) {
              positions = positions.concat(pagePositions);
              hasMore = pagePositions.length === limit;
              page++;
            } else {
              positions = pagePositions;
              hasMore = false;
            }
          } catch (altError: any) {
            if (
              primaryError.response?.status === 404 ||
              altError.response?.status === 404
            ) {
              return {
                user: userAddress,
                positions: [],
                totalValue: '0',
                timestamp: new Date().toISOString(),
              };
            }
            throw primaryError;
          }
        }
      }

      const positionsArray = Array.isArray(positions) ? positions : [];
      const normalizedPositions = this.normalizePositions(positionsArray);

      return {
        user: userAddress,
        positions: normalizedPositions,
        totalValue: this.calculateTotalValue(normalizedPositions),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return {
          user: userAddress,
          positions: [],
          totalValue: '0',
          timestamp: new Date().toISOString(),
        };
      }
      logger.error('Failed to fetch user positions', {
        userAddress,
        error: error.message,
      });
      throw new Error(`Failed to fetch user positions: ${error.message}`);
    }
  }

  /**
   * Get user trade history
   */
  async getUserTrades(userAddress: string, limit: number = 50): Promise<UserTrades> {
    try {
      let trades: Trade[] = [];

      try {
        const response = await this.client.get(`/users/${userAddress}/trades`, {
          params: {
            limit,
            sort: 'desc',
          },
        });

        trades = response.data.trades || response.data?.data || response.data || [];

        if (!Array.isArray(trades)) {
          trades = [];
        }
      } catch (primaryError: any) {
        try {
          const altResponse = await this.client.get(`/trades`, {
            params: {
              user: userAddress,
              limit,
              sort: 'desc',
            },
          });

          trades = altResponse.data.trades || altResponse.data?.data || altResponse.data || [];

          if (!Array.isArray(trades)) {
            trades = [];
          }
        } catch (altError: any) {
          if (
            primaryError.response?.status === 404 ||
            altError.response?.status === 404
          ) {
            return {
              user: userAddress,
              trades: [],
              totalTrades: 0,
              timestamp: new Date().toISOString(),
            };
          }
          throw primaryError;
        }
      }

      const tradesArray = Array.isArray(trades) ? trades : [];
      const normalizedTrades = this.normalizeTrades(tradesArray);

      return {
        user: userAddress,
        trades: normalizedTrades,
        totalTrades: normalizedTrades.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return {
          user: userAddress,
          trades: [],
          totalTrades: 0,
          timestamp: new Date().toISOString(),
        };
      }
      logger.error('Failed to fetch user trades', {
        userAddress,
        error: error.message,
      });
      throw new Error(`Failed to fetch user trades: ${error.message}`);
    }
  }

  /**
   * Get market information by market ID with caching
   */
  async getMarket(marketId: string): Promise<Market> {
    if (!marketId) {
      return this.normalizeMarket({});
    }

    // Check cache
    const cached = this.marketCache.get(marketId);
    const expiry = this.cacheExpiry.get(marketId);
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    try {
      let marketData: any = null;

      // Try Gamma API first
      try {
        const gammaClient = axios.create({
          baseURL: this.config.gammaApiUrl,
          timeout: 30000,
        });

        try {
          const gammaResponse = await gammaClient.get(`/markets/${marketId}`);
          marketData = gammaResponse.data;
        } catch (e1: any) {
          try {
            const gammaResponse2 = await gammaClient.get(`/events`, {
              params: { conditionId: marketId },
            });
            if (gammaResponse2.data && gammaResponse2.data.length > 0) {
              marketData = gammaResponse2.data[0];
            }
          } catch (e2: any) {
            const gammaResponse3 = await gammaClient.get(`/markets`, {
              params: { id: marketId },
            });
            if (gammaResponse3.data && Array.isArray(gammaResponse3.data) && gammaResponse3.data.length > 0) {
              marketData = gammaResponse3.data[0];
            } else if (gammaResponse3.data && !Array.isArray(gammaResponse3.data)) {
              marketData = gammaResponse3.data;
            }
          }
        }
      } catch (gammaError: any) {
        // Try Data API
        try {
          const response = await this.client.get(`/markets/${marketId}`);
          marketData = response.data;
        } catch (dataApiError: any) {
          // Try CLOB API
          try {
            const clobClient = axios.create({
              baseURL: this.config.clobApiUrl,
              timeout: 30000,
            });
            const clobResponse = await clobClient.get(`/markets/${marketId}`);
            marketData = clobResponse.data;
          } catch (clobError: any) {
            const defaultMarket = this.normalizeMarket({ id: marketId, marketId: marketId });
            this.marketCache.set(marketId, defaultMarket);
            this.cacheExpiry.set(marketId, Date.now() + this.CACHE_TTL);
            return defaultMarket;
          }
        }
      }

      const normalizedMarket = this.normalizeMarket(marketData || { id: marketId });
      this.marketCache.set(marketId, normalizedMarket);
      this.cacheExpiry.set(marketId, Date.now() + this.CACHE_TTL);
      return normalizedMarket;
    } catch (error: any) {
      const defaultMarket = this.normalizeMarket({ id: marketId, marketId: marketId });
      this.marketCache.set(marketId, defaultMarket);
      this.cacheExpiry.set(marketId, Date.now() + this.CACHE_TTL);
      return defaultMarket;
    }
  }

  /**
   * Get multiple markets efficiently
   */
  async getMarkets(marketIds: string[]): Promise<Market[]> {
    try {
      const promises = marketIds.map((id) => this.getMarket(id).catch(() => null));
      const results = await Promise.all(promises);
      return results.filter((m): m is Market => m !== null);
    } catch (error: any) {
      logger.error('Failed to fetch markets', { error: error.message });
      throw new Error(`Failed to fetch markets: ${error.message}`);
    }
  }

  /**
   * Normalize position data from API response
   */
  private normalizePositions(data: any[]): Position[] {
    return data
      .filter((item: any) => item != null)
      .map((item: any) => {
        const marketData = {
          id: item.conditionId || item.market_id || item.marketId || '',
          question: item.title || item.question || '',
          slug: item.slug || '',
          icon: item.icon || '',
          eventSlug: item.eventSlug || '',
          endDate: item.endDate || '',
        };

        let currentValue: string;
        const size = parseFloat(item.size || item.quantity || '0');
        const curPrice = parseFloat(item.curPrice || item.currentPrice || '0');
        const avgPrice = parseFloat(item.avgPrice || item.price || '0');

        if (item.currentValue !== undefined && item.currentValue !== null && item.currentValue !== 0) {
          currentValue = String(item.currentValue);
        } else if (curPrice > 0 && size > 0) {
          currentValue = String(size * curPrice);
        } else if (item.initialValue !== undefined && item.initialValue !== null && item.initialValue > 0) {
          currentValue = String(item.initialValue);
        } else if (avgPrice > 0 && size > 0) {
          currentValue = String(size * avgPrice);
        } else {
          currentValue = this.calculatePositionValue(item);
        }

        const displayPrice = curPrice > 0 ? curPrice : avgPrice > 0 ? avgPrice : '0';

        const initialValue =
          item.initialValue !== undefined && item.initialValue !== null
            ? String(item.initialValue)
            : avgPrice > 0 && size > 0
            ? String(size * avgPrice)
            : undefined;

        return {
          id: item.asset || item.id || item.positionId || '',
          market: this.normalizeMarket(marketData),
          outcome: item.outcome || item.outcomeToken || '',
          quantity: String(item.size || item.quantity || '0'),
          price: String(displayPrice),
          value: currentValue,
          initialValue: initialValue,
          timestamp: item.timestamp
            ? typeof item.timestamp === 'number'
              ? new Date(item.timestamp * 1000).toISOString()
              : item.timestamp
            : new Date().toISOString(),
        };
      });
  }

  /**
   * Normalize trade data from API response
   */
  private normalizeTrades(data: any[]): Trade[] {
    return data
      .filter((item: any) => item != null)
      .map((item: any) => {
        const marketData = {
          id: item.conditionId || item.market_id || item.marketId || '',
          question: item.title || item.question || '',
          slug: item.slug || '',
          icon: item.icon || '',
          eventSlug: item.eventSlug || '',
        };

        return {
          id: item.transactionHash || item.id || item.tradeId || `trade-${Date.now()}-${Math.random()}`,
          market: this.normalizeMarket(marketData),
          outcome: item.outcome || item.outcomeToken || '',
          side: (item.side || '').toLowerCase() === 'buy' ? 'buy' : 'sell',
          quantity: String(item.size || item.quantity || item.amount || '0'),
          price: String(item.price || item.executionPrice || item.fillPrice || '0'),
          timestamp: item.timestamp
            ? typeof item.timestamp === 'number'
              ? new Date(item.timestamp * 1000).toISOString()
              : item.timestamp
            : new Date().toISOString(),
          transactionHash: item.transactionHash || item.txHash || item.tx,
          user: item.proxyWallet || item.user || item.userAddress || item.account || '',
        };
      });
  }

  /**
   * Normalize market data from API response
   */
  private normalizeMarket(data: any): Market {
    if (!data || typeof data !== 'object') {
      return {
        id: '',
        question: 'Unknown Market',
        slug: '',
        description: undefined,
        endDate: undefined,
        image: undefined,
        icon: undefined,
        resolutionSource: undefined,
        tags: [],
        liquidity: undefined,
        volume: undefined,
        active: true,
      };
    }

    return {
      id: data.id || data.marketId || data.market_id || data.conditionId || '',
      question: data.question || data.title || data.name || 'Unknown Market',
      slug: data.slug || data.slug_id || '',
      description: data.description || data.desc,
      endDate: data.endDate || data.endDateISO || data.end_date,
      image: data.image || data.imageUrl || data.image_url,
      icon: data.icon,
      resolutionSource: data.resolutionSource || data.resolution_source,
      tags: Array.isArray(data.tags) ? data.tags : [],
      liquidity: data.liquidity ? parseFloat(String(data.liquidity)) : undefined,
      volume: data.volume ? parseFloat(String(data.volume)) : undefined,
      active: data.active !== undefined ? Boolean(data.active) : true,
    };
  }

  /**
   * Calculate total value of positions
   */
  private calculateTotalValue(positions: Position[]): string {
    const total = positions.reduce((sum, pos) => {
      const value = parseFloat(pos.value || '0');
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
    return total.toFixed(6);
  }

  /**
   * Calculate position value
   */
  private calculatePositionValue(item: any): string {
    const quantity = parseFloat(item.quantity || item.size || '0');
    const price = parseFloat(item.price || item.lastPrice || '0');
    const value = quantity * price;
    return isNaN(value) ? '0' : value.toFixed(6);
  }
}
