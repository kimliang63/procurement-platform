# Procurement Platform

## 是什么
供应链采购协同平台，连接采购方与供应商，覆盖采购全流程。

## 技术栈
- 前端：React + Ant Design + Vite
- 后端：Express + 飞书开放平台 SDK
- 数据库：飞书多维表格（Bitable）
- 认证：飞书 OAuth2 SSO
- Bot：飞书机器人 + DeepSeek LLM

## 部署架构
- 前端：Vercel `https://procurement-platform-rosy.vercel.app`
- 后端：Railway `https://procurement-server-production-b325.up.railway.app`
- 数据库：飞书多维表格
- 本地开发：`npm run dev`（server:4000 + web:5173）

## 分支策略
- `main` — 稳定版（V2.0），已部署到生产环境
- `v2-dev` — V2 开发分支（已合并到 main）
- 回滚方式：`git checkout v1.0` 或参考下方 Rollback Procedure

## V1.0 已实现功能（2026-06-04 验证通过，V2.0 已包含全部功能）

### 认证
- 飞书 OAuth2 SSO 登录
- Token 自动刷新（401 跳转登录页）
- 用户角色管理（admin/pm/member）

### 项目管理
- 项目 CRUD（创建/编辑/删除）
- 项目字段：名称、编号、品类、部门、负责人、预算、计划周期、状态、备注
- 项目列表筛选（按负责人、部门）
- 项目搜索

### 节点管理
- 13 阶段节点自动初始化（需求确认→供应商开发→技术交流→招标审批→发标→招标答疑→回标→开标→定标→中标通知→合同签订→生产→海运）
- 节点计划日期管理（计划开始/计划结束）
- 节点状态自动计算（pending/in_progress/completed/overdue/blocked）
- 节点推进（设置实际完成日期）
- 节点异常标记

### 问题追踪
- 问题 CRUD（创建/编辑/关闭/删除）
- 问题关联项目和阶段
- 问题状态管理（open/in_progress/closed）
- 问题优先级（高/中/低）
- 问题按状态和优先级筛选

### Dashboard
- 数据统计卡片（进行中/已完成/有问题/总项目）
- 项目列表（含进度条）
- 负责人和部门筛选

### 飞书 Bot
- 自然语言交互（DeepSeek LLM）
- 项目查询和创建
- 节点推进
- 卡片交互（按钮回调）
- 群聊免@会话（5分钟活跃窗口）

### 安全
- CORS 白名单（仅允许 Vercel 域名）
- API 认证拦截（401 自动跳转）
- 前端错误兜底（try-catch + toast）

## 环境变量

### Vercel（前端）
- `VITE_API_URL` — 后端 API 地址（含 /api 后缀）

### Railway（后端）
- `FEISHU_APP_ID` / `FEISHU_APP_SECRET` — 飞书应用凭证
- `FEISHU_BITABLE_APP_TOKEN` — 多维表格 token
- `BITABLE_PROJECTS_TABLE_ID` / `BITABLE_NODES_TABLE_ID` / `BITABLE_ISSUES_TABLE_ID` / `BITABLE_USERS_TABLE_ID` — 表 ID
- `BITABLE_GROUPS_TABLE_ID` — 群绑定表
- `BITABLE_WEEKLY_CONFIG_TABLE_ID` — 周报配置表
- `SERVER_URL` — Railway 后端地址
- `WEB_URL` — Vercel 前端地址
- `LLM_MODEL` / `LLM_API_KEY` / `LLM_BASE_URL` — DeepSeek 配置

## V2.0 Features (2026-06-10 部署)

### Dashboard 项目看板
- 统计卡片：项目总数/进行中/已完成/已定标/100万元以上
- 按 BU 统计：进行中+本年累计+年度金额+占比（recharts 图表）
- 按负责人统计：进行中+本年累计
- 任务类型饼图：框架招标/单一来源/单次采购
- 创建项目快捷入口

### 项目列表（时间线视图）
- 横向时间线展示 15 个节点
- 节点颜色：已完成=绿色/当前=蓝色/未开始=灰色/阻塞=红色
- 点击节点弹窗编辑

### 业务规则引擎
- 快速规则（<100万/单一来源）：必填4个节点
- 招标规则（≥100万/框架招标）：必填12个节点
- 项目自动完成：全部15节点有实际日期时自动更新

### 权限管理
- 管理员：看所有项目
- 采购员：只看自己负责的项目

### 飞书 Bot 增强
- 群聊绑定/解绑项目（"绑定 XX项目" / "解绑"）
- 创建项目确认卡片（防误操作 + 重名检查）
- 群聊指令：查询/更新/创建问题
- 周报推送：管理员周报+项目群周报
- 群聊免@会话（5分钟活跃窗口）

### 15 阶段节点
- 需求确认→供应商开发→技术交流→打样→招标方案审批→发标→答疑→供应商回标→开标→定标→中标/未中标通知→合同审批→生产→运输→验收

## 部署命令
- 前端：`npm run deploy`（Vercel 生产部署）
- 后端：`railway up --service procurement-server`

## Rollback Procedure

### Frontend (Vercel)
```bash
# Rollback to V1.0
git checkout v1.0 -- web/
npm run deploy

# Or rollback to specific commit
git checkout <commit-sha> -- web/
npm run deploy
```

### Backend (Railway)
```bash
# Rollback to V1.0
git checkout v1.0 -- server/
railway up --service procurement-server

# Or rollback to specific commit
git checkout <commit-sha> -- server/
railway up --service procurement-server
```

### Database
- No schema migration needed (Bitable is schema-less)
- V1 data remains compatible with V2 (status values supported both ways)
