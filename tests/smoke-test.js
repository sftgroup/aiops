#!/usr/bin/env node
/**
 * Smoke Test — API 快速健康检查
 * 检查 9 个关键端点是否正常响应
 *
 * 用法: node tests/smoke-test.js [--server http://127.0.0.1:5289] [--token <jwt>]
 *       传 --token 跳过种子数据步骤；不传则用户需手动传
 */

const BASE = process.argv.includes('--server')
  ? process.argv[process.argv.indexOf('--server') + 1]
  : 'http://127.0.0.1:5289';

let TOKEN = '';
const tokenIdx = process.argv.indexOf('--token');
if (tokenIdx > 0) TOKEN = process.argv[tokenIdx + 1];

const { spawnSync } = require('child_process');

function fail(msg) {
  console.error(`  ❌ ${msg}`);
  process.exitCode = 1;
}

function pass(msg) {
  console.log(`  ✅ ${msg}`);
}

async function main() {
  console.log(`\n🔍 Smoke Test — ${BASE}\n`);

  // Step 0: Get token if not provided
  if (!TOKEN) {
    console.log('   --token not provided; attempting login/register...');
    pass('Manual token entry needed: add --token <jwt>');
    if (!TOKEN) {
      fail('No auth token — run scripts/seed_test_data.py first or pass --token');
      process.exit(1);
    }
  }

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };
  const api = async (method, path, body) => {
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${BASE}${path}`, opts);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    return { ok: r.ok, status: r.status, data, text: text.slice(0, 100) };
  };

  // 1. GET /api/team-tasks
  console.log('1️⃣  GET /api/team-tasks');
  const r1 = await api('GET', '/api/team-tasks');
  r1.ok ? pass(`返回 ${r1.status} (${r1.data?.length || 0} 条)`) : fail(`${r1.status} — ${r1.text}`);

  // 2. GET /api/team-tasks/today
  console.log('\n2️⃣  GET /api/team-tasks/today');
  const r2 = await api('GET', '/api/team-tasks/today');
  r2.ok ? pass(`返回 ${r2.status} (taskId: ${r2.data?._id})`) : fail(`${r2.status} — ${r2.text}`);

  // 3. POST /api/videos/scripts (5s)
  console.log('\n3️⃣  POST /api/videos/scripts (5s)');
  const r3 = await api('POST', '/api/videos/scripts', { subject: 'AI 改变生活', duration: 5 });
  if (r3.ok && r3.data?.script) {
    const len = r3.data.script.length;
    pass(`返回 ${r3.status}, 脚本 ${len} 字`);
    if (len > 2000) fail(`脚本过长 (${len}字)，可能未按 5s 限制`);
  } else {
    fail(`${r3.status} — ${JSON.stringify(r3.data)}`);
  }

  // 4. POST /api/videos/scripts (15s)
  console.log('\n4️⃣  POST /api/videos/scripts (15s)');
  const r4 = await api('POST', '/api/videos/scripts', { subject: 'AI 改变生活', duration: 15 });
  r4.ok ? pass(`返回 ${r4.status}, 脚本 ${r4.data?.script?.length || 0} 字`) : fail(`${r4.status} — ${r4.text}`);

  // 5. GET /api/stats
  console.log('\n5️⃣  GET /api/stats');
  const r5 = await api('GET', '/api/stats');
  r5.ok ? pass(`返回 ${r5.status}: ${JSON.stringify(r5.data)}`) : fail(`${r5.status} — ${r5.text}`);

  // 6. POST /api/ai/generate (text gen)
  console.log('\n6️⃣  POST /api/ai/generate');
  const r6 = await api('POST', '/api/ai/generate', { prompt: 'AI 对未来的影响', platform: 'twitter' });
  r6.ok ? pass(`返回 ${r6.status}, 内容 ${r6.data?.text?.length || 0} 字`) : fail(`${r6.status} — ${r6.text}`);

  // 7. POST /api/ai/image (queue image gen)
  console.log('\n7️⃣  POST /api/ai/image');
  const r7 = await api('POST', '/api/ai/image', { subject: '未来城市' });
  r7.ok ? pass(`返回 ${r7.status}, taskId: ${r7.data?.taskId || '?'}`) : fail(`${r7.status} — ${r7.text}`);

  // 8. DELETE test (create temp vid, then delete)
  console.log('\n8️⃣  DELETE 端点测试');
  const r8_create = await api('POST', '/api/team-tasks/today/video', {
    subject: '测试删除', script: '测试', duration: 5,
  });
  if (r8_create.ok) {
    const vidId = r8_create.data?.id;
    const r8_del = await api('DELETE', `/api/team-tasks/today/video/${vidId}`);
    r8_del.ok ? pass(`创建并删除视频: ${vidId}`) : fail(`删除失败: ${r8_del.status} — ${r8_del.text}`);
  } else {
    fail(`创建视频失败: ${r8_create.status} — ${r8_create.text}`);
  }

  // 9. 401 check (no token)
  console.log('\n9️⃣  鉴权拒绝检查');
  const r9 = await fetch(`${BASE}/api/team-tasks/today`, { headers: { 'Content-Type': 'application/json' } });
  if (r9.status === 401) {
    const data = await r9.json();
    pass(`无 token 返回 ${r9.status}: ${data.error}`);
  } else {
    fail(`无 token 返回 ${r9.status}, 期望 401`);
  }

  // Summary
  console.log(`\n${'─'.repeat(40)}`);
  if (process.exitCode) {
    console.log('❌ Smoke Test FAILED — 存在失败的检查项');
  } else {
    console.log('✅ Smoke Test PASSED — 所有端点正常工作');
  }
  process.exit(process.exitCode || 0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
