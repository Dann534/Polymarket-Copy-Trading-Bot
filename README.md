# 🚀 Polymarket Advanced Copy Trading Bot

<div align="center">

**Enterprise-Grade Automated Copy Trading for Polymarket Prediction Markets**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![MongoDB](https://img.shields.io/badge/MongoDB-Supported-brightgreen.svg)](https://www.mongodb.com/)

*Automatically mirror trades from top Polymarket traders with advanced risk management, multi-trader support, and enterprise features*

[Features](#-key-features) • [Quick Start](#-quick-start) • [Configuration](#-configuration) • [Documentation](#-documentation) • [Support](#-support)

---

</div>

## 🎯 Overview

The **Polymarket Advanced Copy Trading Bot** is a sophisticated, production-ready trading automation system that enables you to automatically replicate trades from successful Polymarket traders. Built with TypeScript and designed for reliability, this bot provides enterprise-grade features including multi-trader support, MongoDB persistence, health monitoring, and comprehensive risk management.

### What Makes This Bot Different?

✨ **Multi-Trader Support** - Monitor and copy from multiple traders simultaneously  
🛡️ **Enterprise Features** - MongoDB persistence, health monitoring, retry logic, and error handling  
📊 **Advanced Monitoring** - Real-time position tracking with intelligent change detection  
🔄 **Smart Execution** - Automatic retry mechanisms and duplicate trade prevention  
💾 **Data Persistence** - Complete trade history and analytics with MongoDB  
🏥 **Health Monitoring** - Built-in HTTP endpoints for metrics and health checks  
⚡ **High Performance** - Optimized API calls with intelligent caching  

---

## ✨ Key Features

### 🎯 Core Trading Capabilities

- **Automatic Copy Trading** - Seamlessly mirror trades from profitable Polymarket traders
- **Multi-Trader Monitoring** - Track and copy from multiple traders simultaneously
- **Real-Time Execution** - Execute trades within seconds of detection
- **Position Tracking** - Accurately track all positions with entry prices and current values
- **Smart Position Sizing** - Configurable multipliers for proportional trade sizing

### 🛡️ Risk Management

- **Position Limits** - Maximum position size per market and total exposure limits
- **Trade Size Controls** - Minimum and maximum trade size thresholds
- **Slippage Protection** - Configurable slippage tolerance
- **Dry Run Mode** - Test strategies without risking real funds
- **Duplicate Prevention** - MongoDB-backed duplicate trade detection

### 🔧 Enterprise Features

- **MongoDB Integration** - Persistent storage for trades and positions
- **Health Monitoring** - HTTP endpoints for real-time metrics and health checks
- **Advanced Logging** - Winston-based logging with file rotation
- **Error Recovery** - Automatic retry logic with configurable attempts
- **Graceful Shutdown** - Proper cleanup on termination signals

### 📊 Monitoring & Analytics

- **Real-Time Metrics** - Track trades executed, failed, volume, and more
- **Position Analytics** - Monitor active positions across all traders
- **Error Tracking** - Comprehensive error logging and reporting
- **Performance Metrics** - Uptime, success rates, and trading statistics

---

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **Polygon Wallet** with USDC balance for trading
- **POL/MATIC** for gas fees (recommended: 0.5+ POL)
- **MongoDB** (Optional but recommended) - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free tier works
- **RPC Endpoint** - [Infura](https://infura.io), [Alchemy](https://www.alchemy.com), or [QuickNode](https://quicknode.com)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd polymarket-copy-trading-bot

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

1. **Create environment file:**

```bash
cp .env.example .env
```

2. **Edit `.env` with your settings:**

```env
# Required: Wallet Configuration
PRIVATE_KEY=0xYourPrivateKeyHere

# Required: Traders to Copy (comma-separated)
TARGET_ADDRESSES=0xTrader1,0xTrader2,0xTrader3

# Trading Settings
COPY_TRADING_ENABLED=true
DRY_RUN=true                    # ALWAYS test with true first!
POSITION_SIZE_MULTIPLIER=1.0
MAX_POSITION_SIZE=10000
MAX_TRADE_SIZE=5000
MIN_TRADE_SIZE=1
SLIPPAGE_TOLERANCE=1.0

# Monitoring
POLL_INTERVAL=2000              # 2 seconds

# Optional: MongoDB (recommended for production)
MONGO_URI=mongodb://localhost:27017/polymarket-bot

# Optional: RPC URL
RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_KEY

# Optional: Health Monitoring
HEALTH_MONITORING_ENABLED=true
HEALTH_PORT=3000
```

3. **Run the bot:**

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### First Run Checklist

✅ Set `DRY_RUN=true` to test without executing real trades  
✅ Verify `TARGET_ADDRESSES` contains valid trader addresses  
✅ Check wallet has sufficient USDC and POL/MATIC  
✅ Ensure MongoDB is running (if using)  
✅ Test health endpoints: `curl http://localhost:3000/health`  

---

## ⚙️ Configuration

### Environment Variables

#### Required Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `PRIVATE_KEY` | Your Polygon wallet private key | `0xabc123...` |
| `TARGET_ADDRESSES` | Comma-separated trader addresses | `0xabc...,0xdef...` |

#### Trading Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `COPY_TRADING_ENABLED` | Enable copy trading | `true` |
| `DRY_RUN` | Simulate trades without executing | `true` |
| `POSITION_SIZE_MULTIPLIER` | Position size multiplier (0.5 = 50%, 2.0 = 200%) | `1.0` |
| `MAX_POSITION_SIZE` | Maximum position size in USD | `10000` |
| `MAX_TRADE_SIZE` | Maximum single trade size in USD | `5000` |
| `MIN_TRADE_SIZE` | Minimum trade size in USD | `1` |
| `SLIPPAGE_TOLERANCE` | Slippage tolerance percentage | `1.0` |

#### Monitoring Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `POLL_INTERVAL` | Polling interval in milliseconds | `2000` |
| `ENABLE_WEBSOCKET` | Enable WebSocket monitoring | `false` |

#### Database Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/polymarket-bot` |

#### Advanced Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `MAX_RETRY_ATTEMPTS` | Maximum retry attempts for failed orders | `3` |
| `RETRY_DELAY` | Retry delay in milliseconds | `1000` |
| `HEALTH_MONITORING_ENABLED` | Enable health monitoring server | `true` |
| `HEALTH_PORT` | Health monitoring server port | `3000` |
| `LOG_LEVEL` | Log level (error, warn, info, debug) | `info` |

---

## 📖 How It Works

### Copy Trading Flow

1. **Monitor Traders** - Bot continuously monitors specified trader addresses
2. **Detect Positions** - Identifies new positions opened by traders
3. **Calculate Size** - Applies position size multiplier to scale trades
4. **Risk Checks** - Validates trade size, position limits, and slippage
5. **Execute Orders** - Places matching orders on Polymarket
6. **Track Positions** - Monitors positions and executes sells when traders close positions
7. **Persist Data** - Saves all trades to MongoDB for analytics and duplicate prevention

### Multi-Trader Architecture

The bot can monitor multiple traders simultaneously:

- Each trader is monitored independently
- Position tracking is per-trader
- Trades are executed proportionally based on each trader's positions
- Statistics are aggregated across all traders

---

## 🔍 Health Monitoring

The bot includes a built-in health monitoring server with HTTP endpoints:

### Endpoints

- **`GET /health`** - Basic health check
- **`GET /metrics`** - Detailed metrics and statistics
- **`GET /stats`** - Combined copy trading and health stats
- **`GET /`** - Service information

### Example Usage

```bash
# Health check
curl http://localhost:3000/health

# Detailed metrics
curl http://localhost:3000/metrics

# Full statistics
curl http://localhost:3000/stats
```

### Metrics Provided

- Uptime
- Trades executed/failed
- Total volume
- Wallet balances (USDC and POL)
- Active positions
- Traders monitored
- Error history
- Health status

---

## 🗄️ MongoDB Setup

MongoDB is **highly recommended for production** to prevent duplicate trades and enable analytics.

### Quick Setup Options

#### Option 1: Local MongoDB

```bash
# Install MongoDB (macOS)
brew install mongodb-community

# Start MongoDB
mongod --dbpath /path/to/data
```

#### Option 2: MongoDB Atlas (Cloud - Free Tier)

1. Create account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Get connection string
4. Add to `.env`:

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/polymarket-bot
```

### Database Collections

The bot automatically creates and manages:

- **`trades`** - All executed trades with TTL (30 days)
- **`positions`** - Active position tracking

---

## 📊 Finding Good Traders

To find profitable traders to copy:

1. Visit [Polymarket Leaderboard](https://polymarket.com/leaderboard)
2. Look for traders with:
   - Positive P&L over time
   - Win rate above 55%
   - Consistent, active trading
   - Good risk management
3. Verify detailed stats on [Predictfolio](https://predictfolio.com)
4. Add wallet addresses to `TARGET_ADDRESSES`

**Tips:**
- Start with 1-2 traders to test
- Monitor their performance for a few days
- Diversify across different trading styles
- Avoid traders with high drawdowns

---

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode with hot reload |
| `npm start` | Start in production mode |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run lint` | Run ESLint linter |
| `npm run lint:fix` | Fix linting errors automatically |
| `npm run health-check` | Check bot health and configuration |

---

## 🐳 Docker Deployment

### Build and Run

```bash
# Build Docker image
docker build -t polymarket-copy-trading-bot .

# Run with environment file
docker run --env-file .env -d --name polymarket-bot polymarket-copy-trading-bot

# View logs
docker logs -f polymarket-bot

# Stop
docker stop polymarket-bot
```

### Docker Compose

```bash
docker-compose up -d
```

---

## 🔐 Security Best Practices

⚠️ **IMPORTANT SECURITY NOTES:**

- **Never commit `.env` file** - It's in `.gitignore` for a reason
- **Use environment variables** - Store secrets securely
- **Rotate private keys** - Regularly update credentials
- **Monitor balances** - Set up alerts for unusual activity
- **Use separate wallet** - Don't use your main wallet
- **Test first** - Always start with `DRY_RUN=true`
- **Start small** - Test with minimal amounts first

---

## 🐛 Troubleshooting

### Common Issues

**Bot not detecting trades:**
- Verify `TARGET_ADDRESSES` are correct and active
- Check trader has recent activity
- Increase `POLL_INTERVAL` if needed
- Verify `MIN_TRADE_SIZE` threshold

**Orders failing:**
- Check USDC balance in wallet
- Verify POL/MATIC balance for gas (>0.2 POL recommended)
- Confirm RPC endpoint is accessible
- Check market is still active
- Review logs for specific error messages

**MongoDB connection errors:**
- Verify MongoDB is running
- Check connection string format
- Ensure network access if using cloud MongoDB
- Bot will continue without MongoDB (in-memory only)

**High gas costs:**
- Monitor network congestion
- Consider increasing `MIN_TRADE_SIZE` to only trade larger positions
- Adjust `POSITION_SIZE_MULTIPLIER` to reduce trade frequency

---

## 📚 Documentation

### Architecture

The bot is built with a modular architecture:

```
src/
├── api/              # Polymarket API client
├── config/            # Configuration management
├── health/            # Health monitoring server
├── models/            # MongoDB models
├── monitor/           # Account monitoring
├── trading/          # Trade execution
├── types/            # TypeScript types
└── utils/           # Utilities (logger, etc.)
```

### Key Components

- **PolymarketClient** - Handles all API communication
- **AccountMonitor** - Monitors trader positions
- **TradeExecutor** - Executes trades with retry logic
- **CopyTradingMonitor** - Orchestrates copy trading
- **HealthMonitor** - Provides health endpoints

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ⚠️ Disclaimer

**IMPORTANT LEGAL DISCLAIMER:**

This software is provided "as-is" for educational and research purposes only. Trading cryptocurrencies and prediction markets involves substantial risk of loss.

- **No Warranty**: The software is provided without any warranties
- **Use at Your Own Risk**: You are solely responsible for any losses incurred
- **Not Financial Advice**: This is not investment or trading advice
- **Compliance**: Ensure compliance with local laws and regulations
- **Testing**: Always test with small amounts first
- **No Guarantees**: Past performance ≠ future results

The authors and contributors are not responsible for any financial losses, damages, or legal issues arising from the use of this software.

---

## 📞 Support & Contact

For questions, issues, or support:

**Telegram:** [@Kei4650](https://t.me/Kei4650)

**Issues:** Please open an issue on GitHub for bug reports or feature requests

---

## 🌟 Acknowledgments

- Built with [Polymarket CLOB Client](https://github.com/Polymarket/clob-client)
- Powered by Polygon network
- Trader analytics from [Predictfolio](https://predictfolio.com)

---

<div align="center">

**Made with ❤️ for the Polymarket community**

*Automate your trading, maximize your potential*

[⭐ Star this repo](https://github.com) if you find it useful!

</div>

---

**Keywords:** Polymarket bot, Polymarket copy trading, automated trading, Polygon bot, prediction markets, trading automation, DeFi bot, copy trading bot
