# Procurement Platform 设计文档

## 项目定位

供应链采购协同平台，连接采购方与供应商，覆盖采购全流程。

## 第一期范围

- 飞书机器人通知 + 轻交互（卡片）
- Web看板（总览 + 详情 + 问题追踪）
- 独立后端
- 节点推进：有自动条件的自动，没有的人工确认
- 问题追踪：基础记录（关联项目+节点）
- 数据对接：待定（OA/供应商系统）

## 架构方案

**模块化单体**：一个服务部署，6个模块通过接口通信。第一期单体部署，后续可拆。

### 模块清单

| 模块                   | 职责                    | 对外接口                                                 |
| -------------------- | --------------------- | ---------------------------------------------------- |
| workflow-engine      | 流程状态机 + 节点推进          | advanceNode, checkAutoAdvance, getProjectProgress    |
| notification-service | 飞书消息推送 + 卡片回调         | sendNotification, handleCardCallback                 |
| notification-rules   | 推送判断引擎（推什么、推给谁、什么时候推） | addRule, evaluate, onStageChange                     |
| integration-adapter  | 外部系统对接（OA/供应商/飞书日历）   | registerAdapter, fetchExternalData, pushExternalData |
| api-layer            | REST API 给Web端        | GET/POST /api/projects, /api/dashboard               |
| web-dashboard        | 前端看板 + 操作界面           | React/Next.js + Ant Design                           |

### 数据流

```
外部系统 → integration-adapter → workflow-engine → notification-rules → notification-service → 飞书
Web端 → api-layer → workflow-engine → notification-rules → notification-service → 飞书
飞书卡片回调 → notification-service → workflow-engine → PostgreSQL → integration-adapter → 外部系统
```

## 工作流引擎

### 13个节点

| # | 节点 | 推进方式 | 数据来源 |
|---|------|---------|---------|
| 1 | 需求确认 | 自动（OA流程触发） | OA系统 |
| 2 | 供应商开发 | 手动确认 | 供应商管理系统 |
| 3 | 技术交流 | 手动确认 | IM日程整合 |
| 4 | 招标方案审批 | 手动确认 | 线下 |
| 5 | 发标 | 手动确认 | 线下 |
| 6 | 招标答疑 | 手动确认 | 线下 |
| 7 | 供应商回标 | 手动确认 | 线下 |
| 8 | 开标 | 手动确认 | 线下 |
| 9 | 定标 | 手动确认（关键节点） | 线下 |
| 10 | 中标通知 | 自动（定标后触发） | 系统生成 |
| 11 | 合同签订 | 手动确认 | OA合同用印 |
| 12 | 生产 | 手动（人工更新） | 人工 |
| 13 | 海运 | 手动（人工更新） | 人工 |

### 节点状态

pending → in_progress → completed，可标记为 abnormal（关联问题）

### 自动推进规则

- 需求确认：OA流程状态变为"已批准"时自动触发
- 中标通知：定标完成后自动发送通知卡片
- 生产/海运：可配置定期提醒

## 飞书Bot交互

### 4种卡片类型

1. **状态变更通知** — 节点完成/推进时推送，信息展示
2. **节点确认请求** — 需人工确认的节点，卡片含确认/异常按钮
3. **问题提醒** — 新问题关联到项目时推送
4. **定期汇总** — 可选，周报汇总

### 通知规则

- 推给谁：项目负责人（必收）+ 节点负责人 + 关注人
- 什么时候推：节点状态变更 / 待确认超时 / 新问题
- 推什么内容：状态变更卡片 / 确认请求卡片 / 问题提醒卡片

## Web看板

### 3个视图

1. **项目总览** — 统计数字 + 柱状图（各阶段项目数量）+ 重点分析（需关注 + 即将完成）
2. **项目详情** — 双视图切换：
   - 进度线视图：13节点时间轴
   - 列表视图：每个节点的详细信息表格
   - 底部关联问题
3. **问题追踪** — 问题列表，支持按项目/节点/时间筛选

## 数据模型

### 5张核心表

**projects（采购项目）**
- id, project_no, name, description
- current_stage, status（active/completed/cancelled）
- owner_id, source_type, source_id
- created_at, updated_at

**project_stages（节点记录）**
- id, project_id (FK), stage, stage_order
- status（pending/in_progress/completed/abnormal）
- assignee_id, started_at, completed_at
- auto_advance, auto_condition（JSON）, note

**issues（问题记录）**
- id, project_id (FK), stage, description
- assignee_id, status（open/in_progress/closed）
- discovered_at, resolved_at, created_by

**notifications（通知记录）**
- id, project_id (FK), type, recipient_id
- card_id, status（sent/delivered/read）
- callback_data（JSON）, created_at

**project_members（项目成员）**
- id, project_id (FK), user_id, role（owner/member/follower）
- notify

### 枚举

- Stage: requirement · supplier_dev · tech_exchange · bid_approval · bid_issue · bid_qa · bid_return · bid_open · bid_determine · bid_notify · contract · production · shipping
- StageStatus: pending · in_progress · completed · abnormal
- ProjectStatus: active · completed · cancelled
- NotificationType: status_change · confirm_request · issue_alert · summary

## 外部数据接入

### integration-adapter（适配器模式）

| 适配器 | 对接系统 | 方向 |
|--------|---------|------|
| OaAdapter | OA系统 | 监听流程状态 / 推送合同签订回调 |
| SupplierAdapter | 供应商管理系统 | 拉取供应商信息 / 推送定标结果 |
| FeishuCalendarAdapter | 飞书日历 | 拉取技术交流日程 |
| ManualAdapter | 人工录入 | 第一期先实现 |

### notification-rules（推送判断引擎）

独立于 workflow-engine 和 notification-service：
- workflow-engine 只管状态变更
- notification-rules 决定推不推
- notification-service 只管怎么推

规则类型：触发规则、接收人规则、时机规则

## 技术栈（建议）

- 后端：Node.js + Express/Fastify + PostgreSQL
- 前端：React/Next.js + Ant Design
- 飞书SDK：@larksuiteoapi/node-sdk
- 部署：Docker + 云服务器
