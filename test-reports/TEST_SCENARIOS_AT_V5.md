# Aiops SAAS — V5 AT (API Test) 场景 P1

> 版本: V5-P1 | 测试服务器: http://43.156.78.59:5290

## 测试环境
- 测试服务器: http://43.156.78.59:5290
- Admin: admin@aiops.dev / ***
- 测试用户: testuser / Test1234!

## P1 场景 (F1-F5, 核心功能 API)

### AT-F1-S01: 邮箱注册 API
- **入口:** `POST /api/auth/register`
- **步骤:**
  1. 创建测试用户: `curl -X POST http://43.156.78.59:5290/api/auth/register -H 'Content-Type:application/json' -d '{"username":"v5test1","email":"v5test1@test.com","password":"Test1234!"}'`
  2. 验证返回 JWT token + user 对象
- **期望:** 200 `{token,user:{username:"v5test1",role:"user"}}`
- **异常:** 409 重复注册, 400 字段校验失败

### AT-F1-S02: 邮箱登录 API
- **入口:** `POST /api/auth/login`
- **步骤:** `curl -X POST .../api/auth/login -d '{"email":"v5test1","password":"Test1234!"}'`
- **期望:** 200 `{token,user:{...}}`
- **异常:** 401 Invalid credentials, 403 Account suspended

### AT-F1-S03: 获取当前用户 (Auth Me)
- **入口:** `GET /api/auth/me`
- **前置:** 携带有 token
- **步骤:** `curl .../api/auth/me -H 'Authorization:Bearer <TOKEN>'`
- **期望:** 200 返回 user + tenant 信息

### AT-F2-S01: 获取 Wallet Nonce
- **入口:** `GET /api/auth/wallet-nonce?address=0x67B6e618fFFC0AF7CD0Ad0909A544F940d033dA5`
- **期望:** `{nonce, message:"Aiops SAAS wants you to sign in..."}`

### AT-F2-S02: 钱包登录
- **入口:** `POST /api/auth/wallet-login`
- **步骤:** 获取 nonce → 用 ethers 签名 → 提交
- **期望:** 200 `{token}` 或自动创建账号

### AT-F2-S03: 首次钱包登录自动创建
- **入口:** `POST /api/auth/wallet-login`
- **步骤:** 用全新地址 + 有效签名
- **期望:** 200 自动创建 user+tenant, username=shortAddress

### AT-F3-S01: 内容生成 API
- **入口:** `POST /api/content/generate`
- **前置:** 已登录 + API Key 已配置
- **步骤:** `curl .../api/content/generate -H 'Authorization:Bearer <TOKEN>' -d '{"platform":"twitter","topic":"AI testing","style":"Professional"}'`
- **期望:** 200 `{id,content,platform,tokensUsed}`
- **异常:** 402 Quota exceeded

### AT-F3-S02: 内容列表 API
- **入口:** `GET /api/content/list`
- **期望:** 200 返回生成内容数组

### AT-F3-S03: 内容 CRUD
- **步骤:** `GET /api/content/:id` / `PATCH /api/content/:id` / `DELETE /api/content/:id`
- **期望:** 200 正常 CRUD

### AT-F3-S04: 配额查询 API
- **入口:** `GET /api/quota/summary`
- **期望:** 200 `{quota:{content:{used,total},tts:{...},video:{...},tokens:{...}}}`

### AT-F4-S01: TTS 合成 API
- **入口:** `POST /api/tts/synthesize`
- **步骤:** `curl .../api/tts/synthesize -d '{"text":"Hello world","voiceId":"default"}'`
- **期望:** 200 `{audioUrl,voiceId}`
- **异常:** 402 Quota exceeded

### AT-F4-S02: TTS 历史 API
- **入口:** `GET /api/tts/history`
- **期望:** 200 返回历史列表

### AT-F4-S03: TTS 翻译 API
- **入口:** `POST /api/tts/translate`
- **步骤:** `curl .../api/tts/translate -d '{"text":"你好","sourceLang":"zh","targetLang":"en"}'`
- **期望:** 200 `{translatedText:...}`

### AT-F5-S01: 社媒账号 CRUD
- **入口:** `GET /api/accounts` / `POST /api/accounts`
- **步骤:** 创建/读取/编辑/删除账号
- **期望:** 200 CRUD 完整

### AT-F5-S02: 一键发布 API
- **入口:** `POST /api/publish`
- **步骤:** `curl .../api/publish -d '{"contentId":"...","accountId":"..."}'`
- **期望:** 200 创建发布记录

---

## AT-F5-S03: 发布记录 API
- **入口:** `GET /api/publish/records`
- **期望:** 200 返回发布记录列表

## 执行说明
- 所有 API 测试用 curl
- Token 从注册/登录获取
- 记录每个端点结果到 test-reports/E2E_TEST_REPORT_V5.md
- 结束前 check 测试服 health
