# Aiops - AI 内容运营平台

AI 自动制作短视频/文字内容，分发到多平台，自动维护账号。

## 架构

- **MPTurbo**: Docker 容器，视频生成 API
- **Aiops Panel**: React + Vite 前端
- **Aiops Server**: Express 后端 API
- **AiToEarn MCP**: 内容分发+账号互动

## 快速开始

```bash
# 启动后端
cd server && npm install && node server.cjs

# 启动前端（开发）
cd panel && npm install && npm run dev
```

## 部署

详见服务器 `/opt/aiops/`
