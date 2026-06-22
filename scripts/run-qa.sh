#!/bin/bash
# QA Agent 全量测试
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
timestamp=$(date +%Y%m%d_%H%M%S)
report_dir="$ROOT/test-reports"
mkdir -p "$report_dir"

echo "🧪 QA Agent — 全量测试"
echo "   报告目录: $report_dir"
echo ""

# Step 1: Seed test data
echo "📦 [1/4] 初始化测试数据..."
python3 "$ROOT/scripts/seed_test_data.py" --server "http://127.0.0.1:5289" 2>&1 | tee "$report_dir/seed_$timestamp.log" | tail -3
echo ""

# Step 2: Smoke test
echo "📦 [2/4] API 烟雾测试..."
node "$ROOT/tests/smoke-test.js" --server "http://127.0.0.1:5289" 2>&1 | tee "$report_dir/smoke_$timestamp.log"
echo ""

# Step 3: E2E test
echo "📦 [3/4] E2E 测试..."
node "$ROOT/tests/e2e-test.js" --url "http://43.156.78.59:5288" 2>&1 | tee "$report_dir/e2e_$timestamp.log"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ QA 测试完成"
echo "   报告: $report_dir/"
