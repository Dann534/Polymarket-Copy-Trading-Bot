/**
 * MongoDB Position Model
 * Tracks active positions for monitoring and management
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IPosition extends Document {
  positionId: string;
  traderAddress: string;
  marketId: string;
  outcome: string;
  quantity: string;
  price: string;
  value: string;
  isActive: boolean;
  openedAt: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PositionSchema = new Schema<IPosition>(
  {
    positionId: { type: String, required: true, unique: true, index: true },
    traderAddress: { type: String, required: true, index: true },
    marketId: { type: String, required: true, index: true },
    outcome: { type: String, required: true },
    quantity: { type: String, required: true },
    price: { type: String, required: true },
    value: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const PositionModel = mongoose.model<IPosition>('Position', PositionSchema);
