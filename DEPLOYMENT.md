# AIOps 部署文档

## 服务器列表

| 环境 | IP | 端口 | 状态 |
|------|-----|------|------|
| 生产 | `43.156.50.6` | `5290` | 🟢 运行中 |
| 测试/预发布 | `43.156.25.197` | `5290` | 🟢 运行中 |

两台服务器均为独立端口部署，不依赖 Nginx 端口转发。

## 一键部署

### 前提条件

- Ubuntu 22.04+ / 24.04
- root 或 sudo 用户
- 外网可访问（GitHub clone）

### 部署步骤

```bash
# 1. SSH 登录目标服务器
ssh ubuntu@<SERVER_IP>

# 2. 克隆仓库
git clone https://github.com/sftgroup/aiops.git /home/ubuntu/aiops-saas --depth 1
cd /home/ubuntu/aiops-saas

# 3. 安装系统依赖（Node.js 22 + PostgreSQL 16 + Redis）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt update
sudo apt install -y nodejs postgresql postgresql-contrib redis-server

# 4. 启动数据库
sudo systemctl start postgresql redis-server
sudo systemctl enable postgresql redis-server

# 5. 创建数据库和用户
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'aiops_pass_2024';"
sudo -u postgres psql -c "CREATE DATABASE aiops_saas;"

# 6. 配置 PostgreSQL 本地密码认证
PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" | tr -d ' ')
sudo sed -i 's/^local\s\+all\s\+all\s\+peer/local   all             all                                     md5/' "$PG_HBA"
sudo sed -i 's|host    all             all             127.0.0.1/32            scram-sha-256|host    all             all             127.0.0.1/32            md5|' "$PG_HBA"
sudo systemctl reload postgresql

# 7. 配置环境变量
cat > /home/ubuntu/aiops-saas/server/.env << 'ENVEOF'
PORT=5290
JWT_SECRET=<YOUR_JWT_SECRET>
DATABASE_URL=postgresql://postgres:aiops_pass_2024@localhost:5432/aiops_saas
REDIS_URL=redis://localhost:6379
DEEPSEEK_API_KEY=<YOUR_DEEPSEEK_KEY>
REGISTRATION_OPEN=true
ENCRYPTION_KEY=<32_BYTE_HEX_KEY>
ENVEOF

# 8. 安装 npm 依赖
cd /home/ubuntu/aiops-saas/server
npm install --production

cd /home/ubuntu/aiops-saas/panel
npm install

# 9. 数据库迁移
cd /home/ubuntu/aiops-saas/server
export $(cat .env | xargs)
npx prisma db push
npx prisma generate

# 10. 导入种子数据（定价计划）
node -e "
const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  const c=await p.plan.count();
  if(c>0){console.log('plans exist:',c);return}
  await p.plan.createMany({data:[
    {name:'free',displayName:'Free',price:0,tokensPerMonth:500,contentPerMonth:50,ttsPerMonth:10,videoPerMonth:2,isDefault:true,sortOrder:1},
    {name:'starter',displayName:'Starter',price:9,tokensPerMonth:5000,contentPerMonth:200,ttsPerMonth:100,videoPerMonth:20,sortOrder:2},
    {name:'pro',displayName:'Pro',price:29,tokensPerMonth:20000,contentPerMonth:1000,ttsPerMonth:500,videoPerMonth:100,sortOrder:3},
    {name:'enterprise',displayName:'Enterprise',price:99,tokensPerMonth:100000,contentPerMonth:5000,ttsPerMonth:1000,videoPerMonth:200,sortOrder:4}
  ]});
  console.log('seeded:',await p.plan.count())
})().then(()=>p.\$disconnect())
"

# 11. 构建前端
cd /home/ubuntu/aiops-saas/panel
npx vite build

# 12. 启动服务
cd /home/ubuntu/aiops-saas/server
export $(cat .env | xargs)
nohup node server.js > /tmp/aiops.log 2>&1 &

# 13. 验证
sleep 4
curl -s http://localhost:5290/health
# 应返回: {"status":"ok","version":"0.1.0"}
curl -s http://localhost:5290/ | head -c 50
# 应返回 HTML 首页
```

## 环境变量说明

| 变量名 | 必需 | 说明 | 示例 |
|--------|------|------|------|
| `PORT` | ✅ | 服务端口 | `5290` |
| `JWT_SECRET` | ✅ | JWT 签名密钥 | 随机字符串 32+ 字符 |
| `DATABASE_URL` | ✅ | PostgreSQL 连接串 | `postgresql://user:pass@localhost:5432/aiops_saas` |
| `REDIS_URL` | ⚠️ | Redis 连接串 | `redis://localhost:6379` |
| `DEEPSEEK_API_KEY` | ⚠️ | DeepSeek API Key（文案 + Agent 推理） | `sk-xxx` |
| `REGISTRATION_OPEN` | 否 | 是否开放注册 | `true` / `false` |
| `ENCRYPTION_KEY` | ⚠️ | AES-256-GCM 密钥（32 字节 hex） | `0123...cdef` |

> ⚠️ = 缺了部分功能不可用但不影响启动

## 数据库模型

| 表名 | 说明 |
|------|------|
| `tenants` | 租户 |
| `users` | 用户（支持钱包地址） |
| `tenant_members` | 租户成员 |
| `subscriptions` | 订阅（Stripe） |
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
| **`agent_definitions`** | **Agent 定义** |
| **`agent_skills`** | **Agent Skill 注册** |
| **`agent_executions`** | **Agent 执行记录** |
| **`agent_publications`** | **Agent 市场发布** |

## 健康检查与监控

```bash
# 服务状态
curl http://<SERVER>:5290/health

# 进程
ss -tlnp | grep 5290

# 日志
tail -f /tmp/aiops.log

# 数据库
PGPASSWORD=aiops_pass_2024 psql -U postgres -h localhost -d aiops_saas -c "\dt"

# Redis
redis-cli ping
```

## 重启服务

```bash
fuser -k 5290/tcp
sleep 2
cd /home/ubuntu/aiops-saas/server
export $(cat .env | xargs)
nohup node server.js > /tmp/aiops.log 2>&1 &
```

## 更新部署

```bash
cd /home/ubuntu/aiops-saas
git pull origin master

# 后端 — 安装新依赖 + 数据库迁移
cd server
npm install --production
export $(cat .env | xargs)
npx prisma db push
npx prisma generate

# 前端 — 重新构建
cd ../panel
npm install
npx vite build

# 重启
fuser -k 5290/tcp ; sleep 2
cd ../server
export $(cat .env | xargs)
nohup node server.js > /tmp/aiops.log 2>&1 &
```

## Nginx 反向代理（可选）

如果需要 80/443 端口或 HTTPS，添加 Nginx 配置：

```nginx
server {
    listen 80;
    server_name <YOUR_DOMAIN>;

    location / {
        proxy_pass http://127.0.0.1:5290;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # WebSocket support
        proxy_read_timeout 86400;
    }
}
```
