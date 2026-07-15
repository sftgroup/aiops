import { AIOpsClient, AIOpsError } from "../src/index.js";

function mockResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

const BASE_URL = "https://api.test.aiops.com";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${msg}`);
  }
}

async function assertThrows(fn: () => unknown, expectedCode: string, msg: string) {
  try {
    await fn();
    failed++;
    console.log(`  ✗ FAIL: ${msg} — expected AIOpsError but no error thrown`);
  } catch (err) {
    if (err instanceof AIOpsError) {
      assert(err.code === expectedCode, `${msg} (code: ${err.code})`);
    } else {
      failed++;
      console.log(`  ✗ FAIL: ${msg} — wrong error type`);
    }
  }
}

// ====== Tests ======

console.log("\n=== 1. Client Initialization ===\n");

const client = new AIOpsClient({ apiKey: "aiopsk_test123", baseUrl: BASE_URL });
assert(client !== undefined, "Client created with apiKey");
assert(client.content !== undefined, "content resource exists");
assert(client.tts !== undefined, "tts resource exists");
assert(client.quota !== undefined, "quota resource exists");
assert(client.media !== undefined, "media resource exists");
assert(client.dashboard !== undefined, "dashboard resource exists");

const tokenClient = new AIOpsClient({ token: "eyJtest", baseUrl: BASE_URL });
assert(tokenClient !== undefined, "Client created with token");

try {
  new AIOpsClient({ baseUrl: BASE_URL } as any);
  failed++;
  console.log("  ✗ FAIL: Should throw on missing auth");
} catch (err) {
  assert(err instanceof AIOpsError && (err as AIOpsError).code === "MISSING_AUTH", "Throws MISSING_AUTH on no credentials");
}

console.log("\n=== 2. Content API ===\n");

const contentClient = client.content;
assert(typeof contentClient.generate === "function", "content.generate is a function");
assert(typeof contentClient.list === "function", "content.list is a function");
assert(typeof contentClient.platforms === "function", "content.platforms is a function");
assert(typeof contentClient.styles === "function", "content.styles is a function");

console.log("\n=== 3. TTS API ===\n");

assert(typeof client.tts.synthesize === "function", "tts.synthesize is a function");
assert(typeof client.tts.getVoices === "function", "tts.getVoices is a function");
assert(typeof client.tts.translate === "function", "tts.translate is a function");
assert(typeof client.tts.optimize === "function", "tts.optimize is a function");
assert(typeof client.tts.recommendVoice === "function", "tts.recommendVoice is a function");

console.log("\n=== 4. Quota API ===\n");

assert(typeof client.quota.get === "function", "quota.get is a function");

console.log("\n=== 5. Media API ===\n");

assert(typeof client.media.generateVideo === "function", "media.generateVideo is a function");
assert(typeof client.media.getVideoStatus === "function", "media.getVideoStatus is a function");
assert(typeof client.media.generatePoster === "function", "media.generatePoster is a function");
assert(typeof client.media.getPosterStatus === "function", "media.getPosterStatus is a function");
assert(typeof client.media.getPosterModels === "function", "media.getPosterModels is a function");
assert(typeof client.media.getPosterSizes === "function", "media.getPosterSizes is a function");
assert(typeof client.media.getPosterStyles === "function", "media.getPosterStyles is a function");

console.log("\n=== 6. Dashboard API ===\n");

assert(typeof client.dashboard.overview === "function", "dashboard.overview is a function");
assert(typeof client.dashboard.trend === "function", "dashboard.trend is a function");
assert(typeof client.dashboard.quota === "function", "dashboard.quota is a function");

console.log("\n=== 7. API Endpoint Paths ===\n");

// Verify endpoint paths by checking request URLs
const capturedUrls: string[] = [];
const capturedMethods: string[] = [];
const capturedHeaders: Record<string, string>[] = [];
const capturedBodies: unknown[] = [];

globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
  capturedUrls.push(url.toString());
  capturedMethods.push(init?.method || "GET");
  capturedHeaders.push((init?.headers as Record<string, string>) || {});
  capturedBodies.push(init?.body ? JSON.parse(init.body as string) : undefined);
  return mockResponse({ id: "test-id", title: "test" }) as any;
}) as typeof fetch;

const testClient = new AIOpsClient({ apiKey: "aiopsk_test", baseUrl: "https://api.test.com" });

await testClient.content.generate({ topic: "hello" });
assert(capturedUrls[0] === "https://api.test.com/api/content/generate", "content.generate → /api/content/generate");
assert(capturedMethods[0] === "POST", "content.generate uses POST");
assert(capturedBodies[0] && (capturedBodies[0] as any).topic === "hello", "content.generate sends topic in body");
assert(capturedHeaders[0]["X-API-Key"] === "aiopsk_test", "content.generate sends X-API-Key header");

await testClient.tts.synthesize({ text: "hello" });
assert(capturedUrls[1] === "https://api.test.com/api/tts/synthesize", "tts.synthesize → /api/tts/synthesize");
assert(capturedMethods[1] === "POST", "tts.synthesize uses POST");

await testClient.tts.getVoices();
assert(capturedUrls[2] === "https://api.test.com/api/tts/voices", "tts.getVoices → /api/tts/voices");
assert(capturedMethods[2] === "GET", "tts.getVoices uses GET");

await testClient.quota.get();
assert(capturedUrls[3] === "https://api.test.com/api/quota/summary", "quota.get → /api/quota/summary");

await testClient.media.generateVideo({ subject: "test" });
assert(capturedUrls[4] === "https://api.test.com/api/ai-media/video", "media.generateVideo → /api/ai-media/video");

await testClient.media.getVideoStatus("task-123");
assert(capturedUrls[5] === "https://api.test.com/api/ai-media/video/status/task-123", "media.getVideoStatus → /api/ai-media/video/status/task-123");

await testClient.media.generatePoster({ subject: "test" });
assert(capturedUrls[6] === "https://api.test.com/api/ai-media/poster", "media.generatePoster → /api/ai-media/poster");

await testClient.dashboard.overview();
assert(capturedUrls[7] === "https://api.test.com/api/dashboard/overview", "dashboard.overview → /api/dashboard/overview");

await testClient.dashboard.trend(30);
assert(capturedUrls[8] === "https://api.test.com/api/dashboard/trend?days=30", "dashboard.trend(30) → /api/dashboard/trend?days=30");

await testClient.dashboard.trend();
assert(capturedUrls[9] === "https://api.test.com/api/dashboard/trend", "dashboard.trend() → /api/dashboard/trend (no query)");

await testClient.dashboard.quota();
assert(capturedUrls[10] === "https://api.test.com/api/dashboard/quota", "dashboard.quota → /api/dashboard/quota");

console.log("\n=== 8. JWT Token Auth ===\n");

const tokenTestClient = new AIOpsClient({ token: "eyJtest", baseUrl: "https://api.test.com" });
await tokenTestClient.content.generate({ topic: "hello" });
const lastHeaders = capturedHeaders[capturedHeaders.length - 1];
assert(lastHeaders["Authorization"] === "Bearer eyJtest", "Token auth sets Authorization: Bearer");
assert(lastHeaders["X-API-Key"] === undefined, "Token auth does NOT set X-API-Key");

console.log("\n=== 9. Content List with Query Params ===\n");

await testClient.content.list({ page: 2, pageSize: 5, status: "draft" });
const listUrl = capturedUrls[capturedUrls.length - 1];
assert(listUrl.includes("page=2"), "content.list includes page param");
assert(listUrl.includes("pageSize=5"), "content.list includes pageSize param");
assert(listUrl.includes("status=draft"), "content.list includes status param");
assert(listUrl.startsWith("https://api.test.com/api/content/list?"), "content.list uses GET with query params");

console.log("\n=== 10. Error Handling ===\n");

globalThis.fetch = (async () => {
  return mockResponse({ error: "Unauthorized" }, 401) as any;
}) as typeof fetch;

const errorClient = new AIOpsClient({ apiKey: "bad_key", baseUrl: "https://api.test.com" });
try {
  await errorClient.content.generate({ topic: "test" });
  failed++;
  console.log("  ✗ FAIL: Should throw AIOpsError on 401");
} catch (err) {
  assert(err instanceof AIOpsError, "Throws AIOpsError on API error");
  assert((err as AIOpsError).code === "API_ERROR", "Error code is API_ERROR");
  assert((err as AIOpsError).status === 401, "Error status is 401");
}

globalThis.fetch = (async () => {
  throw new Error("ECONNREFUSED");
}) as typeof fetch;

try {
  await errorClient.content.generate({ topic: "test" });
  failed++;
  console.log("  ✗ FAIL: Should throw AIOpsError on network error");
} catch (err) {
  assert(err instanceof AIOpsError, "Throws AIOpsError on network error");
  assert((err as AIOpsError).code === "NETWORK_ERROR", "Error code is NETWORK_ERROR");
  assert((err as AIOpsError).status === 0, "Network error status is 0");
}

// ====== Results ======
console.log(`\n${"=".repeat(50)}`);
console.log(`  Passed: ${passed}  |  Failed: ${failed}`);
console.log(`${"=".repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}
