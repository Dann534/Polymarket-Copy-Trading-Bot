# 🚀 Quick Start Guide

Get your Polymarket copy trading bot up and running in minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment

Create a `.env` file in the root directory:

```env
# Required: Wallet Configuration
PRIVATE_KEY=0xYourPrivateKeyHere

# Required: Traders to Copy (comma-separated)
TARGET_ADDRESSES=0xTrader1,0xTrader2

# Trading Settings
COPY_TRADING_ENABLED=true
DRY_RUN=true                    # ALWAYS test with true first!
POSITION_SIZE_MULTIPLIER=1.0
MAX_POSITION_SIZE=10000
MAX_TRADE_SIZE=5000
MIN_TRADE_SIZE=1
SLIPPAGE_TOLERANCE=1.0

# Monitoring
POLL_INTERVAL=2000

# Optional: MongoDB
MONGO_URI=mongodb://localhost:27017/polymarket-bot

# Optional: RPC URL
RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_KEY

# Optional: Health Monitoring
HEALTH_MONITORING_ENABLED=true
HEALTH_PORT=3000
```

## Step 3: Run Health Check

```bash
npm run health-check
```

This will validate your configuration and check all connections.

## Step 4: Start the Bot

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## Step 5: Monitor Health

Open your browser or use curl:

```bash
curl http://localhost:3000/health
```

## Finding Traders

1. Visit [Polymarket Leaderboard](https://polymarket.com/leaderboard)
2. Look for traders with positive P&L and win rate >55%
3. Copy their wallet addresses
4. Add to `TARGET_ADDRESSES` in `.env`

## Important Notes

⚠️ **ALWAYS start with `DRY_RUN=true`** to test without executing real trades!

⚠️ **Never share your private key** - keep `.env` file secure!

⚠️ **Start with small amounts** - test thoroughly before scaling up!

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check [Troubleshooting](#-troubleshooting) section if you encounter issues
- Monitor your bot's performance via health endpoints

## Support

For questions or issues, contact: [@Kei4650](https://t.me/Kei4650)
