# TEST_SCENARIOS_AT — API 测试

> 项目: AIOps SaaS | 版本: 0.1.0 | 引擎: autotest v2.0
> 测试服务器: 43.156.78.59:5290

## declarations

| 键 | 值 |
|----|-----|
| HOST | http://43.156.78.59:5290 |
| ADMIN_EMAIL | admin@aiops.dev |
| ADMIN_PASSWORD | *** |
| TEST_EMAIL | e2etest_ft@aiops.test |
| TEST_PASSWORD | *** |

## scenarios

### AT-1: 认证（auth）

| AT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| AT-001 | call | curl -s ${HOST}/api/health | 200 | @blocking |
| AT-002 | call | curl -s ${HOST}/api/auth/login -H "Content-Type: application/json" -d '{"email":"${ADMIN_EMAIL}","password":"${ADMIN_PASSWORD}"}' | token | @blocking |
| AT-003 | call | curl -s ${HOST}/api/auth/login -H "Content-Type: application/json" -d '{"email":"${ADMIN_EMAIL}","password":"wrong"}' | 401 | |
| AT-004 | call | curl -s ${HOST}/api/auth/register -H "Content-Type: application/json" -d '{"email":"at_${RANDOM}@test.ai","password":"Test123456","name":"AT Tester"}' | 201 | |
| AT-005 | call | curl -s ${HOST}/api/auth/register -H "Content-Type: application/json" -d '{"email":"${TEST_EMAIL}","password":"Test123456","name":"Dup"}' | 409 | |
| AT-006 | call | curl -s ${HOST}/api/auth/register -H "Content-Type: application/json" -d '{"email":"nopass@test.ai"}' | 400 | |
| AT-007 | call | curl -s ${HOST}/api/auth/me -H "Authorization: Bearer ${JWT}" | user | @depends AT-002 |
| AT-008 | call | curl -s ${HOST}/api/auth/me | 401 | |
| AT-009 | call | curl -s ${HOST}/api/auth/refresh -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-010 | call | curl -s "${HOST}/api/auth/wallet-nonce?address=0x67B6e618fFFC0AF7CD0Ad0909A544F940d033dA5" | 200 | |
| AT-011 | call | curl -s ${HOST}/api/auth/wallet-login -H "Content-Type: application/json" -d '{"address":"0x67B6e618fFFC0AF7CD0Ad0909A544F940d033dA5","signature":"invalid","message":"test"}' | 401 | |
| AT-012 | call | curl -s ${HOST}/api/auth/wallet-nonce -H "Content-Type: application/json" -d '{}' | 400 | |

### AT-2: 个人资料（profile）

| AT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| AT-013 | call | curl -s ${HOST}/api/accounts -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-014 | call | curl -s ${HOST}/api/accounts -H "Authorization: Bearer ${JWT}" -H "Content-Type: application/json" -X PUT -d '{"name":"E2E Renamed"}' | 200 | @depends AT-002 |
| AT-015 | call | curl -s ${HOST}/api/accounts -H "Authorization: Bearer ${JWT}" -H "Content-Type: application/json" -X DELETE | 200 | @depends AT-002 |

### AT-3: 内容生成（content）

| AT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| AT-016 | call | curl -s ${HOST}/api/content/generate -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"topic":"AI benefits","platform":"twitter","tone":"professional","count":1}' | 200 | @depends AT-002 |
| AT-017 | call | curl -s ${HOST}/api/content/generate -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"topic":"crypto trends","platform":"linkedin","tone":"casual","count":2}' | 200 | @depends AT-002 |
| AT-018 | call | curl -s ${HOST}/api/content/generate -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"topic":"中文AI内容","platform":"twitter","tone":"professional","count":1}' | 200 | @depends AT-002 |
| AT-019 | call | curl -s ${HOST}/api/content/generate -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"topic":"test"}' | 400 | @depends AT-002 |
| AT-020 | call | curl -s ${HOST}/api/content/list -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-021 | call | curl -s "${HOST}/api/content/list?page=1&pageSize=5" -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-022 | call | curl -s ${HOST}/api/content/list | 401 | |
| AT-023 | call | curl -s ${HOST}/api/content/platforms -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-024 | call | curl -s ${HOST}/api/content/styles -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |

### AT-4: TTS 语音合成（tts）

| AT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| AT-025 | call | curl -s ${HOST}/api/tts/voices -H "Authorization: Bearer ${JWT}" | voices | @depends AT-002 |
| AT-026 | call | curl -s ${HOST}/api/tts/synthesize -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"text":"Hello world","voice":"en-US-JennyNeural","skipTranslation":true}' | 201 | @depends AT-002 |
| AT-027 | call | curl -s ${HOST}/api/tts/synthesize -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"text":"你好世界","voice":"zh-CN-XiaoxiaoNeural","skipTranslation":true}' | 201 | @depends AT-002 |
| AT-028 | call | curl -s ${HOST}/api/tts/synthesize -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{}' | 400 | @depends AT-002 |
| AT-029 | call | curl -s ${HOST}/api/tts/history -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-030 | call | curl -s ${HOST}/api/tts/voices | 401 | |

### AT-5: 发布管理（publish）

| AT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| AT-031 | call | curl -s ${HOST}/api/publish/records -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-032 | call | curl -s "${HOST}/api/publish/records?page=1&pageSize=5" -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-033 | call | curl -s ${HOST}/api/publish/records | 401 | |

### AT-6: 计费支付（billing）

| AT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| AT-034 | call | curl -s ${HOST}/api/billing/prices | 200 | |
| AT-035 | call | curl -s ${HOST}/api/billing/crypto-checkout -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"planId":"starter"}' | orderId | @depends AT-002 |
| AT-036 | call | curl -s ${HOST}/api/billing/crypto-checkout -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"planId":"pro"}' | TTUSDC | @depends AT-002 |
| AT-037 | call | curl -s ${HOST}/api/billing/crypto-checkout -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"planId":"enterprise"}' | orderId | @depends AT-002 |
| AT-038 | call | curl -s ${HOST}/api/billing/crypto-checkout -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"planId":"invalid"}' | 400 | @depends AT-002 |
| AT-039 | call | curl -s ${HOST}/api/billing/crypto-status -H "Authorization: Bearer ${JWT}" | 400 | @depends AT-002 |
| AT-040 | call | curl -s ${HOST}/api/billing/crypto-checkout | 401 | |

### AT-7: Operator 管理后台（operator）

| AT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| AT-041 | call | curl -s ${HOST}/api/operator/dashboard -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-042 | call | curl -s ${HOST}/api/operator/tenants -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-043 | call | curl -s "${HOST}/api/operator/tenants?page=1&pageSize=5" -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-044 | call | curl -s ${HOST}/api/operator/users -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-045 | call | curl -s "${HOST}/api/operator/users?page=1&pageSize=5" -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-046 | call | curl -s ${HOST}/api/operator/api-keys -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-047 | call | curl -s ${HOST}/api/operator/api-keys -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -X PUT -d '{"service":"deepseek","key":"sk-test-key-for-autotest"}' | 200 | @depends AT-002 |
| AT-048 | call | curl -s ${HOST}/api/operator/settings -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-049 | call | curl -s ${HOST}/api/operator/audit-logs -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-050 | call | curl -s ${HOST}/api/operator/dashboard | 401 | |

### AT-8: AI 媒体（ai-media）

| AT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| AT-051 | call | curl -s ${HOST}/api/ai-media/poster/models -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-052 | call | curl -s ${HOST}/api/ai-media/poster/sizes -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-053 | call | curl -s ${HOST}/api/ai-media/poster/styles -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
| AT-054 | call | curl -s ${HOST}/api/ai-media/poster/script -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"subject":"Product launch","style":"modern"}' | 200 | @depends AT-002 |
| AT-055 | call | curl -s ${HOST}/api/ai-media/poster/generate -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"subject":"Product launch","style":"modern"}' | 200 | @depends AT-002 |
| AT-056 | call | curl -s ${HOST}/api/ai-media/video/script -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"subject":"sunset beach"}' | 200 | @depends AT-002 |
| AT-057 | call | curl -s ${HOST}/api/ai-media/video/generate -H "Content-Type: application/json" -H "Authorization: Bearer ${JWT}" -d '{"prompt":"sunset beach"}' | 200 | @depends AT-002 |
| AT-058 | call | curl -s ${HOST}/api/ai-media/video/models -H "Authorization: Bearer ${JWT}" | 200 | @depends AT-002 |
