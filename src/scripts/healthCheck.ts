/**
 * Health Check Script
 * Validates configuration and checks system health
 */

import { loadConfig } from '../config/env';
import { connectDatabase, isDatabaseConnected } from '../config/database';
import { PolymarketClient } from '../api/polymarket-client';
import { Wallet } from 'ethers';
import { logger } from '../utils/logger';

async function healthCheck() {
  try {
    console.log('🔍 Running health check...\n');

    // Load configuration
    console.log('1. Checking configuration...');
    const config = loadConfig();
    console.log('   ✅ Configuration loaded\n');

    // Check wallet
    console.log('2. Checking wallet...');
    try {
      const wallet = new Wallet(config.privateKey);
      console.log(`   ✅ Wallet address: ${wallet.address}\n`);
    } catch (error: any) {
      console.log(`   ❌ Invalid private key: ${error.message}\n`);
    }

    // Check database
    console.log('3. Checking database...');
    if (config.mongoUri) {
      try {
        await connectDatabase(config.mongoUri);
        if (isDatabaseConnected()) {
          console.log('   ✅ Database connected\n');
        } else {
          console.log('   ⚠️  Database connection failed\n');
        }
      } catch (error: any) {
        console.log(`   ⚠️  Database connection error: ${error.message}\n`);
      }
    } else {
      console.log('   ⚠️  MongoDB URI not provided (optional)\n');
    }

    // Check API client
    console.log('4. Checking Polymarket API...');
    try {
      const client = new PolymarketClient({
        apiKey: config.polymarketApiKey,
      });
      if (config.targetAddresses.length > 0) {
        const testAddress = config.targetAddresses[0];
        await client.getUserPositions(testAddress);
        console.log('   ✅ API client working\n');
      } else {
        console.log('   ⚠️  No target addresses configured\n');
      }
    } catch (error: any) {
      console.log(`   ⚠️  API client error: ${error.message}\n`);
    }

    // Check traders
    console.log('5. Checking trader addresses...');
    console.log(`   📊 Traders to monitor: ${config.targetAddresses.length}`);
    config.targetAddresses.forEach((addr, index) => {
      console.log(`      ${index + 1}. ${addr}`);
    });
    console.log('');

    // Summary
    console.log('📋 Configuration Summary:');
    console.log(`   Copy Trading: ${config.copyTradingEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Dry Run: ${config.dryRun ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Position Multiplier: ${config.positionSizeMultiplier}x`);
    console.log(`   Poll Interval: ${config.pollInterval}ms`);
    console.log(`   Health Monitoring: ${config.healthMonitoringEnabled ? '✅ Enabled' : '❌ Disabled'}`);

    console.log('\n✅ Health check completed!');
  } catch (error: any) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

healthCheck();
