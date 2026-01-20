/**
 * Set Token Allowance Script
 * Sets USDC allowance for Polymarket trading
 */

import { loadConfig } from '../config/env';
import { Wallet, ethers } from 'ethers';
import { logger } from '../utils/logger';

// USDC contract address on Polygon
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
// Polymarket ConditionalTokens contract (example, verify actual address)
const CONDITIONAL_TOKENS_ADDRESS = '0x4D97DCd97eC945f40CF65F87097ACe5EA0476045';
// Maximum uint256 value for unlimited allowance
const MAX_UINT256 = ethers.MaxUint256;

async function setAllowance() {
  try {
    const config = loadConfig();

    if (!config.rpcUrl) {
      console.error('❌ RPC_URL not configured');
      process.exit(1);
    }

    const wallet = new Wallet(config.privateKey);
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const signer = wallet.connect(provider);

    console.log('🔐 Setting USDC allowance...\n');
    console.log(`Wallet: ${wallet.address}\n`);

    // USDC ERC20 ABI
    const erc20Abi = [
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
    ];

    const usdcContract = new ethers.Contract(USDC_ADDRESS, erc20Abi, signer);

    console.log('Approving unlimited allowance...');
    const tx = await usdcContract.approve(CONDITIONAL_TOKENS_ADDRESS, MAX_UINT256);
    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    await tx.wait();
    console.log('✅ Allowance set successfully!');

    // Verify
    const allowance = await usdcContract.allowance(wallet.address, CONDITIONAL_TOKENS_ADDRESS);
    if (allowance === MAX_UINT256) {
      console.log('✅ Verified: Unlimited allowance is set');
    }
  } catch (error: any) {
    logger.error('Error setting allowance', { error: error.message });
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setAllowance();
