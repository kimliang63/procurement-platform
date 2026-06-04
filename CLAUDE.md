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
- 前端：`https://kimliang63.github.io/procurement-platform`
- 后端：`https://<ngrok-url>/api`（每次重启变化）
- 数据库：飞书多维表格（固定）

## 项目专属规则
- 继承全局 ~/CLAUDE.md 规则
- 后端使用 ngrok 穿透，SERVER_URL 需与 ngrok 隧道地址一致
- 前端 build 时 web/.env 需切换到生产 URL，build 完恢复为 `/api`
