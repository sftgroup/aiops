# QA Fix Verification Report

**Date:** 2026-06-26 12:49 GMT+8  
**Reviewed by:** QA Subagent  
**Target:** 5 High-risk fixes by Wayne on `/home/ubuntu/aiops-saas/`

---

## Fix 1: `loadDB` Destructures `createdAt` from Row

**File:** `server/lib/db-adapter.js` — non-settings branch

**Evidence (line ~32):**
```js
const { id, tenantId: tid, userId: uid, createdAt, updatedAt, data, ...rest } = r;
return { id, tenantId: tid, userId: uid, ...rest, ...(data || {}), createdAt: createdAt?.toISOString(), updatedAt: updatedAt?.toISOString() };
```

**Analysis:**
- `createdAt` is explicitly extracted from the Prisma row (`r`), so it does NOT leak into `...rest`.
- `createdAt?.toISOString()` is called on the returned object, ensuring a string representation.
- Same treatment applied to `updatedAt`.

**Verdict:** **[PASS]**

---

## Fix 2: `loadDB('settings')` Requires `tenantId`

**File:** `server/lib/db-adapter.js` — settings branch (lines ~13–22)

**Evidence:**
```js
if (name === 'settings') {
    if (!tenantId) {
      console.warn('db-adapter: loadDB("settings") called without tenantId — returning empty object');
      return {};
    }
    const rows = await prisma.setting.findMany({ where: { tenantId } });
    ...
}
```

**Analysis:**
- When `tenantId` is falsy, the function returns `{}` immediately — no global query.
- A `console.warn` is emitted for observability.
- With a valid `tenantId`, the query filters by `{ tenantId }`, enforcing multi-tenant isolation.

**Verdict:** **[PASS]**

---

## Fix 3: `saveDB('settings')` Uses Transaction

**File:** `server/lib/db-adapter.js` — settings branch (lines ~38–51)

**Evidence:**
```js
if (name === 'settings') {
    if (!tenantId) {
      throw new Error('db-adapter: saveDB("settings") requires tenantId');
    }
    await prisma.$transaction(
      Object.entries(data).map(([key, value]) =>
        prisma.setting.upsert({
          where: { tenantId_key: { tenantId, key } },
          update: { value },
          create: { tenantId, key, value },
        })
      )
    );
    return;
}
```

**Analysis:**
- Uses `prisma.$transaction(...)` wrapping all upserts — atomic, not `for...of`.
- No `tenantId` → throws an explicit `Error` (not silent).
- Correctly uses compound unique constraint `tenantId_key`.

**Verdict:** **[PASS]**

---

## Fix 4: Unknown Collection Throws Error

**File:** `server/lib/db-adapter.js`

**Evidence (loadDB ~line 27):**
```js
const model = MODEL_MAP[name];
if (!model) {
    throw new Error(`db-adapter: unknown collection "${name}"`);
}
```

**Evidence (saveDB ~line 55):**
```js
const model = MODEL_MAP[name];
if (!model) {
    throw new Error(`db-adapter: unknown collection "${name}"`);
}
```

**Analysis:**
- Both `loadDB` and `saveDB` check `MODEL_MAP[name]` after lookup.
- Unknown collection names throw a descriptive `Error` — no silent `undefined` return.

**Verdict:** **[PASS]**

---

## Fix 5: API Key Encryption Comments + `crypto.js`

**File:** `server/prisma/schema.prisma` — User model

**Evidence (schema):**
```prisma
  // API Keys stored encrypted (AES-256-GCM). Decrypt server-side before use.
  // Never return these fields in API responses. Use dedicated key-service for access.
  deepseekKey    String?  @map("deepseek_key") @db.Text
  seedanceApiKey String?  @map("seedance_api_key") @db.Text
  // Encryption key identifier — used for key rotation. 'v1' = AES-256-GCM with server secret.
  keyEncVersion  String?  @default("v1") @map("key_enc_version") @db.VarChar(10)
```

**File:** `server/lib/crypto.js`

**Evidence:**
- File exists at `/home/ubuntu/aiops-saas/server/lib/crypto.js`.
- Syntax check: `node -c` → **PASS** (no syntax errors).
- Exports: `{ encrypt, decrypt }` — both confirmed.
- Runtime round-trip test:
  - Input: `"test-secret-abc"`
  - Encrypted: `"a50d58e3840808064ad6dd69:4f9087..."` (hex-encoded iv:ciphertext:tag)
  - Decrypted: `"test-secret-abc"` — **match confirmed**.
- Algorithm: AES-256-GCM with 96-bit IV, 128-bit auth tag.
- Key derivation: `scryptSync` from `SERVER_SECRET` or `JWT_SECRET`.
- Graceful handling: `decrypt(null)` → `null`, tampered ciphertext → `null`.

**Analysis:**
- `deepseekKey` and `seedanceApiKey` both have encryption documentation comments in the schema.
- `crypto.js` exists, is syntactically valid, and works correctly.
- `encrypt`/`decrypt` exported and verified via round-trip test.

**Verdict:** **[PASS]**

---

## Bonus: MODEL_MAP Completeness

**File:** `server/lib/db-adapter.js` (lines 3–13)

**Actual MODEL_MAP entries:**
| Key | Prisma Model | Present? |
|-----|-------------|----------|
| `users` | `user` | ✅ |
| `contents` | `content` | ✅ |
| `accounts` | `account` | ✅ |
| `team-tasks` | `teamTask` | ✅ |
| `teams` | `team` | ✅ |
| `settings` | `setting` | ✅ |
| `tenants` | `tenant` | ✅ |
| `tenant_members` | `tenantMember` | ✅ |
| `subscriptions` | `subscription` | ✅ |
| `usage_records` | `usageRecord` | ✅ |
| `api_keys` | `apiKey` | ✅ |

**Result:** All **11** entries present (10 listed in task + `users` which is also present). Full coverage of all Prisma models that have corresponding adapter entries.

**Verdict:** **[PASS]**

---

## Summary

| Fix | Description | Status |
|-----|-------------|--------|
| Fix 1 | `loadDB` destructures `createdAt`, ISO conversion | ✅ PASS |
| Fix 2 | `loadDB('settings')` requires `tenantId` | ✅ PASS |
| Fix 3 | `saveDB('settings')` uses `$transaction` | ✅ PASS |
| Fix 4 | Unknown collection throws `Error` | ✅ PASS |
| Fix 5 | API Key encryption comments + `crypto.js` | ✅ PASS |
| Bonus | MODEL_MAP completeness (11 entries) | ✅ PASS |

**Overall: 6/6 PASS. All high-risk fixes verified and confirmed effective.**
