/**
 * Check Token Allowance Script
 * Checks USDC allowance for Polymarket trading
 */

import { loadConfig } from '../config/env';
import { Wallet, ethers } from 'ethers';
import { logger } from '../utils/logger';

// USDC contract address on Polygon
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
// Polymarket ConditionalTokens contract (example, verify actual address)
const CONDITIONAL_TOKENS_ADDRESS = '0x4D97DCd97eC945f40CF65F87097ACe5EA0476045';

async function checkAllowance() {
  try {
    const config = loadConfig();

    if (!config.rpcUrl) {
      console.error('❌ RPC_URL not configured');
      process.exit(1);
    }

    const wallet = new Wallet(config.privateKey);
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const signer = wallet.connect(provider);

    console.log('🔍 Checking USDC allowance...\n');
    console.log(`Wallet: ${wallet.address}\n`);

    // USDC ERC20 ABI (simplified)
    const erc20Abi = [
      'function allowance(address owner, address spender) view returns (uint256)',
      'function balanceOf(address account) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ];

    const usdcContract = new ethers.Contract(USDC_ADDRESS, erc20Abi, signer);

    const balance = await usdcContract.balanceOf(wallet.address);
    const decimals = await usdcContract.decimals();
    const balanceFormatted = ethers.formatUnits(balance, decimals);

    console.log(`USDC Balance: ${balanceFormatted} USDC`);

    const allowance = await usdcContract.allowance(wallet.address, CONDITIONAL_TOKENS_ADDRESS);
    const allowanceFormatted = ethers.formatUnits(allowance, decimals);

    console.log(`Allowance: ${allowanceFormatted} USDC\n`);

    if (allowance === 0n) {
      console.log('⚠️  No allowance set. You may need to approve USDC for trading.');
      console.log('   Use the set-allowance script or approve manually.');
    } else {
      console.log('✅ Allowance is set');
    }
  } catch (error: any) {
    logger.error('Error checking allowance', { error: error.message });
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAllowance();
