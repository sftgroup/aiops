/**
 * crypto-watcher.js — 链上支付到账监听器
 *
 * 功能:
 *   1. 轮询 RPC，查找 USDC/ETH Transfer 到收款地址的事件
 *   2. 匹配 cryptoOrders 中 pending 订单
 *   3. 确认后自动升级 tenant plan
 *
 * 用法: node crypto-watcher.js
 * 环境变量: CRYPTO_RPC_URL, CRYPTO_PAYMENT_ADDRESS, DATABASE_URL
 */

const { ethers } = require('ethers');
const crypto = require('crypto');

// ─── 配置 ───
const RPC_URL = process.env.CRYPTO_RPC_URL;
const PAYMENT_ADDRESS = process.env.CRYPTO_PAYMENT_ADDRESS ? ethers.getAddress(process.env.CRYPTO_PAYMENT_ADDRESS) : null;

if (!RPC_URL || !PAYMENT_ADDRESS) {
  console.error('[crypto-watcher] CRYPTO_RPC_URL and CRYPTO_PAYMENT_ADDRESS are required');
  process.exit(1);
}

// USDC 合约 (Ethereum Mainnet)
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDC_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// WETH 合约 (ETH 转账监听)
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// 最小确认数
const MIN_CONFIRMATIONS = 3;

// 订单存储 (实际生产环境应从 DB 读取)
let cryptoOrders = new Map();

// ─── Provider ───
const provider = new ethers.JsonRpcProvider(RPC_URL);

// ─── USDC 监听 ───
const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

/**
 * 检查指定区块范围是否有到收款地址的 USDC 转账
 */
async function scanUSDCTransfers(fromBlock, toBlock) {
  console.log(`[crypto-watcher] Scanning blocks ${fromBlock} → ${toBlock} for USDC Transfers`);
  const filter = usdcContract.filters.Transfer(null, PAYMENT_ADDRESS);
  const events = await usdcContract.queryFilter(filter, fromBlock, toBlock);

  for (const evt of events) {
    const { transactionHash, blockNumber } = evt;
    const from = evt.args[0];
    const to = evt.args[1];
    const value = evt.args[2]; // USDC 是 6 位小数

    console.log(`[crypto-watcher] 📥 USDC Transfer: ${ethers.formatUnits(value, 6)} from ${from} tx=${transactionHash}`);

    // 匹配 pending 订单
    await matchOrder({
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      amount: Number(ethers.formatUnits(value, 6)),
      txHash: transactionHash,
      blockNumber,
      currency: 'USDC',
    });
  }
}

/**
 * 检查 ETH 到收款地址的转账
 */
async function scanETHTransfers(fromBlock, toBlock) {
  console.log(`[crypto-watcher] Scanning blocks ${fromBlock} → ${toBlock} for ETH Transfers`);

  for (let b = fromBlock; b <= toBlock; b++) {
    try {
      const block = await provider.getBlock(b, true);
      if (!block || !block.transactions) continue;

      for (const tx of block.transactions) {
        if (tx.to && ethers.getAddress(tx.to) === PAYMENT_ADDRESS) {
          const value = Number(ethers.formatEther(tx.value));
          console.log(`[crypto-watcher] 📥 ETH Transfer: ${value} ETH tx=${tx.hash}`);

          await matchOrder({
            from: tx.from.toLowerCase(),
            to: tx.to.toLowerCase(),
            amount: value,
            txHash: tx.hash,
            blockNumber: b,
            currency: 'ETH',
          });
        }
      }
    } catch (err) {
      // skip failed blocks
    }
  }
}

/**
 * 匹配转账到待支付订单
 *
 * 匹配策略（解决同区块多笔支付混淆）：
 *   - USDC: 金额尾数编码 orderId 的 hash（0.01-0.99 唯一标识）
 *   - ETH: 优先按金额精确匹配，备选按 calldata/matchId
 */
async function matchOrder({ from, amount, txHash, blockNumber, currency }) {
  // 按到期时间排序 pending 订单（先到期的优先匹配）
  const pendingOrders = [...cryptoOrders.entries()]
    .filter(([_, o]) => o.status === 'pending')
    .sort((a, b) => a[1].expiresAt - b[1].expiresAt);

  for (const [orderId, order] of pendingOrders) {
    if (order.currency !== currency) continue;

    // ── 精确匹配 ──
    // 计算该订单的期望金额（含 paymentId 编码）
    const expectedAmount = order.expectedAmount;
    const tolerance = currency === 'USDC' ? 0.005 : 0.001; // USDC: 0.5 分, ETH: 0.001 ETH

    if (expectedAmount && Math.abs(amount - expectedAmount) >= tolerance) {
      continue; // 金额不匹配，跳过
    }

    if (!expectedAmount && amount < order.amount * 0.99) {
      continue; // 无精确金额，用 1% 容差兜底
    }

    // 检查确认数
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - blockNumber + 1;

    order.txHash = txHash;
    order.confirmations = confirmations;
    order.buyerAddress = from;

    if (confirmations >= MIN_CONFIRMATIONS) {
      order.status = 'confirmed';
      console.log(`[crypto-watcher] ✅ Order ${orderId} CONFIRMED! (${confirmations} confs)`);

      // 自动升级套餐
      try {
        await upgradeTenant(order);
      } catch (err) {
        console.error(`[crypto-watcher] upgradeTenant failed for ${orderId}:`, err.message);
      }
    } else {
      console.log(`[crypto-watcher] ⏳ Order ${orderId}: ${confirmations}/${MIN_CONFIRMATIONS} confirmations`);
    }
    return; // 一对一匹配：找到就返回
  }
}

/**
 * 升级 tenant plan
 */
async function upgradeTenant(order) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.tenant.update({
      where: { id: order.tenantId },
      data: { plan: order.planId },
    });
    console.log(`[crypto-watcher] 🚀 Tenant ${order.tenantId} upgraded to ${order.planId}`);
  } finally {
    await prisma.$disconnect();
  }
}

// ─── 主循环 ───
let lastScannedBlock = null;

async function mainLoop() {
  try {
    const currentBlock = await provider.getBlockNumber();

    if (lastScannedBlock === null) {
      // 首次：只从最近 50 个块开始
      lastScannedBlock = Math.max(currentBlock - 50, 0);
    }

    if (currentBlock > lastScannedBlock) {
      const scanFrom = lastScannedBlock + 1;
      const scanTo = currentBlock;

      // 并行扫描 USDC + ETH
      await Promise.all([
        scanUSDCTransfers(scanFrom, scanTo),
        scanETHTransfers(scanFrom, scanTo),
      ]);

      lastScannedBlock = currentBlock;
    }

    // 重新检查 pending 订单的确认数
    for (const [orderId, order] of cryptoOrders) {
      if (order.status === 'pending' && order.txHash) {
        const currentBlock2 = await provider.getBlockNumber();
        const confs = currentBlock2 - order.blockNumber + 1;
        order.confirmations = confs;
        if (confs >= MIN_CONFIRMATIONS) {
          order.status = 'confirmed';
          console.log(`[crypto-watcher] ✅ Order ${orderId} confirmed (late check, ${confs} confs)`);
          try { await upgradeTenant(order); } catch (e) { console.error(e); }
        }
      }
    }
  } catch (err) {
    console.error('[crypto-watcher] mainLoop error:', err.message);
  }
}

// ─── 导出 ───
// 被 app.js 引入: 共享 cryptoOrders，调用 start()
module.exports = {
  cryptoOrders,
  start: () => {
    console.log(`[crypto-watcher] Started. Watching: ${PAYMENT_ADDRESS}`);
    console.log(`[crypto-watcher] RPC: ${RPC_URL}`);
    setInterval(mainLoop, 30_000);
    mainLoop();
  },
};