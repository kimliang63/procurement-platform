# Procurement Platform

## 是什么
供应链采购协同平台，连接采购方与供应商，覆盖采购全流程。

## 技术栈
- 前端：React + Ant Design + Vite
- 后端：Express + 飞书开放平台 SDK
- 数据库：飞书多维表格（Bitable）
- 认证：飞书 OAuth2 SSO
- Bot：飞书机器人 + DeepSeek LLM
- 部署：GitHub Pages（前端） + ngrok（后端穿透）

## 当前阶段
MVP 已完成，业务测试中

## 已实现功能
- 飞书 OAuth 登录
- 项目 CRUD（创建/编辑/删除）
- 13 阶段节点自动初始化
- 节点计划日期管理 + 状态自动计算
- 问题追踪（创建/编辑/关闭）
- 飞书 Bot 自然语言交互
- Dashboard 数据统计

## 部署架构
- 前端：Vercel（静态站点）`https://procurement-platform-rosy.vercel.app`
- 后端：Railway（Node.js 服务）`https://procurement-server-production-b325.up.railway.app`
- 数据库：飞书多维表格（固定）
- 本地开发：`npm run dev`（server + web 并行启动）

## 项目专属规则
- 继承全局 ~/CLAUDE.md 规则
- Vercel 部署前端，Railway 部署后端
- 前端 API URL 通过 `VITE_API_URL` 环境变量配置
- 本地开发：`npm run dev` 启动 server(4000) + web(5173)
- 分支：main（稳定版）、v2-dev（新功能开发）
