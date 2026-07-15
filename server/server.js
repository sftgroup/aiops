const app = require('./app');
const PORT = process.env.PORT || 5290;

app.listen(PORT, () => {
  console.log(`🚀 AIOps SAAS server running on port ${PORT}`);

  // 启动链上支付监听器（如果配置了 CRYPTO_PAYMENT_ADDRESS）
  if (process.env.CRYPTO_PAYMENT_ADDRESS && process.env.CRYPTO_RPC_URL) {
    try {
      const watcher = require('./services/crypto-watcher');
      // 共享 billing.js 的 cryptoOrders Map 给 watcher
      if (app._cryptoOrders) watcher.cryptoOrders = app._cryptoOrders;
      watcher.start();
    } catch (err) {
      console.warn('[server] crypto-watcher not available:', err.message);
    }
  }
});
