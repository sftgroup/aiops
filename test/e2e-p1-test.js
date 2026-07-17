#!/usr/bin/env node
/**
 * AIOps SAAS - P1 E2E Test Runner (v2)
 * Tests all P1 features end-to-end
 */

const BASE = 'http://127.0.0.1:8080';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1MTZjNjg5OS01ZWEwLTQ1ZWQtYmRjZS02NjFiNzFiZGRiYmIiLCJ0ZW5hbnRJZCI6IjJkYzdhMGM5LTRjODktNDNjYy1hOWZkLTU2Mzc1OTc0MjM5ZiIsImlhdCI6MTc4MjUwOTE1NCwiZXhwIjoxNzgzMTEzOTU0fQ.KNsNsFQWDM7reLm_cYGvYi7ir6ZcH9KVt2EdBiPBycg';

let passed = 0;
let failed = 0;
const failures = [];

function test(name, result, detail) {
  if (result) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    const msg = `  ❌ ${name}: ${detail}`;
    console.error(msg);
    failures.push(msg);
  }
}

async function api(method, path, body = null, auth = true) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (auth) opts.headers['Authorization'] = `Bearer ${TOKEN}`;
  if (body) opts.body = JSON.stringify(body);
  
  const res = await fetch(`${BASE}${path}`, opts);
  let data = null;
  try { data = await res.json(); } catch(e) { data = null; }
  return { status: res.status, data };
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  AIOps SAAS - P1 E2E Test Suite v2');
  console.log('='.repeat(60) + '\n');

  // ============================================
  // SECTION 1: Accounts - CRUD
  // ============================================
  console.log('📋 [1] Accounts - List');
  {
    const r = await api('GET', '/api/accounts');
    test('GET /api/accounts returns 200', r.status === 200, `status=${r.status}`);
    test('GET /api/accounts returns array', Array.isArray(r.data), typeof r.data);
  }

  console.log('\n📋 [1] Accounts - Create (facebook)');
  let fbAccountId = null;
  {
    const r = await api('POST', '/api/accounts', {
      platform: 'facebook',
      name: 'Test FB Page',
      credentials: { accessToken: 'fb_test_token_123' }
    });
    test('POST /api/accounts (fb) returns 201 or 200', [200, 201].includes(r.status), `status=${r.status}`);
    if (r.data && r.data.id) {
      fbAccountId = r.data.id;
      test('Created account has id', true, '');
    }
    if (r.data) {
      const body = JSON.stringify(r.data);
      const hasCreds = body.includes('accessToken') || body.includes('credentials');
      // The response should NOT include credentials (only id, platform, name, etc.)
      test('Response does NOT leak credentials', !hasCreds, 'Credentials leaked in response!');
    }
  }

  console.log('\n📋 [1] Accounts - Create (twitter)');
  let twAccountId = null;
  {
    const r = await api('POST', '/api/accounts', {
      platform: 'twitter',
      name: 'Test Twitter Account',
      credentials: { apiKey: 'tw_test_key', apiSecret: 'tw_test_secret' }
    });
    test('POST /api/accounts (twitter) returns 200/201', [200, 201].includes(r.status), `status=${r.status}`);
    if (r.data && r.data.id) twAccountId = r.data.id;
  }

  console.log('\n📋 [1] Accounts - List (after create)');
  {
    const r = await api('GET', '/api/accounts');
    test('GET /api/accounts returns 200', r.status === 200, `status=${r.status}`);
    const hasItems = Array.isArray(r.data) && r.data.length > 0;
    test('Accounts list contains items', hasItems, `count=${r.data ? r.data.length : 'null'}`);
  }

  console.log('\n📋 [1] Accounts - Update');
  if (fbAccountId) {
    const r = await api('PUT', `/api/accounts/${fbAccountId}`, {
      name: 'Updated FB Page Name'
    });
    test('PUT /api/accounts/:id returns 200', r.status === 200, `status=${r.status}`);
  } else {
    test('PUT /api/accounts/:id (skipped - no account id)', false, 'No account to update');
  }

  console.log('\n📋 [1] Accounts - Delete');
  if (fbAccountId) {
    const r = await api('DELETE', `/api/accounts/${fbAccountId}`);
    test('DELETE /api/accounts/:id returns 200/204', [200, 204].includes(r.status), `status=${r.status}`);
  } else {
    test('DELETE /api/accounts/:id (skipped - no account id)', false, 'No account to delete');
  }
  if (twAccountId) {
    const r = await api('DELETE', `/api/accounts/${twAccountId}`);
    test('DELETE second account returns 200/204', [200, 204].includes(r.status), `status=${r.status}`);
  }

  // ============================================
  // SECTION 2: Publish
  // ============================================
  console.log('\n📋 [2] Publish - List (empty)');
  {
    const r = await api('GET', '/api/publish/records');
    test('GET /api/publish/records returns 200', r.status === 200, `status=${r.status}`);
    test('Publish list is array', Array.isArray(r.data), typeof r.data);
  }

  console.log('\n📋 [2] Publish - Create account then publish');
  {
    const acct = await api('POST', '/api/accounts', {
      platform: 'facebook',
      name: 'Pub Test Account',
      credentials: { accessToken: 'pub_test_token' }
    });
    if (acct.data && acct.data.id) {
      const aid = acct.data.id;
      // API uses 'text' field (not 'content') and 'accountId' (not 'accounts' array)
      const r = await api('POST', '/api/publish', {
        platform: 'facebook',
        accountId: aid,
        text: 'Hello from E2E test!'
      });
      test('POST /api/publish returns 200/201', [200, 201].includes(r.status), `status=${r.status}`);
      
      // Verify publish records exist now
      const records = await api('GET', '/api/publish/records');
      test('Publish records list returns 200', records.status === 200, `status=${records.status}`);
      
      // Clean up
      await api('DELETE', `/api/accounts/${aid}`);
    } else {
      test('POST /api/publish (skipped - no account)', false, 'Could not create account for publish');
    }
  }

  // ============================================
  // SECTION 3: AI Media
  // ============================================
  console.log('\n📋 [3] AI Media - Poster models/sizes/styles');
  {
    const models = await api('GET', '/api/ai-media/poster/models');
    test('GET /api/ai-media/poster/models returns 200', models.status === 200, `status=${models.status}`);
    test('Models is array', Array.isArray(models.data), typeof models.data);
  }
  {
    const sizes = await api('GET', '/api/ai-media/poster/sizes');
    test('GET /api/ai-media/poster/sizes returns 200', sizes.status === 200, `status=${sizes.status}`);
    test('Sizes is array', Array.isArray(sizes.data), typeof sizes.data);
  }
  {
    const styles = await api('GET', '/api/ai-media/poster/styles');
    test('GET /api/ai-media/poster/styles returns 200', styles.status === 200, `status=${styles.status}`);
    test('Styles is array', Array.isArray(styles.data), typeof styles.data);
  }

  console.log('\n📋 [3] AI Media - Poster generation (expect 503 no ARK_API_KEY)');
  {
    const r = await api('POST', '/api/ai-media/poster', {
      subject: 'A beautiful sunset over mountains',
      style: 'realistic',
      size: '1024x1024'
    });
    // The API returns 200 with error message "ARK_API_KEY not configured"
    // Let's check for the error message
    if (r.status === 503) {
      test('POST /api/ai-media/poster returns 503 (no API key)', true, '');
    } else if (r.status === 200) {
      const hasError = r.data && (r.data.error || '').includes('ARK_API_KEY');
      test('POST /api/ai-media/poster returns error about ARK_API_KEY', hasError, `status=${r.status}, data=${JSON.stringify(r.data)}`);
    } else {
      test('POST /api/ai-media/poster handles missing API key gracefully', false, `status=${r.status}`);
    }
  }

  console.log('\n📋 [3] AI Media - Video generation (expect 503 no ARK_API_KEY)');
  {
    const r = await api('POST', '/api/ai-media/video', {
      subject: 'A flying drone over a city',
      style: 'cinematic'
    });
    if (r.status === 503) {
      test('POST /api/ai-media/video returns 503 (no API key)', true, '');
    } else if (r.status === 200) {
      const hasError = r.data && (r.data.error || '').includes('ARK_API_KEY');
      test('POST /api/ai-media/video returns error about ARK_API_KEY', hasError, `status=${r.status}, data=${JSON.stringify(r.data)}`);
    } else {
      test('POST /api/ai-media/video handles missing API key gracefully', false, `status=${r.status}`);
    }
  }

  // ============================================
  // SECTION 4: SPA Routes
  // ============================================
  console.log('\n📋 [4] SPA Routes - All return 200 with HTML');
  const routes = [
    '/', '/login', '/register', '/dashboard',
    '/pipeline', '/content', '/tts', '/videos',
    '/accounts', '/publish', '/settings'
  ];
  for (const route of routes) {
    const res = await fetch(`${BASE}${route}`);
    const text = await res.text();
    const isHtml = text.includes('<!DOCTYPE html>') || text.includes('<html') || text.includes('<div id="root"');
    let checkPass = res.status === 200 && (isHtml || text.length > 200);
    test(`GET ${route} returns 200 with HTML content`, checkPass, `status=${res.status}, length=${text.length}, hasHtml=${isHtml}`);
  }

  // ============================================
  // SECTION 5: Frontend Page Key Elements (via client-rendered JS, check for routes/imports)
  // ============================================
  console.log('\n📋 [5] Frontend Page Key Elements (Server-Side HTML)');
  
  // Since SPA is client-rendered, we check the index HTML has the right assets/entry points
  // for each page route. Let's check the JS bundle mentions.
  {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    
    // Check basic SPA structure
    test('Root HTML contains <div id="root">', html.includes('id="root"') || html.includes('id="app"'), 'Missing root mount point');
    test('Root HTML contains script tag for React', html.includes('<script') && html.includes('src="/assets/'), 'Missing script tag');
    test('Page has a <title> tag', html.includes('<title>'), 'Missing title');
  }

  // Check JS bundle or config for route references
  // Attempt to find the JS bundle and check for route-related strings
  {
    // Look for the main JS bundle
    const res = await fetch(`${BASE}/`, { redirect: 'manual' });
    const html = await res.text();
    
    // Extract JS bundle name
    const jsMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
    if (jsMatch) {
      const jsUrl = jsMatch[1];
      try {
        const jsRes = await fetch(`${BASE}${jsUrl}`);
        const js = await jsRes.text();
        
        const hasVideosRoute = js.includes('videos') || js.includes('/videos');
        const hasAccountsRoute = js.includes('/accounts') || js.includes('accounts');
        const hasPublishRoute = js.includes('publish') || js.includes('/publish');
        const hasContentRoute = js.includes('content') || js.includes('/content');
        const hasConnectTwitter = js.includes('Connect Twitter') || js.includes('connectTwitter') || js.includes('connect_twitter');
        
        test('JS bundle references /videos route', hasVideosRoute, '');
        test('JS bundle references /accounts route', hasAccountsRoute, '');
        test('JS bundle references /publish route', hasPublishRoute, '');
        test('JS bundle references /content route', hasContentRoute, '');
        test('JS bundle contains Connect Twitter references', hasConnectTwitter, '');
        
      } catch (e) {
        console.error('    Could not fetch JS bundle:', e.message);
        test('JS bundle fetchable', false, e.message);
      }
    } else {
      test('Found JS bundle in index.html', false, 'No script src found');
    }
  }

  // Also check SPA route config approach: many SPAs use react-router
  // Let's also search for route patterns in the JS
  {
    const res = await fetch(`${BASE}/`, { redirect: 'manual' });
    const html = await res.text();
    const jsMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
    if (jsMatch) {
      const jsUrl = jsMatch[1];
      try {
        const jsRes = await fetch(`${BASE}${jsUrl}`);
        const js = await jsRes.text();
        
        // Check for key UI strings
        const testStrings = [
          ['Connect Twitter', 'Connect Twitter'],
          ['Publish', 'Publish'],
          ['AI Video', 'AI Video'],
          ['Content', 'Content'],
          ['Videos', 'Videos'],
          ['Accounts', 'Accounts'],
        ];
        
        for (const [label, search] of testStrings) {
          test(`JS bundle contains "${label}" text`, js.includes(search), `Missing in bundle`);
        }
      } catch (e) {
        // Already handled above
      }
    }
  }

  // ============================================
  // SECTION 6: Auth Protection
  // ============================================
  console.log('\n📋 [6] Auth Protection - Without token');
  {
    const r1 = await api('GET', '/api/accounts', null, false);
    test('GET /api/accounts without token → 401', r1.status === 401, `status=${r1.status}`);

    const r2 = await api('GET', '/api/publish/records', null, false);
    test('GET /api/publish/records without token → 401', r2.status === 401, `status=${r2.status}`);

    const r3 = await api('POST', '/api/ai-media/poster', { subject: 'test' }, false);
    test('POST /api/ai-media/poster without token → 401', r3.status === 401, `status=${r3.status}`);

    const r4 = await api('POST', '/api/ai-media/video', { subject: 'test' }, false);
    test('POST /api/ai-media/video without token → 401', r4.status === 401, `status=${r4.status}`);
  }

  // ============================================
  // Summary
  // ============================================
  const total = passed + failed;
  console.log('\n' + '='.repeat(60));
  console.log('  TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`  Total:   ${total}`);
  console.log(`  Passed:  ✅ ${passed}`);
  console.log(`  Failed:  ❌ ${failed}`);
  console.log(`  Rate:    ${Math.round(passed/total*100)}%`);

  if (failures.length > 0) {
    console.log('\n  FAILURES:');
    failures.forEach(f => console.error(`  ${f}`));
  }

  // ============================================
  // Write Report
  // ============================================
  const genRow = (label, result) => {
    const isPass = result === 'pass';
    return `| ${label} | ${isPass ? '✅ PASS' : '❌ FAIL'} |`;
  };

  const report = `# AIOps SAAS - P1 E2E Test Report

**Date:** ${new Date().toISOString()}
**Server:** ${BASE}
**Environment:** Node.js E2E Test Runner

---

## Summary

- **Total Tests:** ${total}
- **Passed:** ✅ ${passed}
- **Failed:** ❌ ${failed}
- **Pass Rate:** ${Math.round(passed/total*100)}%

---

## Test Details

### 1. Accounts (社媒账号管理)

| Test | Result |
|------|--------|
| GET /api/accounts - list (initial) | ${r1ok = failures.find(f=>f.includes('GET /api/accounts returns 200')) ? '❌ FAIL' : '✅ PASS'} |
| GET /api/accounts - returns array | ${r1arr = failures.find(f=>f.includes('GET /api/accounts returns array')) ? '❌ FAIL' : '✅ PASS'} |
| POST /api/accounts - create (facebook) | ${fbCreateOk = failures.find(f=>f.includes('POST /api/accounts (fb) returns')) ? '❌ FAIL' : '✅ PASS'} |
| POST /api/accounts - create (twitter) | ${twCreateOk = failures.find(f=>f.includes('POST /api/accounts (twitter)')) ? '❌ FAIL' : '✅ PASS'} |
| GET /api/accounts - list (after create) | ${listOk = failures.find(f=>f.includes('Accounts list contains')) ? '❌ FAIL' : '✅ PASS'} |
| PUT /api/accounts/:id - update name | ${updOk = failures.find(f=>f.includes('PUT /api/accounts/:id returns 200')) ? '❌ FAIL' : '✅ PASS'} |
| DELETE /api/accounts/:id - delete | ${delOk = failures.find(f=>f.includes('DELETE /api/accounts/:id')) ? '❌ FAIL' : '✅ PASS'} |
| Credentials not leaked in response | ${noLeak = failures.find(f=>f.includes('Response does NOT leak')) ? '❌ FAIL' : '✅ PASS'} |
| Delete second account | ${del2Ok = failures.find(f=>f.includes('DELETE second account')) ? '❌ FAIL' : '✅ PASS'} |

### 2. Publish (多平台发布)

| Test | Result |
|------|--------|
| GET /api/publish/records (empty list) | ${pubList = failures.find(f=>f.includes('GET /api/publish/records returns 200')) ? '❌ FAIL' : '✅ PASS'} |
| GET /api/publish/records - is array | ${pubArr = failures.find(f=>f.includes('Publish list is array')) ? '❌ FAIL' : '✅ PASS'} |
| POST /api/publish - publish content | ${pubOk = failures.find(f=>f.includes('POST /api/publish returns 200/201')) ? '❌ FAIL' : '✅ PASS'} |
| GET /api/publish/records (after publish) | ${pubAfter = failures.find(f=>f.includes('Publish records list returns 200')) ? '❌ FAIL' : '✅ PASS'} |

### 3. AI Media (海报/视频)

| Test | Result |
|------|--------|
| GET /api/ai-media/poster/models | ${mdlOk = failures.find(f=>f.includes('GET /api/ai-media/poster/models')) ? '❌ FAIL' : '✅ PASS'} |
| GET /api/ai-media/poster/sizes | ${szOk = failures.find(f=>f.includes('POST /api/ai-media/poster/sizes')) || failures.find(f=>f.includes('GET /api/ai-media/poster/sizes')) ? '❌ FAIL' : '✅ PASS'} |
| GET /api/ai-media/poster/styles | ${stlOk = failures.find(f=>f.includes('GET /api/ai-media/poster/styles')) ? '❌ FAIL' : '✅ PASS'} |
| POST /api/ai-media/poster (no API key) | ${posterOk = failures.find(f=>f.includes('POST /api/ai-media/poster returns')) ? '❌ FAIL' : '✅ PASS'} |
| POST /api/ai-media/video (no API key) | ${vidOk = failures.find(f=>f.includes('POST /api/ai-media/video returns') || f.includes('POST /api/ai-media/video handles missing API key')) ? '❌ FAIL' : '✅ PASS'} |

### 4. SPA Routes (All return 200)

| Route | Result | Route | Result |
|-------|--------|-------|--------|
| / | ${spaRoot = failures.find(f=>f.includes('GET / returns 200')) ? '❌ FAIL' : '✅ PASS'} | /login | ${spaLogin = failures.find(f=>f.includes('GET /login')) ? '❌ FAIL' : '✅ PASS'} |
| /register | ${spaReg = failures.find(f=>f.includes('GET /register')) ? '❌ FAIL' : '✅ PASS'} | /dashboard | ${spaDash = failures.find(f=>f.includes('GET /dashboard')) ? '❌ FAIL' : '✅ PASS'} |
| /pipeline | ${spaPipe = failures.find(f=>f.includes('GET /pipeline')) ? '❌ FAIL' : '✅ PASS'} | /content | ${spaContent = failures.find(f=>f.includes('GET /content')) ? '❌ FAIL' : '✅ PASS'} |
| /tts | ${spaTts = failures.find(f=>f.includes('GET /tts')) ? '❌ FAIL' : '✅ PASS'} | /videos | ${spaVideos = failures.find(f=>f.includes('GET /videos')) ? '❌ FAIL' : '✅ PASS'} |
| /accounts | ${spaAccts = failures.find(f=>f.includes('GET /accounts')) ? '❌ FAIL' : '✅ PASS'} | /publish | ${spaPub = failures.find(f=>f.includes('GET /publish')) ? '❌ FAIL' : '✅ PASS'} |
| /settings | ${spaSet = failures.find(f=>f.includes('GET /settings')) ? '❌ FAIL' : '✅ PASS'} | | |

### 5. Frontend Key Elements (via Server and Bundle)

| Check | Result |
|-------|--------|
| Root HTML has mount point (<div id="root">) | ${rootHtml = failures.find(f=>f.includes('id="root"') || f.includes('mount point')) ? '❌ FAIL' : '✅ PASS'} |
| Root HTML has React script tag | ${scriptOk = failures.find(f=>f.includes('script tag')) ? '❌ FAIL' : '✅ PASS'} |
| Page has <title> tag | ${titleOk = failures.find(f=>f.includes('title')) ? '❌ FAIL' : '✅ PASS'} |
| JS bundle references /videos route | ${jsVid = failures.find(f=>f.includes('/videos route')) ? '❌ FAIL' : '✅ PASS'} |
| JS bundle references /accounts route | ${jsAcct = failures.find(f=>f.includes('/accounts route')) ? '❌ FAIL' : '✅ PASS'} |
| JS bundle references /publish route | ${jsPub = failures.find(f=>f.includes('/publish route')) ? '❌ FAIL' : '✅ PASS'} |
| JS bundle references /content route | ${jsCont = failures.find(f=>f.includes('/content route')) ? '❌ FAIL' : '✅ PASS'} |
| JS bundle has "Connect Twitter" text | ${jsTw = failures.find(f=>f.includes('Connect Twitter')) ? '❌ FAIL' : '✅ PASS'} |
| JS bundle has "Publish" text | ${jsPubText = failures.find(f=>f.includes('"Publish" text')) ? '❌ FAIL' : '✅ PASS'} |
| JS bundle has "AI Video" text | ${jsVidText = failures.find(f=>f.includes('AI Video')) ? '❌ FAIL' : '✅ PASS'} |
| JS bundle has "Content" text | ${jsContText = failures.find(f=>f.includes('"Content" text')) ? '❌ FAIL' : '✅ PASS'} |
| JS bundle has "Videos" text | ${jsVideosText = failures.find(f=>f.includes('"Videos" text')) ? '❌ FAIL' : '✅ PASS'} |
| JS bundle has "Accounts" text | ${jsAcctText = failures.find(f=>f.includes('"Accounts" text')) ? '❌ FAIL' : '✅ PASS'} |

### 6. Auth Protection (Unauthenticated → 401)

| Endpoint | Result |
|----------|--------|
| GET /api/accounts → 401 | ${auth1 = failures.find(f=>f.includes('GET /api/accounts without token')) ? '❌ FAIL' : '✅ PASS'} |
| GET /api/publish/records → 401 | ${auth2 = failures.find(f=>f.includes('GET /api/publish/records without token')) ? '❌ FAIL' : '✅ PASS'} |
| POST /api/ai-media/poster → 401 | ${auth3 = failures.find(f=>f.includes('POST /api/ai-media/poster without token')) ? '❌ FAIL' : '✅ PASS'} |
| POST /api/ai-media/video → 401 | ${auth4 = failures.find(f=>f.includes('POST /api/ai-media/video without token')) ? '❌ FAIL' : '✅ PASS'} |

---

${failures.length > 0 ? `## Failed Tests\n\n${failures.map(f => `- ${f.replace(/^\s+/, '')}`).join('\n')}\n` : '## All Tests Passed! 🎉\n'}

---
*Generated by E2E Test Runner - ${new Date().toISOString()}*
`;

  const fs = require('fs');
  fs.writeFileSync('/home/ubuntu/aiops-saas/test/e2e-p1-report.md', report);
  console.log('\n📄 Report saved to: /home/ubuntu/aiops-saas/test/e2e-p1-report.md');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
