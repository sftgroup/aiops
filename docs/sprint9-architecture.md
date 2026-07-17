# Sprint 9 Architecture Analysis

## 1. Rate Limiting

### Design
- **Store**: Redis (already running on port 6380)
- **Library**: `ioredis` (minimal, supports Redis 6+)
- **Algorithm**: Fixed Window Counter per user/token/IP
- **Dimensions**: 
  - Per-user (userId): default 100 req/min for general API, 10 req/min for AI endpoints
  - Per-IP: fallback for unauthenticated routes (login/register), 20 req/min
  - Per-token: token-based access (API key), 60 req/min

### Implementation
```
middleware/rate-limit.js → Express middleware
  - Fixed window: key = `ratelimit:{dim}:{id}:{window}`
  - INCR + EXPIRE (atomic)
  - Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  - Config via env: RATE_LIMIT_ENABLED, RATE_LIMIT_WINDOW_MS (60000), per-route limits
```

### New npm dep: `ioredis`

## 2. IP Whitelist

### Design
- **Store**: Prisma Setting table (key: `ip_whitelist`, value: `{ips: string[], enabled: boolean}`)
- **Scope**: Per-tenant
- **Middleware**: Runs after `authenticate`, before route handler
- **UX**: Settings page "Security" tab (new 4th tab or nested in existing)

### Implementation
```
middleware/ip-whitelist.js → Express middleware
  - Read Setting where key='ip_whitelist'
  - If enabled && req.ip not in ips → 403
  - Cache result in Redis (5 min TTL) to avoid DB hit per request
  - Support CIDR ranges (simple subnet check)
```

### Settings UI
- New "Security" tab on SettingsPage
- List of IPs with add/remove
- Toggle enable/disable
- Validation: valid IPv4/IPv6/CIDR format

## 3. Audit Log

### Design
- **Store**: Prisma (new AuditLog table) — limited volume, queried occasionally
- **Events**: login, logout, login_failed, key_create, key_delete, content_generate, tts_synthesize, profile_update, team_invite, member_remove
- **Schema**: id, tenantId, userId, event, details (JSON), ip, userAgent, createdAt

### Implementation
```
services/audit-service.js → log(tenantId, userId, event, req, details)
lib/audit.js → Prisma AuditLog create (fire-and-forget, non-blocking)
middleware/audit.js → auto-log route events based on route+method
```

### Admin UI (Sprint 10 or later)
- Audit log viewer on Settings page (Security tab)
- Filter by event type, date range, user

## 4. Security Headers

### Design
- **Library**: `helmet` (standard Express security headers)
- Already have CORS configured
- Add: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.

### Implementation
```
server/app.js:
  const helmet = require('helmet')
  app.use(helmet())
  app.use(helmet.contentSecurityPolicy({ ... })) // CSP if needed
```

### New npm dep: `helmet`, `ioredis`

## Route Impact Matrix

| File | Change Type | Details |
|------|------------|---------|
| `server/middleware/rate-limit.js` | NEW | Rate limiter middleware |
| `server/middleware/ip-whitelist.js` | NEW | IP whitelist middleware |
| `server/middleware/audit.js` | NEW | Audit log middleware |
| `server/services/audit-service.js` | NEW | Audit event writer |
| `server/routes/pipeline.js` | MODIFY | Add rate limit + audit to routes |
| `server/routes/content.js` | MODIFY | Add audit logging |
| `server/routes/tts.js` | MODIFY | Add audit logging |
| `server/routes/auth.js` | MODIFY | Add audit logging + rate limit on login |
| `server/routes/settings.js` | MODIFY | Add IP whitelist CRUD |
| `server/app.js` | MODIFY | helmet, audit middleware |
| `server/prisma/schema.prisma` | MODIFY | AuditLog model |
| `server/package.json` | MODIFY | ioredis, helmet |

## Frontend

| File | Change Type | Details |
|------|------------|---------|
| `panel/src/pages/SettingsPage.tsx` | MODIFY | Add Security tab (IP whitelist) |
| `panel/src/lib/settingsClient.ts` | NEW | IP whitelist API client |
| `panel/src/i18n/locales/zh-CN/billing.json` | MODIFY | Security tab strings |
| `panel/src/i18n/locales/en-US/billing.json` | MODIFY | Security tab strings |

## Risk Assessment
- **Redis dependency**: If Redis is down, rate limiter fails OPEN (allow all) — graceful degradation
- **IP whitelist**: Admin lockout risk — always allow localhost (127.0.0.1, ::1)
- **Audit log volume**: Fire-and-forget pattern, no blocking
- **Helmet/CSP**: May break existing frontend if CSP too strict — start permissive
