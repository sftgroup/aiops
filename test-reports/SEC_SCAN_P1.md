# SEC_SCAN_P1 — 依赖 + CVE + 配置审计
Started: Wed Jul  1 10:38:37 AM CST 2026

## 1. npm audit
```json
{
  "auditReportVersion": 2,
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 0,
      "moderate": 0,
      "high": 0,
      "critical": 0,
      "total": 0
    },
    "dependencies": {
      "prod": 176,
      "dev": 0,
      "optional": 0,
      "peer": 0,
      "peerOptional": 0,
      "total": 175
    }
  }
}
```

## 2. Package versions (CVE reference)
```
@prisma/client: NOT_INSTALLED (requested: ^6.0.0)
bcryptjs: 2.4.3 (requested: ^3.0.3)
cors: 2.8.6 (requested: ^2.8.6)
ethers: NOT_INSTALLED (requested: ^6.13.0)
express: 4.22.2 (requested: ^4.21.0)
helmet: NOT_INSTALLED (requested: ^8.2.0)
ioredis: NOT_INSTALLED (requested: ^5.11.1)
jsonwebtoken: 9.0.3 (requested: ^9.0.3)
mammoth: NOT_INSTALLED (requested: ^1.12.0)
multer: 1.4.5-lts.2 (requested: ^2.2.0)
oauth-1.0a: 2.2.6 (requested: ^2.2.6)
stripe: NOT_INSTALLED (requested: ^17.0.0)
ws: 8.21.0 (requested: ^8.18.0)
prisma: NOT_INSTALLED (requested: ^6.0.0)
```

## 3. Known CVE check for key deps
| Package | Version | Known CVEs | Fix Version |
|---------|---------|------------|-------------|
| bcryptjs | 2.4.3 | CVE-2024-? (check), bcryptjs 2.4.3 may have timing issues; also NPM shows bcryptjs@2.4.3 but package.json wants ^3.0.3 = VERSION MISMATCH | See column |
| express | 4.22.2 | Multiple: CVE-2024-29041 (<4.19.0 open redirect), CVE-2024-43796 (<4.20.0 path traversal), CVE-2024-45590 (<4.21.0 DoS) | See column |
| jsonwebtoken | 9.0.3 | CVE-2022-23529 (RCE <9.0.0), CVE-2022-23539 (<9.0.0), CVE-2022-23540 (<9.0.0), CVE-2022-23541 (<9.0.0) | See column |
| cors | 2.8.6 | No known CVEs. Misconfig risk: wildcard origin | See column |
| helmet | N/A | No critical CVEs for v8.x | See column |
| multer | 1.4.5-lts.2 | CVE-2022-24434 (DoS <1.4.4-lts.1) | See column |
| ws | 8.21.0 | CVE-2024-37890 (DoS <8.17.1), CVE-2024-??? (DoS <8.18.0) | See column |
| ethers | 6.17.0 | Check ethers v6.x changelog | See column |
| ioredis | N/A | Check for Redis-related vulns | See column |
| stripe | N/A | Stripe SDK — API key exposure risk | See column |

## 4. Hardcoded Secrets / Sensitive Config
```
=== .env file contains secrets ===
5
Lines with secrets (masked):
5:JWT_SECRET=***MASKED***
9:ENCRYPTION_KEY=***MASKED***
10:VAULT_KEY=***MASKED***
14:DEEPSEEK_API_KEY=***MASKED***
24:ARK_API_KEY=***MASKED***

=== Code grep for hardcoded secrets ===
./services/ai-proxy.js:13:const DEEPSEEK_KEY =***MASKED***
./services/deepseek.js:15:const DEEPSEEK_KEY =***MASKED***
./poster-api.cjs:27:    return settings.seedance_api_key || process.env.SEEDANCE_API_KEY || process.env.ARK_API_KEY || '';
./poster-api.cjs:29:    return process.env.SEEDANCE_API_KEY || process.env.ARK_API_KEY || '';
./middleware/auth.cjs:7:  const secret =***MASKED***
./middleware/auth.cjs:9:    throw new Error('JWT_SECRET not set; refusing to start with insecure fallback');
./server.cjs:76:        const decoded =***MASKED***
./server.cjs:239:if (!process.env.JWT_SECRET) {
./server.cjs:240:  console.error('FATAL: JWT_SECRET is not set. Set it in .env or environment variables.');
./server.cjs:242:  throw new Error('JWT_SECRET is not configured');
./server.cjs:250:  console.warn('WARN: TWITTER_CONSUMER_KEY/SECRET not set. Twitter OAuth will fail.');
./test-wan-video.js:6: *   WAN_API_KEY=***MASKED***
./test-wan-video.js:7: * (or set WAN_API_KEY in .env)
./test-wan-video.js:16:const API_KEY =***MASKED***
./test-wan-video.js:20:if (!API_KEY) {
./test-wan-video.js:21:  console.error('❌ WAN_API_KEY not set.');
./test-wan-video.js:22:  console.error('   Usage: WAN_API_KEY=***MASKED***
./test-wan-video.js:23:  console.error('   Or add WAN_API_KEY=***MASKED***
./test-wan-video.js:36:        'Authorization': `Bearer ${API_KEY}`,
./test-wan-video.js:70:  console.log(`🔑 API Key: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}`);
./utils/jwt.js:4:const JWT_SECRET =***MASKED***
./utils/jwt.js:10:if (!JWT_SECRET) {
./utils/jwt.js:11:  console.error('[FATAL] JWT_SECRET is not set. Server cannot start.');
./utils/jwt.js:12:  throw new Error('JWT_SECRET environment variable is required');
./utils/jwt.js:17:  return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
./utils/jwt.js:22:  return jwt.sign({ ...payload, jti, type: 'refresh' }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
./utils/jwt.js:26:  const decoded =***MASKED***
./utils/jwt.js:66:  JWT_SECRET, JWT_EXPIRES_IN,
./jwt.js:3:const JWT_SECRET =***MASKED***
./jwt.js:6:if (!JWT_SECRET) {
```

## 5. .env vs .env.example comparison
```diff
5c5
< JWT_SECRET="your-jwt-secret-change-me"
---
> JWT_SECRET="f9b8c7d4581ef1226e72efec9fe5b07be69793e9dd5ae7f7e8dd1d26c40f1984"
9,10c9,10
< ENCRYPTION_KEY="your-64-char-hex-encryption-key-change-me-32bytes"
< VAULT_KEY="your-vault-key-change-me"
---
> ENCRYPTION_KEY="3c63261efb83e488741fc29b4a250ba9b50837482e18d3fb08831f932e6bd4fc"
> VAULT_KEY="saas-vault-key-2026-change-me-32b"
14c14
< DEEPSEEK_API_KEY=sk-your-deepseek-api-key
---
> DEEPSEEK_API_KEY=sk-ccc4185e87c94590bbad3b57bc91740f
24c24
< ARK_API_KEY=ark-new-key-test-12345
---
> ARK_API_KEY=ark-1d40b645-589a-4150-99cd-1b7474ecd9b1-4cc52
28,34c28
< ANNOUNCEMENT=System maintenance tonight
< 
< # ─── Crypto Payment ───
< # Ethereum mainnet / Polygon wallet address to receive USDC/ETH payments
< CRYPTO_PAYMENT_ADDRESS=0x0000000000000000000000000000000000000000
< # RPC endpoint for monitoring on-chain payments (Infura/Alchemy/Ankr)
< CRYPTO_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
---
> ANNOUNCEMENT="System maintenance tonight"
```

## 6. npm audit stderr (package mismatches)
```
├── UNMET DEPENDENCY @prisma/client@^6.0.0
├── bcryptjs@2.4.3 invalid: "^3.0.3" from the root project
├── UNMET DEPENDENCY helmet@^8.2.0
├── UNMET DEPENDENCY ioredis@^5.11.1
├── UNMET DEPENDENCY mammoth@^1.12.0
├── multer@1.4.5-lts.2 invalid: "^2.2.0" from the root project
├── UNMET DEPENDENCY prisma@^6.0.0
├── UNMET DEPENDENCY stripe@^17.0.0
npm error missing: @prisma/client@^6.0.0, required by aiops-saas-server@0.1.0
npm error invalid: bcryptjs@2.4.3 /home/ubuntu/aiops/server/node_modules/bcryptjs
npm error missing: helmet@^8.2.0, required by aiops-saas-server@0.1.0
npm error missing: ioredis@^5.11.1, required by aiops-saas-server@0.1.0
npm error missing: mammoth@^1.12.0, required by aiops-saas-server@0.1.0
npm error invalid: multer@1.4.5-lts.2 /home/ubuntu/aiops/server/node_modules/multer
npm error missing: prisma@^6.0.0, required by aiops-saas-server@0.1.0
npm error missing: stripe@^17.0.0, required by aiops-saas-server@0.1.0
```

SPAWN 1 complete: Wed Jul  1 10:38:39 AM CST 2026
