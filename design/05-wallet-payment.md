# 钱包登录 & 加密货币支付 — 技术方案

## 一、模块

| 模块 ID | 名称 | 类型 | 对应功能 |
|---------|------|------|---------|
| M-001 | 钱包 Nonce 生成 | 后端 | 返回签名消息 |
| M-002 | 钱包登录验证 | 后端 | 验证签名 → JWT |
| M-003 | MetaMask 前端集成 | 前端 | 钱包弹窗 + 签名 |
| M-004 | 加密货币支付 | 后端+前端 | USDC/ETH 付款流程 |

## 二、数据流

```
钱包登录:
  用户点击 MetaMask 按钮
  → GET /api/auth/wallet-nonce?address=0x...
  → 返回 { nonce, message }（SIWE 格式）
  → MetaMask 弹出签名请求
  → 用户签名
  → POST /api/auth/wallet-login { address, signature, message }
  → 后端 ethers.verifyMessage(message, signature) → 比对地址
  → 首次登录自动创建用户 → 返回 JWT token

加密货币支付:
  用户选择套餐
  → POST /api/billing/crypto-checkout { planId, network }
  → 返回 { paymentAddress, amount, currency, expiresAt, orderId }
  → 用户从钱包转账
  → 后端定时/WebSocket监听链上到账
  → 确认后升级用户套餐
```

## 三、API 接口

### GET /api/auth/wallet-nonce
- 参数: address (query)
- 返回: { nonce, message }
- Nonce: 8 字节随机数，60 秒 TTL

### POST /api/auth/wallet-login
- 参数: { address, signature, message }
- 逻辑:
  1. 验证 message 格式（含 nonce + 时间戳）
  2. `ethers.verifyMessage(message, signature)` → 恢复地址
  3. 比对请求地址与恢复地址
  4. 查 DB → 已有用户直接返回 JWT
  5. 新人自动注册 → 返回 JWT

### POST /api/billing/crypto-checkout
- 参数: { planId }
- 逻辑:
  1. 从 PRICES 取 USDC 价格
  2. 生成唯一 orderId
  3. 返回收款地址 + 金额 + 过期时间

### GET /api/billing/crypto-status?orderId=xxx
- 返回: { status, txHash, confirmations }

## 四、数据库变更

无需新增表。已有字段：
- `User.walletAddress` — 钱包地址
- `User.nftPass` — JSON 数组，存储 NFT 资格

新增内存存储：
- `nonceStore` (Map) — nonce → { address, expiresAt }
- `cryptoOrders` (Map/DB) — orderId → { planId, address, amount, expiresAt, status }

## 五、技术栈

| 端 | 技术 |
|----|------|
| 后端签名验证 | ethers v6 (已安装) |
| 链上监管 | USDC transfer event 监听 |
| 前端钱包 | window.ethereum (MetaMask EIP-1193) |
| 支付链 | Ethereum 主网 / Polygon（USDC）|
