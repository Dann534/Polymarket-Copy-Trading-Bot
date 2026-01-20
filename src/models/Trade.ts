/**
 * MongoDB Trade Model
 * Stores executed trades for duplicate prevention and analytics
 */

import mongoose, { Schema, Document } from 'mongoose';
import { Position } from '../types';

export interface ITrade extends Document {
  positionId: string;
  traderAddress: string;
  marketId: string;
  outcome: string;
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  orderId?: string;
  transactionHash?: string;
  executedAt: Date;
  dryRun: boolean;
  success: boolean;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TradeSchema = new Schema<ITrade>(
  {
    positionId: { type: String, required: true, index: true },
    traderAddress: { type: String, required: true, index: true },
    marketId: { type: String, required: true, index: true },
    outcome: { type: String, required: true },
    side: { type: String, enum: ['buy', 'sell'], required: true },
    quantity: { type: String, required: true },
    price: { type: String, required: true },
    orderId: { type: String },
    transactionHash: { type: String, index: true },
    executedAt: { type: Date, default: Date.now, index: true },
    dryRun: { type: Boolean, default: false },
    success: { type: Boolean, required: true },
    error: { type: String },
  },
  {
    timestamps: true,
  }
);

// Compound index for duplicate prevention
TradeSchema.index({ positionId: 1, traderAddress: 1, side: 1 }, { unique: true });

// TTL index to auto-delete old trades (optional, 30 days)
TradeSchema.index({ executedAt: 1 }, { expireAfterSeconds: 2592000 });

export const TradeModel = mongoose.model<ITrade>('Trade', TradeSchema);
