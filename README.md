# Aiops - AI 内容运营平台

AI 自动制作短视频/文字内容，一键分发到多平台，自动维护账号。

## 技术栈

- **MPTurbo**: Docker 容器，视频生成 API（ffmpeg 合成，无需 GPU）
- **Aiops Panel**: React + Vite + TailwindCSS 前端
- **Aiops Server**: Express 后端（JSON 文件存储）
- **AiToEarn MCP**: 多平台内容分发 + 账号互动

## 已支持平台（通过 AiToEarn MCP）

- Twitter/X · YouTube · TikTok · Instagram · Facebook
- LinkedIn · Threads · Pinterest · 抖音 · 快手 · 小红书 · B站 · 微信

## 部署结构

```
http://{host}:5288
       │
   Nginx 反向代理
       │
  ┌────┴────┐
  │         │
  前端 dist  后端 :5289
  (React)     (Express)
              │
         ┌────┴────┐
      MPTurbo    AiToEarn
     (视频生成)   MCP SaaS
```

## 开发

```bash
# 后端
cd server && npm install && npm start

# 前端
cd panel && npm install && npm run dev
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `MPTURBO_API` | MPTurbo API 地址 |
| `DEEPSEEK_KEY` | DeepSeek API Key |
| `AITO_EARN_MCP` | AiToEarn MCP 地址 |
| `AITO_EARN_KEY` | AiToEarn API Key |
| `JWT_SECRET` | JWT 签名密钥 |
| `PORT` | 服务器端口（默认 5289） |

## 账号

面板默认：`admin` / `admin123`
