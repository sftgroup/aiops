# TEST_SCENARIOS_FT — 前端测试

> 项目: AIOps SaaS | 版本: 0.1.0 | 引擎: autotest v2.0
> 前端: http://43.156.78.59:5290 | 管理后台: http://43.156.78.59:5290/operator/

## declarations

| 键 | 值 |
|----|-----|
| FRONTEND | http://43.156.78.59:5290 |
| OPERATOR | http://43.156.78.59:5290/operator/ |
| ADMIN_EMAIL | admin@aiops.dev |
| ADMIN_PASSWORD | *** |

## scenarios

### FT-1: 首页 & 导航

| FT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| FT-001 | browser | 打开 ${FRONTEND}/ | DOM > 10 | @blocking |
| FT-002 | browser | curl -sI ${FRONTEND}/ | 200 | |
| FT-003 | browser | curl -s ${FRONTEND}/ | 200 | |

### FT-2: 登录

| FT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| FT-004 | browser | 打开 ${FRONTEND}/ | 显示登录页 | @blocking |
| FT-005 | browser | 填入 ${ADMIN_EMAIL} ${ADMIN_PASSWORD} 点击登录 | 跳转首页 | @blocking |
| FT-006 | browser | 填入 ${ADMIN_EMAIL} wrong 点击登录 | 401 | |

### FT-3: AI 内容生成

| FT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| FT-007 | browser | 导航到 AI写作 | 内容生成面板 | @depends FT-005 |
| FT-008 | browser | 输入主题 选风格 点击生成 | 流式输出内容 | @depends FT-005 |
| FT-009 | browser | 点击编辑 修改内容 保存 | 保存成功 | @depends FT-005 |
| FT-010 | browser | 点击删除 确认 | 删除成功 | @depends FT-005 |
| FT-011 | browser | 搜索筛选 | 过滤结果 | @depends FT-005 |

### FT-4: TTS 语音合成

| FT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| FT-012 | browser | 导航到语音合成 | 文本输入框和音色选择 | @depends FT-005 |
| FT-013 | browser | 输入文本 选音色 点击合成 | 生成音频显示播放器 | @depends FT-005 |
| FT-014 | browser | 点击播放 | 播放音频 | @depends FT-005 |
| FT-015 | browser | 点击下载 | 下载音频文件 | @depends FT-005 |
| FT-016 | browser | 切换音色 再次合成 | 新音频音色不同 | @depends FT-005 |

### FT-5: AI 短视频

| FT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| FT-017 | browser | 导航到AI视频 | 视频生成面板 | @depends FT-005 |
| FT-018 | browser | 输入主题 点击优化脚本 | AI生成视觉描述 | @depends FT-005 |
| FT-019 | browser | 点击生成视频 | 提交任务显示进度 | @depends FT-005 |
| FT-020 | browser | 视频列表历史 | 已生成记录 | @depends FT-005 |

### FT-6: AI 海报

| FT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| FT-021 | browser | 导航到AI海报 | 模型尺寸风格选择 | @depends FT-005 |
| FT-022 | browser | 输入主题 选风格 生成 | 提交任务显示进度 | @depends FT-005 |
| FT-023 | browser | 海报生成完成 | 海报预览下载 | @depends FT-005 |

### FT-7: 发布管理

| FT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| FT-024 | browser | 导航到发布管理 | 发布记录 | @depends FT-005 |
| FT-025 | browser | 从内容页点发布 选平台 | 发布成功 | @depends FT-005 |

### FT-8: 团队管理

| FT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| FT-026 | browser | 导航到团队 | 成员列表 | @depends FT-005 |
| FT-027 | browser | 点击邀请 输入邮箱 发送 | 邀请已发送 | @depends FT-005 |

### FT-9: 个人设置

| FT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| FT-028 | browser | 导航到个人设置 | 昵称头像邮箱密码 | @depends FT-005 |
| FT-029 | browser | 修改昵称 保存 | 昵称更新 | @depends FT-005 |
| FT-030 | browser | 旧密码新密码 修改 | 密码修改成功 | @depends FT-005 |

### FT-10: 计费套餐

| FT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| FT-031 | browser | 导航到套餐计费 | Starter Pro Enterprise价格 | @depends FT-005 |
| FT-032 | browser | 点击升级到Pro | 支付选项 | @depends FT-005 |
| FT-033 | browser | 选择加密货币支付 | TTUSDC金额收款地址 | @depends FT-005 |

### FT-11: Operator 管理后台

| FT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| FT-034 | browser | 打开 ${OPERATOR} | Operator登录页 | @blocking |
| FT-035 | browser | 登录 ${ADMIN_EMAIL} ${ADMIN_PASSWORD} | Dashboard | @blocking |
| FT-036 | browser | 点击租户导航 | 租户列表 | @depends FT-035 |
| FT-037 | browser | 搜索租户 过滤 | 过滤结果 | @depends FT-035 |
| FT-038 | browser | 点击用户导航 | 用户列表 | @depends FT-035 |
| FT-039 | browser | 按角色筛选 | 角色过滤 | @depends FT-035 |
| FT-040 | browser | 点击API Key | Key配置 | @depends FT-035 |
| FT-041 | browser | 修改Key保存 | 保存成功 | @depends FT-035 |
| FT-042 | browser | 点击系统设置 | 设置面板 | @depends FT-035 |
| FT-043 | browser | 切换注册开关 | 开关变更 | @depends FT-035 |
| FT-044 | browser | 修改计费价格保存 | 价格更新 | @depends FT-035 |
| FT-045 | browser | 退出登录 | 返回登录页 | @depends FT-035 |

### FT-12: 前端整体 UI/UX

| FT-ID | 类型 | 操作 | 预期 | 标记 |
|-------|------|------|------|------|
| FT-046 | browser | 用户端各页面导航 | 路由正确 | @depends FT-005 |
| FT-047 | browser | Operator各页面导航 | 5模块正常 | @depends FT-035 |
| FT-048 | browser | 刷新页面F5 | 保持登录路由不变 | @depends FT-005 |
| FT-049 | browser | 窄窗口响应式 | 侧栏折叠自适应 | @depends FT-005 |
| FT-050 | browser | 暗色主题 | 配色一致无闪烁 | @depends FT-005 |
