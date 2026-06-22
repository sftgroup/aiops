#!/bin/bash
# DevOps Agent - 部署管理
# 
# 用法: bash v4-agents/start.sh <deploy|status|logs|restart> [--skip-tests] [--target test|prod|website]
#   deploy       — 完整部署流程（构建→安全→测试→rsync→重启）
#   status       — 查看服务状态
#   logs         — 查看日志
#   restart      — 重启服务
#   --skip-tests — 跳过测试步骤
#   --target     — test(43.156.78.59:5288) / prod(待确认) / website(43.163.105.172)

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${TARGET:-test}"
SKIP_TESTS=false

# 服务器映射
declare -A SERVERS
SERVERS[test]="43.156.78.59"
SERVERS[prod]=""
SERVERS[website]="43.163.105.172"

# ─── 参数解析 ───
while [[ $# -gt 0 ]]; do
  case $1 in
    deploy|status|logs|restart) ACTION="$1"; shift ;;
    --skip-tests) SKIP_TESTS=true; shift ;;
    --target) TARGET="$2"; shift 2 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

ACTION="${ACTION:-deploy}"
SERVER="${SERVERS[$TARGET]:-}"
if [[ -z "$SERVER" && "$ACTION" != "deploy" ]]; then
  echo "❌ 目标 '$TARGET' 无配置的服务器" >&2
  exit 1
fi

echo "🚀 DevOps Agent — Aiops v1.10"
echo "   项目: $PROJECT_DIR"
echo "   动作: $ACTION | 目标: $TARGET ($SERVER)"
echo ""

# ─── 前端构建 ───
build_panel() {
  echo "📦 [1/4] 构建前端面板..."
  cd "$PROJECT_DIR/panel"
  npm install --silent 2>/dev/null || npm install
  npm run build 2>&1 | tail -3
  echo "   ✅ 前端构建完成"
}

# ─── 安全检查 ───
security_check() {
  echo "🔒 [2/4] 安全检查..."
  if [ -f "$PROJECT_DIR/../agent-templates/01-security-audit.js" ]; then
    node "$PROJECT_DIR/../agent-templates/01-security-audit.js" --project-root "$PROJECT_DIR" || {
      echo "⚠️  安全检查有告警，继续部署"
    }
  else
    echo "   ⚠️ Security agent 未找到，跳过"
  fi
}

# ─── 测试 ───
run_tests() {
  echo "🧪 [3/4] 自动化测试..."
  # Smoke test
  if [ -f "$PROJECT_DIR/tests/smoke-test.js" ]; then
    echo "   运行 Smoke Test..."
    node "$PROJECT_DIR/tests/smoke-test.js" --server "http://127.0.0.1:5289" --skip-token 2>&1 | tail -5
  fi
  # E2E test
  if [ -f "$PROJECT_DIR/tests/e2e-test.js" ]; then
    echo "   运行 E2E Test..."
    node "$PROJECT_DIR/tests/e2e-test.js" --url "http://$SERVER:5288" 2>&1 | tail -5
  fi
}

# ─── 部署到服务器 ───
deploy_to_server() {
  local user="$1" host="$2" panel_port="$3" backend_port="$4"
  echo "📦 [4/4] 部署到 $host..."
  
  echo "   同步前端文件..."
  rsync -avz --delete "$PROJECT_DIR/panel/dist/" "$user@$host:/opt/aiops/panel/dist/" 2>&1 | tail -2
  
  echo "   同步后端文件..."
  rsync -avz \
    "$PROJECT_DIR/server/"*.cjs \
    "$PROJECT_DIR/server/routes/"*.cjs \
    "$PROJECT_DIR/server/middleware/"*.cjs \
    "$PROJECT_DIR/server/utils/"*.cjs \
    "$user@$host:/opt/aiops/server/" 2>&1 | tail -2
  # Config file (skipped if doesn't exist)
  rsync -avz "$PROJECT_DIR/server/config.cjs" "$user@$host:/opt/aiops/server/" 2>/dev/null || true
  
  echo "   重启服务..."
  ssh "$user@$host" 'sudo systemctl restart aiops-server && sleep 2 && echo "   ✅ 服务已重启"'
}

# ─── 完整部署 ───
deploy_full() {
  build_panel
  security_check
  if [ "$SKIP_TESTS" = false ]; then
    run_tests
  else
    echo "   ⏭️ 跳过测试 (--skip-tests)"
  fi
  
  if [ "$TARGET" = "test" ]; then
    deploy_to_server "ubuntu" "43.156.78.59" "5288" "5289"
  elif [ "$TARGET" = "website" ]; then
    deploy_to_server "root" "43.163.105.172" "443" "5290"
  elif [ -n "$SERVER" ]; then
    deploy_to_server "ubuntu" "$SERVER" "5288" "5289"
  else
    echo "   ⚠️ 目标服务器未配置，跳过远程部署"
  fi

  echo ""
  echo "✅ 部署完成！"
  echo "   测试服: http://$SERVER:5288"
}

# ─── 查看状态 ───
status_fn() {
  echo "📊 服务状态: $TARGET ($SERVER)"
  ssh "ubuntu@$SERVER" "systemctl status aiops-server --no-pager -l 2>&1 | head -20" || echo "   无法连接"
}

# ─── 查看日志 ───
logs_fn() {
  echo "📋 服务日志: $TARGET ($SERVER)"
  ssh "ubuntu@$SERVER" "journalctl -u aiops-server -n 50 --no-pager" || echo "   无法连接"
}

# ─── 重启 ───
restart_fn() {
  echo "🔄 重启服务: $TARGET ($SERVER)"
  ssh "ubuntu@$SERVER" "sudo systemctl restart aiops-server && echo ✅ 已重启" || echo "   无法连接"
}

# ─── 执行 ───
case $ACTION in
  deploy) deploy_full ;;
  status) status_fn ;;
  logs) logs_fn ;;
  restart) restart_fn ;;
  *) echo "未知动作: $ACTION"; exit 1 ;;
esac
