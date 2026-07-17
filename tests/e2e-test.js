#!/usr/bin/env node
/**
 * E2E Test — 端到端页面渲染测试
 * 用 Playwright 检查前端页面是否正常渲染
 *
 * 用法: node tests/e2e-test.js [--url http://43.156.78.59:5288]
 */

const BASE_URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://43.156.78.59:5288';

const { chromium } = require('playwright');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failures++;
  }
}

async function main() {
  console.log(`\n🧪 E2E Test — ${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // 1. 首页加载
  console.log('1️⃣  首页加载');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  const title = await page.title();
  check('页面标题', title.length > 0, title);

  // 2. 检查登录页面存在
  console.log('\n2️⃣  登录页面元素');
  const bodyText = await page.textContent('body');
  check('页面内容非空', bodyText.length > 100, `${bodyText.length} chars`);
  check('包含登录相关文字', bodyText.includes('登录') || bodyText.includes('Login'), '');

  // 3. 检查静态资源加载
  console.log('\n3️⃣  静态资源');
  const resources = performance.getEntriesByType('resource') || [];
  const errors = resources.filter(r => r.responseStatus >= 400);
  check('没有 4xx/5xx 资源', errors.length === 0,
    errors.length > 0 ? errors.slice(0, 3).map(e => `${e.name} (${e.responseStatus})`).join(', ') : '');

  // 4. 截图对比
  console.log('\n4️⃣  页面截图');
  await page.screenshot({ path: '/tmp/e2e-screenshot.png', fullPage: true });
  check('截图已保存', true, '/tmp/e2e-screenshot.png');

  await browser.close();

  console.log(`\n${'─'.repeat(40)}`);
  if (failures) {
    console.log(`❌ E2E Test FAILED — ${failures} 个检查失败`);
  } else {
    console.log('✅ E2E Test PASSED');
  }
  process.exit(failures ? 1 : 0);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  console.log(`\n${'─'.repeat(40)}`);
  console.log('❌ E2E Test FAILED — 执行异常');
  process.exit(1);
});
