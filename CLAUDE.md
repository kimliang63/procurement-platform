# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

供应链采购协同平台，连接采购方与供应商，覆盖采购全流程。

## 常用命令

```bash
# 本地开发（前端 :5173 + 后端 :4000，需在根目录执行）
npm run dev

# 仅启动后端
npm run dev:server

# 仅启动前端
npm run dev:web

# Docker 部署
docker compose up -d       # 启动 app + MySQL
docker compose logs -f     # 查看日志
docker compose down        # 停止

# 前端构建
npm run build              # 等同于 cd web && npm run build

# 运行后端测试
npm test                   # 等同于 cd server && npm test

# 运行前端测试
cd web && npm test         # vitest run
cd web && npm run test:watch  # vitest watch 模式

# 运行单个测试文件
cd server && npx jest --verbose src/__tests__/webhook-async.test.js
cd server && npx jest --verbose src/bot/__tests__/llm.test.js
cd web && npx vitest run src/pages/__tests__/DashboardV2.test.jsx

# 前端部署到 Vercel
npm run deploy           # 生产部署
npm run deploy:preview   # 预览部署

# 后端部署到 Railway
railway up --service procurement-server
```

## 技术栈

- **前端**：React 18 + Ant Design 5 + Tailwind CSS 4 + shadcn/ui + Vite 5
- **后端**：Express 4 + 飞书开放平台 SDK（`@larksuiteoapi/node-sdk`）
- **数据库**：MySQL（mysql2 连接池），历史：飞书多维表格（Bitable）→ 已迁移
- **认证**：飞书 OAuth2 SSO
- **Bot**：飞书机器人 + DeepSeek LLM（自然语言 → MCP 工具调用）
- **测试**：Jest（后端）+ Vitest + Testing Library（前端）

## 部署架构

- **Docker**：统一部署前端 + 后端，`docker compose up -d` 一键启动（含 MySQL）
- **Vercel**（历史）：前端 `https://procurement-platform-rosy.vercel.app`
- **Railway**（历史）：后端 `https://procurement-server-production-b325.up.railway.app`
- **数据库**：MySQL（`assc_srm`），Docker Compose 包含 MySQL 容器，或连接外部 MySQL
- **HRAS 壳子平台**：后端通过 `/health` + `/metrics` 端点注册到 HRAS 壳子，启动时自动调用 `/api/modules/register`

### Docker 部署说明

```bash
# 1. 创建环境变量文件
cp .env.docker.example .env.docker
# 编辑 .env.docker，填入飞书凭证、LLM API Key 等

# 2. 启动（本地 MySQL + 应用）
docker compose up -d

# 3. 验证
curl http://localhost:3000/health    # → {"status":"UP"}
curl http://localhost:3000/api/health  # → {"status":"ok"}
```

- `Dockerfile`：多阶段构建（Stage1 构建前端 → Stage2 Node 22 Alpine 运行 Express）
- `docker-compose.yml`：应用 + MySQL 8.0 容器编排，`db-schema.sql` 自动建表
- 生产环境连接外部 MySQL 时，将 `MYSQL_HOST` 改为远程地址，去掉 compose 中的 mysql 服务即可

## 代码架构

### 后端三层结构

```
server/src/
├── routes/        # Express 路由层 — HTTP 请求/响应处理，调用 MCP 工具
├── mcp/           # 核心业务逻辑层（"工具层"）— 被 routes 和 bot 共同调用
│   ├── projects.js    # 项目 CRUD + 编号自动生成
│   ├── nodes.js       # 节点初始化/推进/异常标记
│   ├── issues.js      # 问题追踪 CRUD
│   ├── rules.js       # 三维节点规则矩阵（isSingleSource × budget × procurementMethod）
│   ├── groups.js      # 群聊绑定
│   └── stats.js       # Dashboard 统计
├── bot/           # 飞书 Bot：LLM 意图识别 → MCP 工具调用 → 卡片/文本回复
│   ├── index.js       # 消息处理主入口（handleMessage / handleCardAction）
│   ├── llm.js         # DeepSeek LLM 意图解析 + 会话管理
│   ├── cards.js       # 飞书卡片构建（确认卡片/结果卡片/周报卡片）
│   ├── weekly.js      # 周报生成（管理员/项目群/个人）
│   └── group.js       # 群聊绑定/解绑逻辑
├── feishu/        # 飞书 SDK 封装
│   ├── client.js      # SDK 客户端实例
│   ├── user.js        # 用户信息查询
│   └── bitable.js     # 旧 Bitable API（已废弃，保留兼容）
├── middleware/
│   └── auth.js        # extractUser（Bearer token 验证）+ filterByOwner（权限过滤）+ requireAdmin
├── db.js              # MySQL 连接池 + SQL 查询封装（API 兼容旧 bitable.js）
├── db-schema.sql      # MySQL 建表语句
└── index.js           # Express 应用入口（中间件/路由/webhook/HRAS 注册）
```

**关键设计决策：**
- **MCP 层是共享内核**：REST API 路由和飞书 Bot 都通过 `callTool(toolName, params)` 调用 MCP 层的同一套函数，保证业务逻辑一致性
- **`db.js` 兼容层**：API 签名（`listRecords`, `getRecord`, `createRecord` 等）与旧的 `bitable.js` 一致，迁移时无需改动 MCP 和 routes 层
- **Bot 异步处理**：Webhook 收到消息后立即返回 200，业务逻辑 fire-and-forget 执行（8 秒超时兜底），避免飞书 200341 超时错误
- **Webhook 去重**：`processedEvents` Set 按 event_id 去重，5 分钟自动清理

### 前端结构

```
web/src/
├── App.jsx              # 路由定义（react-router-dom），lazy-loaded 页面
├── api/index.js         # Axios 实例 + 拦截器（自动附加 token，401 跳转登录）
├── contexts/
│   └── UserContext.jsx   # 用户列表 Context（全局共享）
├── components/
│   ├── Layout.jsx        # 侧边栏 + 顶栏布局
│   ├── ErrorBoundary.jsx
│   ├── PermissionGuard.jsx
│   ├── NodeBar.jsx       # 时间线节点栏
│   └── ui/               # shadcn/ui 组件（button, card, chart）
├── pages/
│   ├── DashboardV2.jsx   # 项目看板（统计卡片 + recharts 图表）
│   ├── ProjectTimeline.jsx # 项目列表（15 节点时间线视图）
│   ├── ProjectDetail.jsx # 项目详情（节点表格 + 问题列表）
│   ├── IssueTracker.jsx  # 问题追踪
│   └── AdminUsers.jsx    # 用户管理（管理员专属）
├── constants/
│   └── stages.js         # 15 阶段节点定义
└── lib/utils.js          # cn() 工具函数
```

**关键设计决策：**
- 页面组件懒加载（`React.lazy` + `Suspense`），按路由拆分 bundle
- `UserContext` 在根 Layout 层级加载全量用户列表，子页面通过 `useUsers()` 消费
- API 层 401 拦截自动清除 token 并跳转登录页

### 权限模型

| 角色 | 权限 |
|------|------|
| admin（管理员） | 查看所有项目 + 访问 `/admin` 用户管理 |
| pm（项目负责人） | 仅查看自己负责的项目 |

- 后端：`extractUser` 中间件解析 token → `filterByOwner` 按角色过滤项目列表
- 前端：`AdminRoute` 组件检查 `user.role === 'admin'`，不匹配重定向到首页

### 业务规则引擎

节点可见性由三维矩阵决定（`server/src/mcp/rules.js`）：
- `isSingleSource`（是/否）
- `budget`（<100万 / ≥100万）
- `procurementMethod`（框架类 / 项目类）

每个节点取值为 `required`（必填）/ `visible`（可选）/ `hidden`（隐藏）。
项目创建时自动按规则初始化节点，项目全部 15 节点有实际完成日期时自动标记"已完成"。

## 分支策略

- `main` — 稳定版（V2.0），已部署到生产环境
- `gh-pages` — GitHub Pages 分支
- 回滚：`git checkout v1.0` 或参考下方 Rollback Procedure

## 路由/页面

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | DashboardV2 | 项目看板首页 |
| `/projects` | ProjectTimeline | 项目列表（时间线视图） |
| `/projects/:id` | ProjectDetail | 项目详情 |
| `/issues` | IssueTracker | 问题追踪 |
| `/admin` | AdminUsers | 用户管理（仅 admin） |
| `/login` | LoginPage | 飞书登录页 |
| `/auth/callback` | AuthCallback | OAuth 回调处理 |

## 环境变量

### Vercel（前端）
- `VITE_API_URL` — 后端 API 地址（含 `/api` 后缀）

### Railway（后端）
- `FEISHU_APP_ID` / `FEISHU_APP_SECRET` — 飞书应用凭证
- `FEISHU_VERIFY_TOKEN` — Webhook 事件验证 token
- `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` — MySQL 连接
- `CORS_ORIGIN` — 允许的跨域域名（逗号分隔）
- `SERVER_URL` — Railway 后端地址
- `WEB_URL` — Vercel 前端地址
- `LLM_MODEL` / `LLM_API_KEY` / `LLM_BASE_URL` — DeepSeek 配置
- `HRAS_SHELL_URL` / `HRAS_MODULE_KEY` / `HRAS_MODULE_NAME` 等 — HRAS 壳子注册

## V2.0 已实现功能

### Dashboard 项目看板
- 统计卡片：项目总数/进行中/已完成/已定标/100万元以上
- 按 BU 统计：进行中+本年累计+年度金额+占比（recharts 图表）
- 按负责人统计：进行中+本年累计（仅统计已注册用户）
- 任务类型饼图：框架招标/单一来源/单次采购

### 项目列表（时间线视图）
- 横向时间线展示 15 个节点
- 节点颜色：已完成=绿色/当前=蓝色/未开始=灰色/阻塞=红色
- 固定侧边栏 + 固定顶部导航

### 业务规则引擎
- 快速规则（<100万/单一来源）：必填 4 个节点
- 招标规则（≥100万/框架招标）：必填 12 个节点
- 项目自动完成：全部 15 节点有实际日期时自动更新
- 创建项目时校验负责人必须是已注册用户

### 飞书 Bot
- 群聊绑定/解绑项目
- 自然语言交互（DeepSeek LLM 意图识别）
- 项目查询/创建/更新，节点推进，问题管理
- 周报推送：管理员周报 + 项目群周报 + 个人周报
- 群聊仅 @bot 时触发，5 分钟活跃会话窗口

### 15 阶段节点
需求确认 → 供应商开发 → 技术交流 → 打样 → 招标方案审批 → 发标 → 答疑 → 供应商回标 → 开标 → 定标 → 中标/未中标通知 → 合同审批 → 生产 → 运输 → 验收

## Rollback Procedure

### Frontend (Vercel)
```bash
git checkout v1.0 -- web/
npm run deploy
```

### Backend (Railway)
```bash
git checkout v1.0 -- server/
railway up --service procurement-server
```

### Database
- MySQL schema 见 `server/src/db-schema.sql`
- 无 schema migration 机制，变更需手动执行 SQL
