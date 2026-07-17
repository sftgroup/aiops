# AIOps SAAS — P1 功能代码审查报告 (L1 + L2)

> 审查日期: 2026-06-27  
> 审查范围: P1 新增/修改的 9 个文件  
> 审查级别: L1 表面审查 + L2 逻辑审查

---

## 📊 审查统计

| 分类 | 数量 |
|------|------|
| ❌ 严重问题 (Bug / 安全 / 功能阻断) | 8 |
| ⚠️ 警告 (潜在风险 / 边界处理不足) | 15 |
| 💡 建议 (代码风格 / 可维护性) | 11 |
| **总计** | **34** |

---

## ❌ 严重问题 (Bug / 安全 / 功能阻断)

### 1. 🔴 server/routes/publish.js:60 — `where.id = { in: accountIds }` 类型不安全

```js
// L60-64
let where = { tenantId };
if (accountIds?.length) {
  where.id = { in: accountIds };
}
```

**问题**: Prisma `findMany` 的 `where.id: { in: accountIds }` 要求 `id` 类型必须匹配数据库 schema。当 `accountIds` 为空数组 `[]` 时，`accountIds?.length` 为 `0`（falsy），会跳过这个分支。但如果 `accountIds` 是 `['']`（包含空字符串），则会向 Prisma 传递 `{ in: [''] }`，导致 Prisma 查询可能不会匹配任何记录但不会报错，**静默失败**——用户以为选了账号但实际没有发布。

**修复建议**: 过滤空值
```js
const validIds = (accountIds || []).filter(Boolean);
if (validIds.length) {
  where.id = { in: validIds };
}
```

### 2. 🔴 server/routes/accounts.js:136 — Credentials 加密键名不一致

```js
// L134（创建时加密键名）:
encryptedCreds = {
  encrypted_token: encrypt(credentials.oauth_token),
  encrypted_token_secret: encrypt(credentials.oauth_token_secret || ''),
};

// L162（更新时解密键名）:
const oauthToken = creds.encrypted_token ? decrypt(creds.encrypted_token) : '';
const oauthTokenSecret = creds.encrypted_token_secret ? decrypt(creds.encrypted_token_secret) : '';
```

**问题**: token 存储时键名为 `encrypted_token`，发布和发推文时键名也是 `encrypted_token`，加密解密路径一致，此条表面无问题但要注意：**如果更新路径 `PUT /:id` 中 `credentials` 来自前端且不包含加密前缀键名，则 `updateData.credentials` 会被覆盖为非加密的明文**（L160-163: 仅当 `account.platform === 'twitter' && credentials.oauth_token` 时才加密，而对于非 twitter 直接合并）。这个逻辑是"故意"的，但如果将来 twitter 账号的 credentials 来自前端 `PUT` 请求且不包含 `oauth_token` 字段就绕过加密。

**修复建议**: 在 `PUT` 中对 twitter 平台强制检查 credentials 是否需要加密。

### 3. 🔴 server/routes/ai-media.js:99 — `recordUsage` 吞掉错误只打 log

```js
async function recordUsage(tenantId, userId, resourceType, tokensUsed, meta) {
  try {
    await prisma.usageRecord.create({ ... });
  } catch (e) { console.error('[ai-media] usage record error:', e.message); }
}
```

**问题**: 用量记录失败被静默吞掉。如果 `usageRecord.create` 因为 schema 不匹配（如字段缺失）或数据库不可用而失败，不会上报，导致**用量统计丢失**且**无人感知**。生产环境中配额扣减可能不准确，造成免费使用或错误拒绝。

**修复建议**: 至少记录到日志系统（如 Winston），考虑是否抛出或重试。对于配额功能来说，用量记录是计费的基石，不应静默失败。

### 4. 🔴 server/services/poster-service.js:83-87 — `apiRequest` URL 拼接不安全

```js
function apiRequest(method, pathname, body, apiKey) {
  ...
  const url = new URL(`https://ark.cn-beijing.volces.com${pathname}`);
```

**问题**: `pathname` 来自调用方传入的不完整路径如 `/api/v3/images/generations`，虽然当前调用安全，但函数签名暴露了直接拼接的能力。如果未来有任意用户输入混入 `pathname`（如 `/api/v3/contents/generations/tasks/${userInput}`），可能导致路径遍历或 SSRF。

**修复建议**: 增加校验，确保 `pathname` 以 `/api/v3/` 开头且不包含 `..`。

### 5. 🔴 server/routes/ai-media.js:103 — 海报任务完成后保存 content 但未处理 `prisma.content.create` 失败

```js
genPoster(subject, { ... }, onProgress)
  .then(async (url) => {
    ...
    await prisma.content.create({
      data: { tenantId, userId: userId || null, type: 'poster', ... },
    });
    await recordUsage(tenantId, userId, 'poster', null, { taskId });
  })
```

**问题**: 异步任务链（then/catch）中，`prisma.content.create` 和 `recordUsage` 如果抛异常会进入 `.catch()` 分支，将任务标记为 `failed`（此时海报 URL 已生成但保存失败）。用户看到"失败"但资源其实已经消耗了（API 调用了、费用产生了）。而且 `.catch` 里用的是同一个 `err.message`，可能覆盖掉真实的生成阶段错误信息。

**视频生成同理**（server/routes/ai-media.js:189-203）。

**修复建议**: 在 `.then()` 内部单独 try-catch，对 content 保存失败不改变 task 状态，只打 error log；或使用独立的状态标记。

### 6. 🔴 server/services/seedance-service.js:92-100 — `downloadVideo` redirect 处理递归风险

```js
function downloadVideo(videoUrl, saveDir) {
  return new Promise((resolve, reject) => {
    ...
    https.get(videoUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, (r2) => {
          r2.pipe(file);
          r2.on('end', () => resolve({ path: filepath, filename }));
        });
        return;
      }
      ...
    }).on('error', reject);
  });
}
```

**问题 1**: 重定向只处理一层。如果重定向目标又返回了 3xx，不会继续跟随。应使用循环或 `follow-redirects` 库。  
**问题 2**: 重定向分支的 `r2.on('error', reject)` 缺失——只有外层 `https.get` 注册了 `.on('error', reject)`，重定向请求如果出错（网络中断、超时等）会导致 Promise 永远不 resolve/reject，**内存泄漏**。  
**问题 3**: `https.get` 不设置超时，大文件下载可能永久挂起。

**修复建议**:
```js
// 使用 follow-redirects 或 axios，设置超时
// 至少给所有请求注册 error handler
r2.on('error', reject);
```

### 7. 🔴 server/services/seedance-service.js:63 — `pollTask` 进度计算边界错误

```js
if (onProgress) onProgress({
  round, maxRounds, status,
  progress: Math.round((round / maxRounds) * 100)
});
```

**问题**: 在第 1 轮时 `progress = Math.round((1/120)*100) = 1%`，到第 120 轮时 `progress = Math.round((120/120)*100) = 100%`。但如果在第 120 轮正好返回 `succeeded`，没问题；如果到第 120 轮时超时抛错，前端显示 100% 但实际超时了——**进度与状态不一致**。

**修复建议**: 对轮询完成时使用固定的进度值（如 `progress: Math.min(99, Math.round((round / maxRounds) * 99))`），成功时设为 100%。

### 8. 🔴 panel/src/pages/PublishPage.tsx:72 — API 响应未做 JSON 校验直接 filter

```js
const res = await fetch(apiUrl('/api/publish'), { ... });
const results = await res.json();
const ok = results.filter((r: any) => r.status === 'published').length;
```

**问题**: 如果 API 返回非数组（如 `{ error: '...' }`），`results.filter` 会抛 TypeError，导致整个 `handlePublish` 崩溃，前端显示未捕获的异常而不是友好的错误信息。

**修复建议**:
```js
const results = await res.json();
if (!Array.isArray(results)) {
  throw new Error(results.error || 'Unexpected response');
}
```

---

## ⚠️ 警告 (潜在风险 / 边界处理不足)

### 1. ⚠️ server/routes/accounts.js:30 — 临时 token 存储在内存 Map 中

```js
const requestTokenStore = new Map();
```

文档注释已说明"生产环境建议用 Redis"，属于已知技术债。但需要注意：**Map 在单机多进程模式下不同进程之间不可见**。如果使用 PM2 cluster 模式，用户可能在进程 A 获取 request token，但接入 token 的请求落在进程 B，导致"Invalid oauth_token"。

### 2. ⚠️ server/routes/accounts.js:47-50 — `sanitizeAccount` 使用解构+rest 可能泄露新字段

```js
function sanitizeAccount(account) {
  const { credentials, encryptedToken, encryptedTokenSecret, ...safe } = account;
  return safe;
}
```

**问题**: 如果未来 Prisma schema 新增了 `accessToken` 或 `refreshToken` 等敏感字段，这个解构不会自动排除，会泄露给前端。使用了白名单更安全。

### 3. ⚠️ server/routes/accounts.js:74 — 删除账号使用 `deleteMany` 而非 `delete`

```js
await prisma.account.deleteMany({
  where: { id: req.params.id, tenantId },
});
```

**问题**: `deleteMany` 成功返回 `{ count: 0 }` 当记录不存在时（不会抛异常）。这意味着用户删除一个不存在的账号时不会收到 404，而是得到 `{ ok: true }` 的假成功——**幂等性 vs 用户期望**的权衡，但是否应提示用户该账号不存在？

### 4. ⚠️ server/routes/accounts.js:159 — PUT 更新账号时 `credentials` 合并逻辑可能覆盖加密字段

```js
if (credentials) {
  if (account.platform === 'twitter' && credentials.oauth_token) {
    const mergedCreds = { ...(account.credentials || {}) };
    mergedCreds.encrypted_token = encrypt(credentials.oauth_token);
    ...
  } else {
    updateData.credentials = { ...(account.credentials || {}), ...credentials };
  }
}
```

**问题**: 如果用户通过 PUT 传入 `credentials: {}`（空对象），会进入 else 分支但没有修改 credentials。空对象仍然通过 `if (credentials)` 检查（对象 truthy），但没有实际更新——逻辑正确但语义模糊。

### 5. ⚠️ server/routes/publish.js:61-62 — 发布条件逻辑 `contentId` vs `text` 二选一不严谨

```js
if (!contentId && !text) {
  return res.status(400).json({ error: 'Please select content or enter text' });
}
```

**问题**: 如果 `text` 是纯空格字符串（`"   "`），通过 `!text` 检查为 false（非空字符串），进入发布流程。发布 `"   "` 可能在某些平台成功（空推文），但在 Twitter 会因字符数限制被拒。没有 trim 处理。

### 6. ⚠️ server/routes/publish.js:97 — 发布结果中 `result` 字段不清理敏感数据

```js
result = await resp.json();
success = resp.ok && !!result?.data?.id;
```

**问题**: Twitter API 响应 `result` 完整存入 publishRecord，可能包含完整的 tweet JSON（含用户信息、token 信息等），直接返回给前端且存入数据库。

### 7. ⚠️ server/routes/ai-media.js:60-68 — `callDeepSeek` 无超时、无重试

```js
const resp = await callDeepSeek({ model: 'deepseek-chat', messages: [...] });
const content = resp.choices?.[0]?.message?.content || '';
```

**问题**: 如果 DeepSeek API 超时或返回异常结构（`resp.choices` 为空数组），`content` 为 `''`，前端仍会收到 `{ script: '' }` 的成功响应，用户会看到一个空的优化结果。

### 8. ⚠️ server/routes/ai-media.js:168-170 — 视频主题 `subject` 可能超长存储

```js
const taskState = {
  taskId, step: 'queued', progress: 0, message: '排队中...',
  url: null, error: null, createdAt: Date.now(),
  tenantId, userId,
};
```

`subject` 未截断存储在 taskState 中。如果用户输入 5000 字符的主题，将完整存入内存 Map，可能造成内存压力（尤其多租户并发时）。

### 9. ⚠️ server/services/poster-service.js:75-81 — `downloadImage` 未校验文件内容

```js
const filepath = path.join(OUTPUT_DIR, filename);
fs.writeFileSync(filepath, buf);
resolve(filepath);
```

**问题**: 下载 URL 的内容不校验是否为有效图片，直接写盘。如果 API 返回了 HTML 错误页或 JSON，会写出一个损坏的 `.jpeg` 文件，前端 `<img src>` 将显示破损图标。

### 10. ⚠️ panel/src/pages/VideoPage.tsx:22 — 使用 `localStorage` 持久化任务状态

```js
useEffect(() => {
  try {
    const saved = localStorage.getItem('aiops_video_tasks');
    if (saved) setTasks(JSON.parse(saved));
  } catch {}
  setLoading(false);
}, []);
```

**问题**:  
- `catch {}` 空块吞掉所有 JSON 解析错误，不提供任何反馈。  
- 任务状态本应由服务端作为唯一真相源（尤其多设备场景下），localStorage 会导致不同设备/浏览器看到不同的任务列表。  
- 没有过期清理——已完成/失败的任务会永久堆积在 localStorage 中。

### 11. ⚠️ panel/src/pages/VideoPage.tsx:88-91 — 轮询间隔 3 秒可能导致并发竞争

```js
useEffect(() => {
  if (!activeTaskId || !token) return;
  const interval = setInterval(async () => {
    ...
  }, 3000);
  return () => clearInterval(interval);
}, [activeTaskId, token]);
```

**问题**: 如果组件在 3 秒内被刷新/重新挂载（如 token 变化触发 effect re-run），旧的 interval 可能和新 interval 同时执行。虽然有 cleanup，但 `setState` 闭包捕获旧值可能导致状态更新覆盖。

### 12. ⚠️ panel/src/pages/VideoPage.tsx:120 — `handleDelete` 不调用 API

```js
const handleDelete = (taskId: string) => {
  saveTasks(tasks.filter(t => t.taskId !== taskId));
};
```

**问题**: 只从 localStorage 删除，不调用后端 API 删除。如果后端有持久化的任务 ID 映射或已经分配了资源（如 ID），则服务端资源未被释放。

### 13. ⚠️ panel/src/pages/AccountsPage.tsx:91 — `window.open` 可能被浏览器拦截

```js
window.open(resp.authUrl, '_blank');
```

**问题**: 如果 `window.open` 不在用户直接点击事件的同步调用链中（异步 fetch 回调用后执行），会被浏览器弹窗拦截器阻止。应使用 `window.open` 在用户点击时同步触发，或使用 `noopener`。

### 14. ⚠️ panel/src/pages/AccountsPage.tsx:50-55 — `useAuth` hook 在组件内定义

```js
function useAuth() {
  const [token] = useState<string | null>(localStorage.getItem('aiops_token'));
  return { token, isLoggedIn: !!token };
}
```

**问题**:  
- `useAuth` 在 `AccountsPage.tsx` 和 `PublishPage.tsx` 和 `VideoPage.tsx` 中各自独立重复定义，违反 DRY 原则。  
- 如果未来添加 token 刷新逻辑，需要修改 3 个文件。  
- 作为 hook 形式但 `token` 使用 `useState` 初始化函数（initializer），不是响应式的——用户登录后不刷新页面 `token` 仍为 null。

### 15. ⚠️ panel/src/App.tsx:18 — `pricing` 路由指向 `LandingPage`

```js
<Route path="/pricing" element={<LandingPage />} />
```

**问题**: `/pricing` 路由指向 `LandingPage` 而非专门的定价页面，可能是有意为之但语义不清。如果用户在已登录状态下访问 `/pricing`，LandingPage 可能展示首页而非定价信息。

---

## 💡 建议 (代码风格 / 可维护性)

### 1. 💡 server/routes/accounts.js — Twitter OAuth 配置重复定义

`TWITTER_CONSUMER_KEY`、`TWITTER_CONSUMER_SECRET`、`TWITTER_API`、`twitterOAuth` 在 `accounts.js` 和 `publish.js` 中完全重复。应提取到共享模块如 `server/lib/twitter-oauth.js`。

### 2. 💡 server/routes/accounts.js — 所有错误响应使用 `err.message`，可能泄露内部信息

```js
res.status(500).json({ error: err.message });
```

内部错误消息（如数据库连接失败、Prisma validation error）可能包含表结构、字段名等敏感信息。建议区分开发/生产环境，生产环境返回通用错误消息。

### 3. 💡 server/routes/ai-media.js — `${TASK_TTL}` 和 `30 * 60 * 1000` 重复写入

```js
const TASK_TTL = 30 * 60 * 1000;
setInterval(() => {
  const cutoff = Date.now() - TASK_TTL;
```

而 `accounts.js` 中:
```js
const cutoff = Date.now() - 30 * 60 * 1000; // 硬编码
```

同一个 30 分钟 TTL 出现在两个文件中但一个用常量一个硬编码。

### 4. 💡 server/services/poster-service.js — `DEFAULT_MODEL` 导出但未在 service 外使用

`DEFAULT_MODEL` 在 `apiRequest` 中作为默认值，但作为 module exports 可以被 route 使用。routes 中确实有引用 `require('../services/poster-service')`，保持 OK。

### 5. 💡 server/services/seedance-service.js:23 — `DEFAULT_MODEL` 与实际导出的 MODELS 中仅有一个模型

```js
const MODELS = {
  'doubao-seedance-1-5-pro-251215': 'doubao-seedance-1-5-pro-251215',
};
const DEFAULT_MODEL = 'doubao-seedance-1-5-pro-251215';
```

只有一个模型的情况下 DEFAULT_MODEL 完全可以硬编码，但保留 OK——将来扩展模型更方便。

### 6. 💡 server/services/poster-service.js:121 — `genFilename` 生成使用 `Date.now().toString(36)` 但 `downloadImage` 已用 `Date.now()`

```js
const filename = 'poster_' + Date.now().toString(36) + '.jpeg';
```

```js
// seedance-service.js
const filename = 'seedance_' + Date.now() + '.mp4';
```

命名风格不一致：一个用 base36，一个用原始时间戳。建议统一。

### 7. 💡 panel/src/pages/PublishPage.tsx:164 — `platform` 作为参数但在类型上和方法作用域有 shadow

```js
{Object.entries(platformGroups).map(([platform, accs]) => (
```

`platform` 这个变量名与全局和组件作用域中的潜在变量冲突，但此处是 map 参数，解释器隔离，不影响运行。更清晰的名字如 `platformKey` 更佳。

### 8. 💡 panel/src/pages/AccountsPage.tsx:51 — 空 `useEffect` 依赖数组忽略 eslint 警告

```js
useEffect(() => { loadAccounts(); }, [token]);
```

`loadAccounts` 是 `async` 函数定义在组件内，每次 render 重建引用。`useEffect` 依赖数组 `[token]` 但 `loadAccounts` 变化可能不是预期的。建议将 `loadAccounts` 用 `useCallback` 包裹。

### 9. 💡 panel/src/pages/AccountsPage.tsx — `AddAccountButton` 组件定义与 `AccountsPage` 在同一文件

此组件与 `AccountsPage` 耦合但不在独立文件，文件已较长（>280 行）。建议后续拆分为独立组件文件如 `AddAccountButton.tsx`。

### 10. 💡 panel/src/pages/PublishPage.tsx — `useAuth` 与 `AccountsPage` 中完全相同但不共享

同上，`useAuth` 应提取到共享 hook 文件如 `src/hooks/useAuth.ts`。

### 11. 💡 通用 — 无 `Content-Type` 校验

所有后端路由未校验 `req.headers['content-type']`。如果前端忘记设置 `Content-Type: application/json` 或误发 form-data，`req.body` 可能为空对象 `{}` 导致参数校验不正确。

---

## 📁 各文件问题分布

| 文件 | ❌ 严重 | ⚠️ 警告 | 💡 建议 | 合计 |
|------|:------:|:------:|:------:|:----:|
| server/routes/accounts.js | 1 | 4 | 2 | 7 |
| server/routes/publish.js | 1 | 2 | 0 | 3 |
| server/routes/ai-media.js | 2 | 2 | 1 | 5 |
| server/services/poster-service.js | 1 | 1 | 2 | 4 |
| server/services/seedance-service.js | 2 | 0 | 1 | 3 |
| panel/src/pages/AccountsPage.tsx | 0 | 3 | 3 | 6 |
| panel/src/pages/PublishPage.tsx | 1 | 0 | 2 | 3 |
| panel/src/pages/VideoPage.tsx | 0 | 3 | 1 | 4 |
| panel/src/App.tsx | 0 | 1 | 0 | 1 |
| **合计** | **8** | **15** | **11** | **34** |

---

## 🏷️ 审查结论

**总体评价**: P1 代码在 **核心业务逻辑** 上基本正确，Twitter OAuth PIN Flow 从老项目完整搬运且接口一致。主要问题集中在：

1. **异步任务状态管理**（task 完成后保存失败却标记为失败）
2. **网络请求的容错性**（超时缺失、重定向不完整、error handler 遗漏）
3. **前端状态持久化策略**（localStorage 与服务端不一致）
4. **token/credentials 键名一致性风险**
5. **代码复用度**（useAuth、Twitter OAuth 配置在多个文件重复）

**阻塞发布建议**: 建议优先修复 ❌ 严重问题中的 #5（异步任务状态管理）和 #7（进度计算边界），这两个直接影响用户体验和资源消耗计费。

**后续优化建议**: 提取 `useAuth` 到共享 hooks 目录，Twitter OAuth 配置提取到 `server/lib/twitter-oauth.js`，统一使用 `follow-redirects` 处理 HTTP 重定向。
