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
- `main` — 稳定版，已部署到生产环境
- `v2-dev` — 新功能开发分支
- 回滚方式：`git checkout main` 或 `git revert` 到指定 commit

## V1.0 已实现功能（2026-06-04 验证通过）

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
- `SERVER_URL` — Railway 后端地址
- `WEB_URL` — Vercel 前端地址
- `LLM_MODEL` / `LLM_API_KEY` / `LLM_BASE_URL` — DeepSeek 配置

## 部署命令
- 前端：`npm run deploy`（Vercel 生产部署）
- 后端：`railway up --service procurement-server`
