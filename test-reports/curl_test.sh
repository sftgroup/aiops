#!/bin/bash
# AIOps SAAS E2E Test Script
# Server: 43.156.78.59:5290
# Generated: 2026-06-29

BASE="http://43.156.78.59:5290/api"

# ============================================
# AT-001: Auth - User Registration
# ============================================
echo "=== AT-001: Auth - User Registration ==="

echo "--- AT-001-01: Normal Registration ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"tester_01","password":"Tester1234!","email":"tester01@aiops.test"}'

echo ""
echo "--- AT-001-02: Email Optional Registration ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"tester_02","password":"Tester2234!","email":"tester02@aiops.test"}'

echo ""
echo "--- AT-001-03: Short Username <3 chars ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"ab","password":"Test1234!"}'

echo ""
echo "--- AT-001-04: Weak Password <8 chars ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"test03","password":"1234567"}'

echo ""
echo "--- AT-001-05: Password No Uppercase ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"test04","password":"test1234!"}'

echo ""
echo "--- AT-001-06: Password No Number ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"test05","password":"TestTest!"}'

echo ""
echo "--- AT-001-07: Invalid Email ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"test06","password":"Test1234!","email":"not-an-email"}'

echo ""
echo "--- AT-001-08: Duplicate Username ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"tester_01","password":"Test1234!","email":"dup@aiops.test"}'

echo ""
echo "--- AT-001-09: Empty Request Body ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{}'

echo ""
echo ""

# ============================================
# AT-002: Auth - User Login
# ============================================
echo "=== AT-002: Auth - User Login ==="

echo "--- AT-002-01: Username Login ---"
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tester_01","password":"Tester1234!"}')
echo "$LOGIN_RESP"
TOKEN=$(echo "$LOGIN_RESP" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
echo "TOKEN=$TOKEN"

echo ""
echo "--- AT-002-02: Email Login ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"tester01@aiops.test","password":"Tester1234!"}'

echo ""
echo "--- AT-002-03: Wrong Password ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tester_01","password":"wrong"}'

echo ""
echo "--- AT-002-04: Non-existent User ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"noexist","password":"x"}'

echo ""
echo "--- AT-002-05: Empty Fields ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"","password":""}'

echo ""
echo "--- AT-002-06: Get Profile (valid token) ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/auth/me" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-002-07: Invalid Token ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/auth/me" \
  -H "Authorization: Bearer invalid.jwt.token"

echo ""
echo "--- AT-002-08: No Token ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/auth/me"

echo ""
echo ""

# ============================================
# AT-003: Auth - Wallet Login
# ============================================
echo "=== AT-003: Auth - Wallet Login ==="

WALLET="0x1234567890AbcdEF1234567890aBcDeF12345678"

echo "--- AT-003-01: Get Nonce ---"
NONCE_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE/auth/wallet-nonce?address=$WALLET")
echo "$NONCE_RESP"
NONCE=$(echo "$NONCE_RESP" | head -1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('nonce',''))" 2>/dev/null)
echo "NONCE=$NONCE"

echo ""
echo "--- AT-003-02: Empty Address ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/auth/wallet-nonce"

echo ""
echo "--- AT-003-03: Invalid Address Format ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/auth/wallet-nonce?address=not-a-wallet"

echo ""
echo "--- AT-003-04: Wallet Login (invalid sig, expected 401) ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/wallet-login" \
  -H "Content-Type: application/json" \
  -d "{\"address\":\"$WALLET\",\"signature\":\"0xfake\",\"nonce\":\"$NONCE\"}"

echo ""
echo "--- AT-003-05: Invalid Signature ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/wallet-login" \
  -H "Content-Type: application/json" \
  -d "{\"address\":\"0x1234567890AbcdEF1234567890aBcDeF12345678\",\"signature\":\"0xbad\",\"nonce\":\"some-nonce\"}"

echo ""
echo ""

# ============================================
# AT-004: Content Generation
# ============================================
echo "=== AT-004: Content Generation ==="

echo "--- AT-004-01: Normal Generate (authenticated) ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/content/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"topic":"AI in 2026","style":"专业"}'

echo ""
echo "--- AT-004-02: Unauthenticated ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/content/generate" \
  -H "Content-Type: application/json" \
  -d '{"topic":"test","style":"专业"}'

echo ""
echo "--- AT-004-03: Empty Topic ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/content/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"topic":"","style":"专业"}'

echo ""
echo "--- AT-004-04: Get List ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/content/list" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo ""

# ============================================
# AT-005: TTS
# ============================================
echo "=== AT-005: TTS ==="

echo "--- AT-005-01: Normal Synthesize ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/tts/synthesize" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text":"你好世界","voice":"zh-CN-XiaoxiaoNeural"}'

echo ""
echo "--- AT-005-02: Empty Text ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/tts/synthesize" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text":"","voice":"zh-CN-XiaoxiaoNeural"}'

echo ""
echo "--- AT-005-03: Voice List ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/tts/voices" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-005-04: TTS History ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/tts/list" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-005-05: Audio Download (filename from synthesize) ---"
# Get filename from synthesize response if available
curl -s -w "\n%{http_code}" -X GET "$BASE/tts/audio/test.mp3" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-005-06: Path Traversal ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/tts/audio/../../../etc/passwd" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-005-07: Unauthenticated ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/tts/synthesize" \
  -H "Content-Type: application/json" \
  -d '{"text":"test","voice":"zh-CN-XiaoxiaoNeural"}'

echo ""
echo ""

# ============================================
# AT-006: Dashboard
# ============================================
echo "=== AT-006: Dashboard ==="

echo "--- AT-006-01: Overview ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/dashboard/overview" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-006-02: Trend ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/dashboard/trend?days=7" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-006-03: Quota ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/dashboard/quota" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-006-04: Unauthenticated ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/dashboard/overview"

echo ""
echo "--- AT-006-05: Negative Days ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/dashboard/trend?days=-1" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo ""

# ============================================
# AT-007: Profile
# ============================================
echo "=== AT-007: Profile ==="

echo "--- AT-007-01: Get Profile ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/profile" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-007-02: Update Profile ---"
curl -s -w "\n%{http_code}" -X PUT "$BASE/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"新名字"}'

echo ""
echo "--- AT-007-03: Change Password ---"
curl -s -w "\n%{http_code}" -X PUT "$BASE/profile/password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"currentPassword":"Tester1234!","newPassword":"NewPass1234!"}'

echo ""
echo "--- AT-007-04: Wrong Current Password ---"
curl -s -w "\n%{http_code}" -X PUT "$BASE/profile/password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"currentPassword":"wrong","newPassword":"Valid1!"}'

echo ""
echo "--- AT-007-07: Weak New Password ---"
curl -s -w "\n%{http_code}" -X PUT "$BASE/profile/password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"currentPassword":"NewPass1234!","newPassword":"weak"}'

echo ""
echo ""

# ============================================
# AT-008: Team Management
# ============================================
echo "=== AT-008: Team Management ==="

echo "--- AT-008-01: Member List ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/team/members" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-008-02: Invite Member ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/team/invite" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email":"newmember@aiops.test","role":"editor"}'

echo ""
echo "--- AT-008-03: Duplicate Invite ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/team/invite" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email":"newmember@aiops.test","role":"editor"}'

echo ""
echo "--- AT-008-04: Invalid Role ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/team/invite" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email":"test@aiops.test","role":"superadmin"}'

echo ""
echo ""

# ============================================
# AT-009: Billing
# ============================================
echo "=== AT-009: Billing ==="

echo "--- AT-009-01: Get Prices (public) ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/billing/prices"

echo ""
echo "--- AT-009-02: Checkout ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/billing/checkout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"plan":"pro"}'

echo ""
echo "--- AT-009-03: Invalid Plan ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/billing/checkout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"plan":"platinum"}'

echo ""
echo "--- AT-009-04: Billing Portal ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/billing/portal" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-009-05: Webhook (no signature) ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/billing/webhook" \
  -H "Content-Type: application/json" \
  -d '{}'

echo ""
echo ""

# ============================================
# AT-010: Settings / API Key Vault
# ============================================
echo "=== AT-010: Settings / API Key Vault ==="

echo "--- AT-010-01: Get Keys (masked) ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/settings/keys" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-010-02: Add Key ---"
curl -s -w "\n%{http_code}" -X PUT "$BASE/settings/keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"service":"deepseek","key":"sk-test123456789"}'

echo ""
echo "--- AT-010-03: Empty Key ---"
curl -s -w "\n%{http_code}" -X PUT "$BASE/settings/keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"service":"deepseek","key":""}'

echo ""
echo "--- AT-010-04: Invalid Service ---"
curl -s -w "\n%{http_code}" -X PUT "$BASE/settings/keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"service":"unknown","key":"x"}'

echo ""
echo "--- AT-010-06: IP Whitelist Query ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/settings/ip-whitelist" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-010-07: IP Whitelist Set ---"
curl -s -w "\n%{http_code}" -X PUT "$BASE/settings/ip-whitelist" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"ips":["1.2.3.4"]}'

echo ""
echo "--- AT-010-08: Invalid IP ---"
curl -s -w "\n%{http_code}" -X PUT "$BASE/settings/ip-whitelist" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"ips":["abc"]}'

echo ""
echo ""

# ============================================
# AT-011: Quota System
# ============================================
echo "=== AT-011: Quota System ==="

echo "--- AT-011-01: Quota Summary ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/quota/summary" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo ""

# ============================================
# AT-012: Pipeline Status
# ============================================
echo "=== AT-012: Pipeline Status ==="

echo "--- AT-012-01: Service Status ---"
curl -s -w "\n%{http_code}" -X GET "$BASE/pipeline/status" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "--- AT-012-02: Validate Key ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/pipeline/validate-key" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"service":"deepseek"}'

echo ""
echo "--- AT-012-03: Invalid Service ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/pipeline/validate-key" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"service":"abc"}'

echo ""
echo ""

# ============================================
# AT-013: CORS
# ============================================
echo "=== AT-013: CORS ==="

echo "--- AT-013-01: Valid Origin Preflight ---"
curl -s -w "\n%{http_code}" -X OPTIONS "$BASE/auth/login" \
  -H "Origin: http://43.156.78.59:8080" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"

echo ""
echo "--- AT-013-02: Invalid Origin ---"
curl -s -w "\n%{http_code}" -X OPTIONS "$BASE/auth/login" \
  -H "Origin: http://evil.com" \
  -H "Access-Control-Request-Method: POST"

echo ""
echo ""

# ============================================
# AT-014: Security Headers
# ============================================
echo "=== AT-014: Security Headers ==="

echo "--- AT-014: All Security Headers ---"
curl -s -I "$BASE/" 2>/dev/null | head -30

echo ""
echo ""

# ============================================
# AT-015: Input/Injection
# ============================================
echo "=== AT-015: Input/Injection ==="

echo "--- AT-015-01: SQL Injection ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin\047--","password":"Test1234!"}'

echo ""
echo "--- AT-015-02: XSS Username ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"<script>alert(1)</script>","password":"Test1234!"}'

echo ""
echo "--- AT-015-03: XSS Content Topic ---"
curl -s -w "\n%{http_code}" -X POST "$BASE/content/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"topic":"<img src=x onerror=alert(1)>","style":"专业"}'

echo ""
echo "--- AT-015-04: Sensitive Paths ---"
echo "GET /.env:"
curl -s -w "\n%{http_code}" -X GET "http://43.156.78.59:5290/.env"
echo ""
echo "GET /robots.txt:"
curl -s -w "\n%{http_code}" -X GET "http://43.156.78.59:5290/robots.txt"
echo ""
echo "GET /.git/HEAD:"
curl -s -w "\n%{http_code}" -X GET "http://43.156.78.59:5290/.git/HEAD"
echo ""
echo "GET /node_modules/:"
curl -s -w "\n%{http_code}" -X GET "http://43.156.78.59:5290/node_modules/"

echo ""
echo ""

# ============================================
# SC-09: Health Check
# ============================================
echo "=== SC-09: Health Check ==="
curl -s -w "\n%{http_code}" -X GET "$BASE/health"

echo ""
echo "=== ALL TESTS COMPLETE ==="
