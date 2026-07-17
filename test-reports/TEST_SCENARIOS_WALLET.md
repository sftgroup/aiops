# TEST_SCENARIOS.md — 钱包登录 & 加密货币支付

## CT (Contract Test) — 无合约变更，跳过

## AT (API Test)

### AT-001 | 获取钱包 Nonce
- 方法: curl GET
- 地址: `GET /api/auth/wallet-nonce?address=0x67B6e618fFFC0AF7CD0Ad0909A544F940d033dA5`
- 预期: HTTP 200, `{ nonce, message }`, message 含 SIWE 格式

### AT-002 | 获取钱包 Nonce（无效地址）
- 方法: curl GET
- 地址: `GET /api/auth/wallet-nonce?address=0xinvalid`
- 预期: HTTP 400, `Valid wallet address is required`

### AT-003 | 钱包登录（有效签名）
- 方法: curl POST
- 前置: AT-001 获取 nonce + ethers 签名
- 地址: `POST /api/auth/wallet-login`
- body: `{ address, signature, message, nonce }`
- 预期: HTTP 200, `{ token, user: { walletAddress, name, plan } }`

### AT-004 | 钱包登录（无效签名）
- 方法: curl POST
- 地址: `POST /api/auth/wallet-login`
- body: `{ address: "0x67B6...", signature: "0xbad", message: "test" }`
- 预期: HTTP 401, `Invalid signature`

### AT-005 | 钱包登录（Nonce 过期）
- 方法: curl POST
- 前置: 使用已过期的 nonce
- 预期: HTTP 401, `Nonce expired or invalid`

### AT-006 | 钱包登录（地址不匹配）
- 方法: curl POST
- 前置: nonce 绑定地址 A，用地址 B 的签名尝试
- 预期: HTTP 401, `Nonce address mismatch`

### AT-007 | 钱包重复登录（已有用户）
- 方法: curl POST
- 前置: AT-003 已注册用户
- 地址: 再次用同一钱包签名登录
- 预期: HTTP 200, token, 返回已有用户（不重复注册）

### AT-008 | 加密货币创建订单
- 方法: curl POST
- 前置: 已登录 + CRYPTO_PAYMENT_ADDRESS 已配置
- 地址: `POST /api/billing/crypto-checkout`
- body: `{ planId: "starter" }`
- 预期: HTTP 200, `{ orderId, paymentAddress, amount: 29, currency: "USDC" }`

### AT-009 | 加密货币创建订单（无效套餐）
- 方法: curl POST
- 地址: `POST /api/billing/crypto-checkout`
- body: `{ planId: "invalid" }`
- 预期: HTTP 400

### AT-010 | 查询订单状态
- 方法: curl GET
- 前置: AT-008 创建订单
- 地址: `GET /api/billing/crypto-status?orderId=xxx`
- 预期: HTTP 200, `{ orderId, status: "pending", txHash: null }`

## FT (Frontend Test)

### FT-001 | LoginPage MetaMask 按钮渲染
- 方法: browser snapshot
- URL: `http://43.156.78.59:5290/login`
- 预期: "MetaMask 钱包登录" 按钮可见，橘色渐变样式

### FT-002 | MetaMask 按钮点击（无钱包）
- 方法: browser click
- 前置: window.ethereum 不存在
- 预期: 错误提示 "未检测到 MetaMask，请先安装钱包插件"

### FT-003 | MetaMask 按钮点击（拒绝连接）
- 方法: browser click
- 前置: window.ethereum 存在但拒绝授权
- 预期: 错误提示 "已取消钱包连接"

### FT-004 | MetaMask 登录成功后跳转
- 方法: browser evaluate 模拟完整流程
- 预期: window.location.href = '/dashboard'

### FT-005 | OR 分隔线渲染
- 方法: browser snapshot
- URL: `http://43.156.78.59:5290/login`
- 预期: MetaMask 按钮和 Email 表单之间有 "OR" 分隔线

## QA (QA 检查项)

### QA-001 | 钱包地址规范化
- 检查: authController.getWalletNonce + walletLogin
- 预期: uniform ethers.getAddress() 规范化为 checksummed 地址

### QA-002 | Nonce 安全
- 检查: 一次性使用（用完删除）、60 秒 TTL、5 分钟清理
- 预期: nonceStore.delete(nonce) / expiresAt < Date.now() 返回过期

### QA-003 | 自动注册逻辑
- 检查: 首次钱包登录时自动创建 user + tenant
- 预期: username = 短地址, passwordHash 为随机哈希

### QA-004 | Crypto 订单过期
- 检查: 10 分钟定时器清理
- 预期: pending → expired 状态转换

## SECURITY (安全检查项)

### SEC-001 | 签名重放攻击
- 检查: 同一签名能否重复使用
- 预期: nonce 一次使用后失效
- 当前实现: ✅ nonceStore.delete(nonce)

### SEC-002 | 签名消息注入
- 检查: 能否伪造签名消息
- 预期: verifyMessage 确保签名与消息一一对应

### SEC-003 | 私钥不暴露
- 检查: 私钥是否出现在日志/响应中
- 预期: 只返回钱包地址，不返回私钥

### SEC-004 | Crypto 支付地址验证
- 检查: 收款地址是否可被篡改
- 预期: paymentAddress 从环境变量读取，不接受客户端传入
