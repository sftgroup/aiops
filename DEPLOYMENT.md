# AIOps 部署文档

> 更新时间: 2026-07-17 | 版本: v0.1.0

---

## 一、服务器列表

| 环境 | IP | 端口 | 状态 |
|------|-----|------|------|
| **正式生产 (新)** | `43.156.99.215` | `5290` | 🟢 运行中 (systemd) |
| **正式生产 (旧)** | `43.156.25.197` | `5290` | 🟢 运行中 |
| **备用/预发布** | `43.133.37.108` | `5290` | 🟢 运行中 |

所有服务器均为独立端口部署，不依赖 Nginx 端口转发。

---

## 二、43.156.99.215 部署详情

### 服务器信息

| 项 | 值 |
|----|-----|
| **服务器** | 43.156.99.215 |
| **用户** | ubuntu |
| **部署路径** | `/home/ubuntu/aiops/` |
| **Node 版本** | v22.23.1 |
| **数据库** | PostgreSQL 16 (本地) |
| **数据库名** | `aiops_saas` |
| **DB 用户** | `aiops_saas` |

### 服务清单

| 服务 | 端口 | systemd | 说明 |
|------|:--:|------|------|
| aiops | 5290 | `aiops.service` | Express API + React SPA 静态文件 |

### 目录结构

```
/home/ubuntu/aiops/
├── server/           # Express API (node server.js)
│   ├── .env          # 环境变量 (PORT=5290, DATABASE_URL, JWT_SECRET...)
│   ├── prisma/       # Schema + migrations
│   └── node_modules/
├── panel/            # React SPA
│   └── dist/         # Vite 构建产物 (由 server 静态 serve)
├── mcp-server/       # MCP Server (stdio, 客户端本地运行)
│   └── dist/         # 编译产物
├── sdk/              # TypeScript SDK
├── agent-bridge/     # AIOps × AgentX 桥接
└── docs/             # 文档
```

### systemd 配置

```ini
# /etc/systemd/system/aiops.service
[Unit]
Description=AIOps SaaS — AI Content Platform
After=network.target postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/aiops/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 常用命令

```bash
# 查看状态
sudo systemctl status aiops

# 重启
sudo systemctl restart aiops

# 查看日志
sudo journalctl -u aiops --since "5 min ago" --no-pager

# 健康检查
curl http://localhost:5290/api/health
```

---

## 三、需要开放的端口

| 端口 | 服务 | 协议 | 说明 |
|:--:|------|------|------|
| **5290** | AIOps | TCP | 主服务 (API + 前端) |
| 5001 | PredX Backend | TCP | PredX 应用 |
| 5002 | PredX MM Panel | TCP | PredX 做市面板 |
| 6100 | PredX MCP | TCP | PredX MCP Server |

> 腾讯云安全组需手动开放以上端口。

---

## 四、环境变量

```bash
# server/.env
DATABASE_URL="postgresql://aiops_saas:aiops_saas_pwd_2026@127.0.0.1:5432/aiops_saas"
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="7d"
ENCRYPTION_KEY="your-64-char-hex-key"
VAULT_KEY="your-vault-key"
DEEPSEEK_API_URL="https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_MODEL="deepseek-chat"
TTS_VOICE_CACHE_DIR="/home/ubuntu/aiops/server/tts-cache"
NODE_ENV="production"
PORT=5290
REGISTRATION_OPEN=true
```

---

## 五、部署流程

### 5.1 全新部署

```bash
# SSH 登录
ssh ubuntu@43.156.99.215

# 克隆代码
cd /home/ubuntu
git clone https://github.com/sftgroup/aiops.git aiops

# 创建数据库
sudo -u postgres psql -c "CREATE USER aiops_saas WITH PASSWORD 'aiops_saas_pwd_2026';"
sudo -u postgres psql -c "CREATE DATABASE aiops_saas OWNER aiops_saas;"

# 配置环境变量
cd /home/ubuntu/aiops/server
cp .env.example .env
# 编辑 .env 填入实际值

# 安装依赖
npm install --production

# 数据库迁移
npx prisma generate
npx prisma migrate deploy

# 种子数据
node seed-admin.js

# 构建前端
cd /home/ubuntu/aiops/panel
npm install
npx vite build

# 创建 systemd 并启动
sudo tee /etc/systemd/system/aiops.service << 'EOF'
[Unit]
Description=AIOps SaaS — AI Content Platform
After=network.target postgresql.service
[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/aiops/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now aiops
```

### 5.2 更新部署

```bash
cd /home/ubuntu/aiops
git pull origin main

# 后端
cd server
npm install --production
npx prisma generate
npx prisma migrate deploy

# 前端
cd ../panel
npm install
npx vite build

# 重启
sudo systemctl restart aiops
```

---

## 六、MCP Server 部署

MCP Server 是 stdio 模式，在客户端本地运行，不需要服务器端口：

```bash
cd /home/ubuntu/aiops/mcp-server
npm install --production
npm run build   # 输出到 dist/
```

客户端配置 (Cursor / Claude / Trae)：

```json
{
  "mcpServers": {
    "aiops": {
      "command": "node",
      "args": ["/path/to/aiops/mcp-server/dist/index.js"],
      "env": {
        "AIOPS_BASE_URL": "http://43.156.99.215:5290",
        "AIOPS_API_KEY": "aiopsk_xxx"
      }
    }
  }
}
```

---

## 七、数据库模型 (18 张表)

| 表名 | 说明 |
|------|------|
| `tenants` | 租户 |
| `users` | 用户 |
| `tenant_members` | 租户成员 |
| `subscriptions` | 订阅 |
| `usage_records` | 用量记录 |
| `api_keys` | API Key (SHA256) |
| `contents` | 文案 |
| `tts_records` | 语音合成 |
| `accounts` | 社交账号 |
| `teams` / `team_tasks` | 团队任务 |
| `settings` | KV 配置 |
| `publish_records` | 发布记录 |
| `audit_logs` | 审计日志 |
| `operator_logs` | 运维日志 |
| `plans` | 定价计划 |
| `agent_definitions` | Agent 定义 |
| `agent_skills` | Agent Skill 注册 |
| `agent_executions` | Agent 执行记录 |
| `agent_publications` | Agent 市场发布 |

---

## 八、故障处理

| 现象 | 处理 |
|------|------|
| 服务无响应 | `sudo journalctl -u aiops -n 50` 检查错误日志 |
| 数据库连接失败 | `sudo systemctl status postgresql` 检查 PG 状态 |
| 前端白屏 | 检查 `panel/dist/index.html` 是否存在，重新构建 |
| 端口不通 | `sudo iptables -L -n` + 腾讯云安全组 |
| 迁移失败 | `npx prisma migrate status` → `npx prisma migrate resolve` |
