# 采购协同平台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建供应链采购协同平台，支持 Web 端项目/问题管理 + 飞书 Bot 对话式操作

**Architecture:** Vercel 部署 React 前端，本地运行 Node.js 后端（API + Bot），ngrok 暴露 Webhook，飞书多维表格存储数据

**Tech Stack:** React, Ant Design, Vite, Node.js, Express, 飞书 SDK, LLM API, 飞书多维表格

---

## 项目结构

```
procurement-platform/
├── web/                          # React 前端（部署到 Vercel）
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── api/                  # API 请求封装
│   │   │   └── index.js
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx     # 项目总览
│   │   │   ├── ProjectList.jsx   # 项目列表
│   │   │   ├── ProjectDetail.jsx # 项目详情
│   │   │   └── IssueTracker.jsx  # 问题追踪
│   │   ├── components/
│   │   │   ├── Layout.jsx        # 布局+侧边栏
│   │   │   ├── NodeBar.jsx       # 节点进度条
│   │   │   └── StatCard.jsx      # 统计卡片
│   │   └── styles/
│   │       └── global.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/                       # Node.js 后端（本地运行）
│   ├── src/
│   │   ├── index.js              # 入口，启动 Express
│   │   ├── routes/
│   │   │   ├── projects.js       # 项目 API
│   │   │   ├── nodes.js          # 节点 API
│   │   │   ├── issues.js         # 问题 API
│   │   │   └── auth.js           # 飞书 SSO
│   │   ├── bot/
│   │   │   ├── index.js          # Bot 消息处理
│   │   │   ├── llm.js            # LLM 语义理解
│   │   │   └── cards.js          # 卡片模板
│   │   ├── mcp/
│   │   │   ├── index.js          # MCP Server 入口
│   │   │   ├── projects.js       # 项目 CRUD
│   │   │   ├── nodes.js          # 节点操作
│   │   │   ├── issues.js         # 问题 CRUD
│   │   │   └── stats.js          # 统计查询
│   │   └── feishu/
│   │       ├── client.js         # 飞书 API 客户端
│   │       └── bitable.js        # 多维表格操作
│   ├── .env                      # 环境变量（不提交）
│   └── package.json
│
└── docs/                         # 文档
    ├── feature-list.md
    └── superpowers/
        └── specs/
            └── architecture-design.md
```

---

## Task 1: 项目初始化

**Files:**
- Create: `procurement-platform/web/package.json`
- Create: `procurement-platform/web/vite.config.js`
- Create: `procurement-platform/web/index.html`
- Create: `procurement-platform/web/src/main.jsx`
- Create: `procurement-platform/web/src/App.jsx`
- Create: `procurement-platform/server/package.json`
- Create: `procurement-platform/server/src/index.js`
- Create: `procurement-platform/server/.env.example`

- [ ] **Step 1: 创建 monorepo 根目录和工作区配置**

```bash
cd ~/Desktop/claude\ code/Procurement\ platform
mkdir -p procurement-platform/web/src procurement-platform/server/src
```

- [ ] **Step 2: 初始化前端项目**

```bash
cd procurement-platform/web
npm init -y
npm install react react-dom react-router-dom antd @ant-design/icons axios
npm install -D vite @vitejs/plugin-react
```

- [ ] **Step 3: 创建 vite.config.js**

```javascript
// procurement-platform/web/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
})
```

- [ ] **Step 4: 创建 index.html**

```html
<!-- procurement-platform/web/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>采购协同平台</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 5: 创建 React 入口文件**

```jsx
// procurement-platform/web/src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 6: 创建 App.jsx（路由骨架）**

```jsx
// procurement-platform/web/src/App.jsx
import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ProjectList from './pages/ProjectList'
import ProjectDetail from './pages/ProjectDetail'
import IssueTracker from './pages/IssueTracker'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="issues" element={<IssueTracker />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 7: 创建全局样式**

```css
/* procurement-platform/web/src/styles/global.css */
:root {
  --primary: #1677ff;
  --primary-bg: #e6f4ff;
  --success: #52c41a;
  --success-bg: #f6ffed;
  --warning: #faad14;
  --warning-bg: #fffbe6;
  --danger: #ff4d4f;
  --danger-bg: #fff2f0;
  --text: #1f1f1f;
  --text-secondary: #8c8c8c;
  --border: #f0f0f0;
  --bg: #f5f5f5;
  --card: #ffffff;
  --sidebar-bg: #001529;
  --sidebar-width: 220px;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; }
```

- [ ] **Step 8: 初始化后端项目**

```bash
cd ../server
npm init -y
npm install express cors dotenv @larksuiteoapi/node-sdk
npm install -D nodemon
```

- [ ] **Step 9: 创建后端入口文件**

```javascript
// procurement-platform/server/src/index.js
require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 4000

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
```

- [ ] **Step 10: 创建 .env.example**

```bash
# procurement-platform/server/.env.example
PORT=4000
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_BITABLE_APP_TOKEN=your_bitable_app_token
LLM_API_KEY=your_llm_api_key
```

- [ ] **Step 11: 验证前后端能启动**

```bash
# 终端1：启动前端
cd procurement-platform/web && npm run dev
# → 访问 http://localhost:3000 看到空白页面

# 终端2：启动后端
cd procurement-platform/server && node src/index.js
# → 访问 http://localhost:4000/api/health 返回 {"status":"ok"}
```

- [ ] **Step 12: 提交**

```bash
cd ~/Desktop/claude\ code/Procurement\ platform/procurement-platform
git init
echo "node_modules/\n.env" > .gitignore
git add -A
git commit -m "feat: project init with React frontend and Node.js backend"
```

---

## Task 2: 飞书多维表格 MCP 层

**Files:**
- Create: `server/src/feishu/client.js`
- Create: `server/src/feishu/bitable.js`
- Create: `server/src/mcp/index.js`
- Create: `server/src/mcp/projects.js`
- Create: `server/src/mcp/nodes.js`
- Create: `server/src/mcp/issues.js`

- [ ] **Step 1: 创建飞书 API 客户端**

```javascript
// server/src/feishu/client.js
const lark = require('@larksuiteoapi/node-sdk')

const client = new lark.Client({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
})

module.exports = client
```

- [ ] **Step 2: 创建多维表格操作封装**

```javascript
// server/src/feishu/bitable.js
const client = require('./client')

const APP_TOKEN = process.env.FEISHU_BITABLE_APP_TOKEN

const TABLE_IDS = {
  projects: process.env.BITABLE_PROJECTS_TABLE_ID,
  nodes: process.env.BITABLE_NODES_TABLE_ID,
  issues: process.env.BITABLE_ISSUES_TABLE_ID,
  users: process.env.BITABLE_USERS_TABLE_ID,
}

async function listRecords(tableKey, filter = {}) {
  const tableId = TABLE_IDS[tableKey]
  const params = { page_size: 100 }
  if (filter.filter) params.filter = filter.filter

  const res = await client.bitable.appTableRecord.list({
    path: { app_token: APP_TOKEN, table_id: tableId },
    params,
  })
  return res.data?.items || []
}

async function getRecord(tableKey, recordId) {
  const tableId = TABLE_IDS[tableKey]
  const res = await client.bitable.appTableRecord.get({
    path: { app_token: APP_TOKEN, table_id: tableId, record_id: recordId },
  })
  return res.data?.record
}

async function createRecord(tableKey, fields) {
  const tableId = TABLE_IDS[tableKey]
  const res = await client.bitable.appTableRecord.create({
    path: { app_token: APP_TOKEN, table_id: tableId },
    data: { fields },
  })
  return res.data?.record
}

async function updateRecord(tableKey, recordId, fields) {
  const tableId = TABLE_IDS[tableKey]
  const res = await client.bitable.appTableRecord.update({
    path: { app_token: APP_TOKEN, table_id: tableId, record_id: recordId },
    data: { fields },
  })
  return res.data?.record
}

async function deleteRecord(tableKey, recordId) {
  const tableId = TABLE_IDS[tableKey]
  await client.bitable.appTableRecord.delete({
    path: { app_token: APP_TOKEN, table_id: tableId, record_id: recordId },
  })
}

module.exports = { listRecords, getRecord, createRecord, updateRecord, deleteRecord, TABLE_IDS }
```

- [ ] **Step 3: 创建 MCP 项目操作**

```javascript
// server/src/mcp/projects.js
const { listRecords, getRecord, createRecord, updateRecord, deleteRecord } = require('../feishu/bitable')

async function createProject(params) {
  const fields = {
    name: params.name,
    no: params.no || `CG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    category: params.category,
    owner: params.owner,
    budget: params.budget,
    plan_start: params.planStart,
    plan_end: params.planEnd,
    current_stage: 'requirement',
    status: '正常',
    remark: params.remark || '',
    risk: '',
    suppliers: '[]',
  }
  return await createRecord('projects', fields)
}

async function updateProject(projectId, params) {
  const fields = {}
  if (params.name) fields.name = params.name
  if (params.owner) fields.owner = params.owner
  if (params.budget) fields.budget = params.budget
  if (params.planStart) fields.plan_start = params.planStart
  if (params.planEnd) fields.plan_end = params.planEnd
  if (params.remark) fields.remark = params.remark
  if (params.status) fields.status = params.status
  if (params.risk !== undefined) fields.risk = params.risk
  return await updateRecord('projects', projectId, fields)
}

async function deleteProject(projectId) {
  return await deleteRecord('projects', projectId)
}

async function getProject(projectId) {
  return await getRecord('projects', projectId)
}

async function listProjects(filter = {}) {
  return await listRecords('projects', filter)
}

module.exports = { createProject, updateProject, deleteProject, getProject, listProjects }
```

- [ ] **Step 4: 创建 MCP 节点操作**

```javascript
// server/src/mcp/nodes.js
const { listRecords, getRecord, createRecord, updateRecord } = require('../feishu/bitable')

const STAGE_MAP = {
  requirement: { label: '需求确认', order: 1 },
  supplier_dev: { label: '供应商开发', order: 2 },
  tech_exchange: { label: '技术交流', order: 3 },
  bid_approval: { label: '招标审批', order: 4 },
  bid_issue: { label: '发标', order: 5 },
  bid_qa: { label: '招标答疑', order: 6 },
  bid_return: { label: '供应商回标', order: 7 },
  bid_open: { label: '开标', order: 8 },
  bid_determine: { label: '定标', order: 9 },
  bid_notify: { label: '中标通知', order: 10 },
  contract: { label: '合同签订', order: 11 },
  production: { label: '生产', order: 12 },
  shipping: { label: '海运', order: 13 },
}

const STAGE_KEYS = Object.keys(STAGE_MAP)

async function initProjectNodes(projectId) {
  const results = []
  for (const [key, info] of Object.entries(STAGE_MAP)) {
    const record = await createRecord('nodes', {
      project_id: projectId,
      stage_key: key,
      stage_label: info.label,
      order: info.order,
      status: info.order === 1 ? 'in_progress' : 'pending',
      plan_date: '',
      actual_date: '',
      note: '',
      abnormal_reason: '',
    })
    results.push(record)
  }
  return results
}

async function advanceNode(projectId, stageKey, status) {
  const nodes = await listRecords('nodes')
  const node = nodes.find(n => n.fields.project_id === projectId && n.fields.stage_key === stageKey)
  if (!node) throw new Error('Node not found')

  const fields = { status }
  if (status === 'completed') {
    fields.actual_date = new Date().toISOString().split('T')[0]
  }
  return await updateRecord('nodes', node.record_id, fields)
}

async function updateNode(projectId, stageKey, params) {
  const nodes = await listRecords('nodes')
  const node = nodes.find(n => n.fields.project_id === projectId && n.fields.stage_key === stageKey)
  if (!node) throw new Error('Node not found')

  const fields = {}
  if (params.assignee) fields.assignee = params.assignee
  if (params.planDate) fields.plan_date = params.planDate
  if (params.note) fields.note = params.note
  return await updateRecord('nodes', node.record_id, fields)
}

async function markNodeAbnormal(projectId, stageKey, reason) {
  const nodes = await listRecords('nodes')
  const node = nodes.find(n => n.fields.project_id === projectId && n.fields.stage_key === stageKey)
  if (!node) throw new Error('Node not found')

  return await updateRecord('nodes', node.record_id, {
    status: 'blocked',
    abnormal_reason: reason,
  })
}

async function listProjectNodes(projectId) {
  const nodes = await listRecords('nodes')
  return nodes
    .filter(n => n.fields.project_id === projectId)
    .sort((a, b) => (a.fields.order || 0) - (b.fields.order || 0))
}

module.exports = { initProjectNodes, advanceNode, updateNode, markNodeAbnormal, listProjectNodes, STAGE_MAP, STAGE_KEYS }
```

- [ ] **Step 5: 创建 MCP 问题操作**

```javascript
// server/src/mcp/issues.js
const { listRecords, getRecord, createRecord, updateRecord } = require('../feishu/bitable')

async function createIssue(params) {
  const fields = {
    project_id: params.projectId,
    stage_key: params.stageKey,
    description: params.description,
    assignee: params.assignee,
    priority: params.priority || 'medium',
    status: 'open',
  }
  return await createRecord('issues', fields)
}

async function updateIssue(issueId, params) {
  const fields = {}
  if (params.status) fields.status = params.status
  if (params.priority) fields.priority = params.priority
  if (params.assignee) fields.assignee = params.assignee
  if (params.description) fields.description = params.description
  return await updateRecord('issues', issueId, fields)
}

async function listIssues(filter = {}) {
  let issues = await listRecords('issues')
  if (filter.projectId) issues = issues.filter(i => i.fields.project_id === filter.projectId)
  if (filter.status) issues = issues.filter(i => i.fields.status === filter.status)
  if (filter.priority) issues = issues.filter(i => i.fields.priority === filter.priority)
  return issues
}

async function getIssue(issueId) {
  return await getRecord('issues', issueId)
}

module.exports = { createIssue, updateIssue, listIssues, getIssue }
```

- [ ] **Step 6: 创建 MCP 入口（工具注册）**

```javascript
// server/src/mcp/index.js
const projects = require('./projects')
const nodes = require('./nodes')
const issues = require('./issues')

const TOOLS = {
  // 项目
  create_project: projects.createProject,
  update_project: projects.updateProject,
  delete_project: projects.deleteProject,
  get_project: projects.getProject,
  list_projects: projects.listProjects,
  // 节点
  init_project_nodes: nodes.initProjectNodes,
  advance_node: nodes.advanceNode,
  update_node: nodes.updateNode,
  mark_node_abnormal: nodes.markNodeAbnormal,
  list_project_nodes: nodes.listProjectNodes,
  // 问题
  create_issue: issues.createIssue,
  update_issue: issues.updateIssue,
  list_issues: issues.listIssues,
}

async function callTool(toolName, params) {
  const fn = TOOLS[toolName]
  if (!fn) throw new Error(`Unknown tool: ${toolName}`)
  return await fn(params)
}

module.exports = { callTool, TOOLS, STAGE_MAP: nodes.STAGE_MAP, STAGE_KEYS: nodes.STAGE_KEYS }
```

- [ ] **Step 7: 更新 .env.example**

```bash
# 追加到 server/.env.example
BITABLE_PROJECTS_TABLE_ID=your_projects_table_id
BITABLE_NODES_TABLE_ID=your_nodes_table_id
BITABLE_ISSUES_TABLE_ID=your_issues_table_id
BITABLE_USERS_TABLE_ID=your_users_table_id
```

- [ ] **Step 8: 提交**

```bash
git add server/src/feishu/ server/src/mcp/
git commit -m "feat: add Feishu Bitable MCP layer with project/node/issue operations"
```

---

## Task 3: API Server 路由

**Files:**
- Create: `server/src/routes/projects.js`
- Create: `server/src/routes/nodes.js`
- Create: `server/src/routes/issues.js`
- Modify: `server/src/index.js`

- [ ] **Step 1: 创建项目路由**

```javascript
// server/src/routes/projects.js
const express = require('express')
const router = express.Router()
const { callTool } = require('../mcp')

router.get('/', async (req, res) => {
  try {
    const projects = await callTool('list_projects', req.query)
    res.json({ data: projects })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const project = await callTool('get_project', req.params.id)
    res.json({ data: project })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const project = await callTool('create_project', req.body)
    res.json({ data: project })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const project = await callTool('update_project', { projectId: req.params.id, ...req.body })
    res.json({ data: project })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await callTool('delete_project', req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
```

- [ ] **Step 2: 创建节点路由**

```javascript
// server/src/routes/nodes.js
const express = require('express')
const router = express.Router()
const { callTool } = require('../mcp')

router.get('/:projectId', async (req, res) => {
  try {
    const nodes = await callTool('list_project_nodes', req.params.projectId)
    res.json({ data: nodes })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/:projectId/:stageKey', async (req, res) => {
  try {
    const node = await callTool('update_node', {
      projectId: req.params.projectId,
      stageKey: req.params.stageKey,
      ...req.body,
    })
    res.json({ data: node })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/:projectId/:stageKey/advance', async (req, res) => {
  try {
    const node = await callTool('advance_node', {
      projectId: req.params.projectId,
      stageKey: req.params.stageKey,
      status: req.body.status || 'completed',
    })
    res.json({ data: node })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/:projectId/:stageKey/abnormal', async (req, res) => {
  try {
    const node = await callTool('mark_node_abnormal', {
      projectId: req.params.projectId,
      stageKey: req.params.stageKey,
      reason: req.body.reason,
    })
    res.json({ data: node })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
```

- [ ] **Step 3: 创建问题路由**

```javascript
// server/src/routes/issues.js
const express = require('express')
const router = express.Router()
const { callTool } = require('../mcp')

router.get('/', async (req, res) => {
  try {
    const issues = await callTool('list_issues', req.query)
    res.json({ data: issues })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const issue = await callTool('create_issue', req.body)
    res.json({ data: issue })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const issue = await callTool('update_issue', { issueId: req.params.id, ...req.body })
    res.json({ data: issue })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
```

- [ ] **Step 4: 更新 server/src/index.js 挂载路由**

```javascript
// server/src/index.js
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const projectsRouter = require('./routes/projects')
const nodesRouter = require('./routes/nodes')
const issuesRouter = require('./routes/issues')

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/projects', projectsRouter)
app.use('/api/nodes', nodesRouter)
app.use('/api/issues', issuesRouter)

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
```

- [ ] **Step 5: 验证 API**

```bash
# 重启后端
cd server && node src/index.js

# 测试健康检查
curl http://localhost:4000/api/health
# → {"status":"ok"}

# 测试项目列表（需要配置飞书凭据）
curl http://localhost:4000/api/projects
```

- [ ] **Step 6: 提交**

```bash
git add server/src/routes/ server/src/index.js
git commit -m "feat: add REST API routes for projects, nodes, issues"
```

---

## Task 4: 飞书 Bot 服务

**Files:**
- Create: `server/src/bot/index.js`
- Create: `server/src/bot/llm.js`
- Create: `server/src/bot/cards.js`

- [ ] **Step 1: 创建 LLM 语义理解模块**

```javascript
// server/src/bot/llm.js
const SYSTEM_PROMPT = `你是采购协同平台的 Bot 助手。用户会用自然语言描述操作需求。

## 你的能力（可调用的工具）
- create_project: 创建项目（需: name, category, owner; 可选: budget, planStart, planEnd, remark）
- update_project: 更新项目（需: projectId; 可选: name, owner, budget, planStart, planEnd, remark）
- delete_project: 删除项目（需: projectId）
- get_project: 查询项目详情（需: projectId）
- list_projects: 查询项目列表（可选: category, status, stage, owner）
- advance_node: 推进节点状态（需: projectId, stageKey; 可选: status）
- update_node: 更新节点信息（需: projectId, stageKey; 可选: assignee, planDate, note）
- mark_node_abnormal: 标记节点异常（需: projectId, stageKey, reason）
- create_issue: 创建问题（需: projectId, stageKey, description, assignee; 可选: priority）
- update_issue: 更新问题（需: issueId; 可选: status, priority, assignee）
- list_issues: 查询问题列表（可选: projectId, status, priority）

## 阶段映射
requirement=需求确认, supplier_dev=供应商开发, tech_exchange=技术交流, bid_approval=招标审批, bid_issue=发标, bid_qa=招标答疑, bid_return=供应商回标, bid_open=开标, bid_determine=定标, bid_notify=中标通知, contract=合同签订, production=生产, shipping=海运

## 处理规则
1. 识别用户意图，选择最匹配的工具
2. 提取工具所需参数
3. 参数不完整时，追问用户补充
4. 项目名称模糊时，列出候选让用户确认
5. 删除等不可逆操作，要求二次确认
6. 无权限时，提示用户联系管理员

## 输出格式
只返回 JSON，不要其他内容:
{
  "intent": "工具名 或 null（无法识别时）",
  "params": { ... },
  "confirm_required": false,
  "message": "追问/确认消息（如需要）"
}`

async function understandIntent(userMessage, context = {}) {
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL || 'claude-sonnet-4-20250514'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  const data = await response.json()
  const text = data.content?.[0]?.text || '{}'

  try {
    return JSON.parse(text)
  } catch {
    return { intent: null, params: {}, confirm_required: false, message: '抱歉，我没有理解你的意思，请再说一次。' }
  }
}

module.exports = { understandIntent }
```

- [ ] **Step 2: 创建卡片模板**

```javascript
// server/src/bot/cards.js
function buildStatusChangeCard(project, nodeKey, status, nextNode) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '节点状态变更' },
      template: status === 'completed' ? 'green' : 'blue',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**${project.name}** · ${project.no}`,
        },
      },
      {
        tag: 'div',
        fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**节点**\n${nodeKey}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**状态**\n${status}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**完成时间**\n${new Date().toLocaleDateString('zh-CN')}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**下一节点**\n${nextNode || '—'}` } },
        ],
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '查看详情' },
            url: `${process.env.WEB_URL}/projects/${project.record_id}`,
            type: 'primary',
          },
        ],
      },
    ],
  }
}

function buildConfirmCard(project, nodeKey, planDate, overdueDays) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '节点确认请求' },
      template: 'orange',
    },
    elements: [
      {
        tag: 'div',
        text: { tag: 'lark_md', content: `**${project.name}** · ${project.no}` },
      },
      {
        tag: 'div',
        fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**待确认节点**\n${nodeKey}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**计划日期**\n${planDate}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**当前状态**\n${overdueDays > 0 ? `已超期 ${overdueDays} 天` : '正常'}` } },
        ],
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '确认完成' },
            type: 'primary',
            value: { action: 'confirm_node', project_id: project.record_id, stage_key: nodeKey },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '标记异常' },
            type: 'danger',
            value: { action: 'mark_abnormal', project_id: project.record_id, stage_key: nodeKey },
          },
        ],
      },
    ],
  }
}

function buildIssueAlertCard(project, issue) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '问题提醒' },
      template: 'red',
    },
    elements: [
      {
        tag: 'div',
        text: { tag: 'lark_md', content: `**${project.name}** · ${project.no}` },
      },
      {
        tag: 'div',
        fields: [
          { is_short: false, text: { tag: 'lark_md', content: `**问题描述**\n${issue.description}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**关联节点**\n${issue.stage_key}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**责任人**\n${issue.assignee}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**优先级**\n${issue.priority}` } },
        ],
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '查看问题' },
            type: 'primary',
            value: { action: 'view_issue', issue_id: issue.record_id },
          },
        ],
      },
    ],
  }
}

module.exports = { buildStatusChangeCard, buildConfirmCard, buildIssueAlertCard }
```

- [ ] **Step 3: 创建 Bot 主逻辑**

```javascript
// server/src/bot/index.js
const { understandIntent } = require('./llm')
const { callTool, STAGE_MAP, STAGE_KEYS } = require('../mcp')
const { buildStatusChangeCard, buildConfirmCard } = require('./cards')

async function handleMessage(event) {
  const userMessage = event.message?.content
  if (!userMessage) return null

  const text = typeof userMessage === 'string' ? JSON.parse(userMessage).text : userMessage.text
  if (!text) return null

  const result = await understandIntent(text)

  if (!result.intent) {
    return { text: result.message || '抱歉，我没有理解你的意思。请告诉我你想做什么，比如：\n- "创建一个新项目"\n- "查看XX设备采购的进度"\n- "把定标标记为完成"' }
  }

  if (result.confirm_required) {
    return { text: result.message }
  }

  try {
    const data = await callTool(result.intent, result.params)

    if (result.intent === 'create_project') {
      return {
        text: `项目创建成功！\n名称：${data.fields?.name}\n编号：${data.fields?.no}\n当前阶段：需求确认`,
      }
    }

    if (result.intent === 'advance_node') {
      const nodeLabel = STAGE_MAP[result.params.stageKey]?.label || result.params.stageKey
      return {
        text: `节点已更新！\n${nodeLabel} → ${result.params.status || 'completed'}`,
      }
    }

    if (result.intent === 'list_projects') {
      if (!data || data.length === 0) {
        return { text: '没有找到匹配的项目。' }
      }
      const list = data.map(p => `· ${p.fields?.name}（${p.fields?.current_stage || '—'}）`).join('\n')
      return { text: `找到 ${data.length} 个项目：\n${list}` }
    }

    if (result.intent === 'get_project') {
      const f = data.fields
      return { text: `项目详情：\n名称：${f?.name}\n编号：${f?.no}\n负责人：${f?.owner}\n当前阶段：${f?.current_stage}\n预算：${f?.budget}万` }
    }

    return { text: `操作完成：${result.intent}` }
  } catch (e) {
    return { text: `操作失败：${e.message}` }
  }
}

function handleCardAction(action) {
  if (action.action === 'confirm_node') {
    return callTool('advance_node', { projectId: action.project_id, stageKey: action.stage_key, status: 'completed' })
  }
  if (action.action === 'mark_abnormal') {
    return callTool('mark_node_abnormal', { projectId: action.project_id, stageKey: action.stage_key, reason: '用户标记异常' })
  }
}

module.exports = { handleMessage, handleCardAction }
```

- [ ] **Step 4: 更新 server/src/index.js 添加 Bot Webhook**

```javascript
// 在 server/src/index.js 中追加
const { handleMessage, handleCardAction } = require('./bot')

// Bot 消息回调
app.post('/webhook/bot', async (req, res) => {
  const { type, challenge, event } = req.body

  // URL 验证
  if (type === 'url_verification') {
    return res.json({ challenge })
  }

  // 处理消息
  if (event?.message?.message_type === 'text') {
    const reply = await handleMessage(event)
    if (reply) {
      // TODO: 调用飞书 API 发送回复
      console.log('Bot reply:', reply)
    }
  }

  res.json({ success: true })
})

// 卡片交互回调
app.post('/webhook/card', async (req, res) => {
  const { action } = req.body
  if (action?.value) {
    await handleCardAction(action.value)
  }
  res.json({ success: true })
})
```

- [ ] **Step 5: 提交**

```bash
git add server/src/bot/
git commit -m "feat: add Feishu Bot with LLM semantic understanding and card templates"
```

---

## Task 5: Web 前端页面

**Files:**
- Create: `web/src/api/index.js`
- Create: `web/src/components/Layout.jsx`
- Create: `web/src/components/StatCard.jsx`
- Create: `web/src/components/NodeBar.jsx`
- Create: `web/src/pages/Dashboard.jsx`
- Create: `web/src/pages/ProjectList.jsx`
- Create: `web/src/pages/ProjectDetail.jsx`
- Create: `web/src/pages/IssueTracker.jsx`

- [ ] **Step 1: 创建 API 请求封装**

```javascript
// web/src/api/index.js
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

export const getProjects = (params) => api.get('/projects', { params })
export const getProject = (id) => api.get(`/projects/${id}`)
export const createProject = (data) => api.post('/projects', data)
export const updateProject = (id, data) => api.put(`/projects/${id}`, data)
export const deleteProject = (id) => api.delete(`/projects/${id}`)

export const getProjectNodes = (projectId) => api.get(`/nodes/${projectId}`)
export const advanceNode = (projectId, stageKey, status) =>
  api.post(`/nodes/${projectId}/${stageKey}/advance`, { status })
export const markNodeAbnormal = (projectId, stageKey, reason) =>
  api.post(`/nodes/${projectId}/${stageKey}/abnormal`, { reason })

export const getIssues = (params) => api.get('/issues', { params })
export const createIssue = (data) => api.post('/issues', data)
export const updateIssue = (id, data) => api.put(`/issues/${id}`, data)

export default api
```

- [ ] **Step 2: 创建 Layout 组件**

```jsx
// web/src/components/Layout.jsx
import React from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu } from 'antd'
import { DashboardOutlined, ProjectOutlined, WarningOutlined } from '@ant-design/icons'

const { Sider, Content } = AntLayout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '项目总览' },
  { key: '/projects', icon: <ProjectOutlined />, label: '项目列表' },
  { key: '/issues', icon: <WarningOutlined />, label: '问题追踪' },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={220}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>采购协同平台</div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Content style={{ padding: 24, background: '#f5f5f5' }}>
        <Outlet />
      </Content>
    </AntLayout>
  )
}
```

- [ ] **Step 3: 创建 StatCard 组件**

```jsx
// web/src/components/StatCard.jsx
import React from 'react'
import { Card, Statistic } from 'antd'

export default function StatCard({ title, value, color }) {
  return (
    <Card>
      <Statistic title={title} value={value} valueStyle={{ color }} />
    </Card>
  )
}
```

- [ ] **Step 4: 创建 NodeBar 组件**

```jsx
// web/src/components/NodeBar.jsx
import React from 'react'
import { Tooltip } from 'antd'

const STAGE_KEYS = [
  'requirement', 'supplier_dev', 'tech_exchange', 'bid_approval',
  'bid_issue', 'bid_qa', 'bid_return', 'bid_open',
  'bid_determine', 'bid_notify', 'contract', 'production', 'shipping',
]

const STAGE_LABELS = {
  requirement: '需求确认', supplier_dev: '供应商开发', tech_exchange: '技术交流',
  bid_approval: '招标审批', bid_issue: '发标', bid_qa: '招标答疑',
  bid_return: '供应商回标', bid_open: '开标', bid_determine: '定标',
  bid_notify: '中标通知', contract: '合同签订', production: '生产', shipping: '海运',
}

const STAGE_COLORS = {
  requirement: '#1677ff', supplier_dev: '#13c2c2', tech_exchange: '#2f54eb',
  bid_approval: '#722ed1', bid_issue: '#eb2f96', bid_qa: '#fa541c',
  bid_return: '#fa8c16', bid_open: '#fadb14', bid_determine: '#a0d911',
  bid_notify: '#52c41a', contract: '#1890ff', production: '#595959', shipping: '#8c8c8c',
}

export default function NodeBar({ currentStage, completed = 0, total = 13 }) {
  const currentOrder = STAGE_KEYS.indexOf(currentStage) + 1

  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {STAGE_KEYS.map((key, i) => {
        const order = i + 1
        const isCompleted = order < currentOrder
        const isCurrent = order === currentOrder
        return (
          <Tooltip key={key} title={STAGE_LABELS[key]}>
            <div style={{
              flex: 1, height: 4, borderRadius: 2,
              background: isCompleted ? '#52c41a' : isCurrent ? STAGE_COLORS[key] : '#e8e8e8',
              opacity: isCompleted || isCurrent ? 1 : 0.3,
            }} />
          </Tooltip>
        )
      })}
      <span style={{ fontSize: 10, color: '#8c8c8c', marginLeft: 4 }}>{completed}/{total}</span>
    </div>
  )
}
```

- [ ] **Step 5: 创建 Dashboard 页面**

```jsx
// web/src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react'
import { Row, Col, Card, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getProjects } from '../api'
import StatCard from '../components/StatCard'
import NodeBar from '../components/NodeBar'

export default function Dashboard() {
  const [projects, setProjects] = useState([])
  const [stats, setStats] = useState({ doing: 0, done: 0, pending: 0, problem: 0, total: 0 })
  const navigate = useNavigate()

  useEffect(() => {
    getProjects().then(res => {
      const list = res.data?.data || []
      setProjects(list)
      setStats({
        doing: list.filter(p => p.fields?.status === '正常').length,
        done: list.filter(p => p.fields?.status === '已完成').length,
        problem: list.filter(p => p.fields?.status === '异常').length,
        total: list.length,
      })
    })
  }, [])

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>项目总览</h1>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={4}><StatCard title="进行中" value={stats.doing} color="#1677ff" /></Col>
        <Col span={4}><StatCard title="已完成" value={stats.done} color="#52c41a" /></Col>
        <Col span={4}><StatCard title="有问题" value={stats.problem} color="#ff4d4f" /></Col>
        <Col span={4}><StatCard title="总项目" value={stats.total} color="#8c8c8c" /></Col>
      </Row>
      <Card title="项目列表">
        <Table
          dataSource={projects}
          rowKey="record_id"
          onRow={(record) => ({ onClick: () => navigate(`/projects/${record.record_id}`) })}
          columns={[
            { title: '项目名称', dataIndex: ['fields', 'name'] },
            { title: '品类', dataIndex: ['fields', 'category'], render: v => <Tag>{v}</Tag> },
            { title: '预算(万)', dataIndex: ['fields', 'budget'] },
            { title: '负责人', dataIndex: ['fields', 'owner'] },
            { title: '当前阶段', dataIndex: ['fields', 'current_stage'] },
            {
              title: '进度', dataIndex: 'record_id',
              render: (_, record) => <NodeBar currentStage={record.fields?.current_stage} />
            },
          ]}
        />
      </Card>
    </div>
  )
}
```

- [ ] **Step 6: 创建 ProjectList 页面**

```jsx
// web/src/pages/ProjectList.jsx
import React, { useState, useEffect } from 'react'
import { Table, Button, Tag, Space, Modal, Form, Input, Select, InputNumber, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getProjects, createProject } from '../api'

export default function ProjectList() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const fetchProjects = async () => {
    setLoading(true)
    const res = await getProjects()
    setProjects(res.data?.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchProjects() }, [])

  const handleCreate = async () => {
    const values = await form.validateFields()
    await createProject(values)
    message.success('项目创建成功')
    setModalOpen(false)
    form.resetFields()
    fetchProjects()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>项目列表</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建项目</Button>
      </div>
      <Table
        loading={loading}
        dataSource={projects}
        rowKey="record_id"
        onRow={(record) => ({ onClick: () => navigate(`/projects/${record.record_id}`) })}
        columns={[
          { title: '项目名称', dataIndex: ['fields', 'name'] },
          { title: '编号', dataIndex: ['fields', 'no'] },
          { title: '品类', dataIndex: ['fields', 'category'], render: v => <Tag>{v}</Tag> },
          { title: '预算(万)', dataIndex: ['fields', 'budget'] },
          { title: '负责人', dataIndex: ['fields', 'owner'] },
          { title: '当前阶段', dataIndex: ['fields', 'current_stage'] },
          { title: '状态', dataIndex: ['fields', 'status'], render: v => <Tag color={v === '异常' ? 'red' : 'blue'}>{v}</Tag> },
        ]}
      />
      <Modal title="创建项目" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
            <Input placeholder="如：XX设备采购" />
          </Form.Item>
          <Form.Item name="category" label="采购品类" rules={[{ required: true }]}>
            <Select options={[{ value: '设备' }, { value: '原材料' }, { value: '服务' }]} />
          </Form.Item>
          <Form.Item name="owner" label="负责人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="budget" label="预算(万元)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="planStart" label="计划开始">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="planEnd" label="计划结束">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 7: 创建 ProjectDetail 页面**

```jsx
// web/src/pages/ProjectDetail.jsx
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Table, Tag, Button, Space, Steps, message } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, WarningOutlined } from '@ant-design/icons'
import { getProject, getProjectNodes, advanceNode, markNodeAbnormal } from '../api'

const STAGE_LABELS = {
  requirement: '需求确认', supplier_dev: '供应商开发', tech_exchange: '技术交流',
  bid_approval: '招标审批', bid_issue: '发标', bid_qa: '招标答疑',
  bid_return: '供应商回标', bid_open: '开标', bid_determine: '定标',
  bid_notify: '中标通知', contract: '合同签订', production: '生产', shipping: '海运',
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const [pRes, nRes] = await Promise.all([getProject(id), getProjectNodes(id)])
    setProject(pRes.data?.data)
    setNodes(nRes.data?.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleAdvance = async (stageKey) => {
    await advanceNode(id, stageKey, 'completed')
    message.success('节点已推进')
    fetchData()
  }

  const handleAbnormal = async (stageKey) => {
    await markNodeAbnormal(id, stageKey, '手动标记异常')
    message.warning('节点已标记异常')
    fetchData()
  }

  if (!project) return null
  const f = project.fields

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>返回</Button>
      <Card title={`${f?.name} · ${f?.no}`} loading={loading}>
        <Descriptions column={3}>
          <Descriptions.Item label="负责人">{f?.owner}</Descriptions.Item>
          <Descriptions.Item label="品类">{f?.category}</Descriptions.Item>
          <Descriptions.Item label="预算">{f?.budget}万</Descriptions.Item>
          <Descriptions.Item label="计划周期">{f?.plan_start} ~ {f?.plan_end}</Descriptions.Item>
          <Descriptions.Item label="当前阶段">{f?.current_stage}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={f?.status === '异常' ? 'red' : 'blue'}>{f?.status}</Tag></Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="节点进度" style={{ marginTop: 16 }} loading={loading}>
        <Table
          dataSource={nodes}
          rowKey="record_id"
          pagination={false}
          columns={[
            { title: '阶段', dataIndex: ['fields', 'stage_label'] },
            { title: '顺序', dataIndex: ['fields', 'order'] },
            {
              title: '状态', dataIndex: ['fields', 'status'],
              render: v => {
                const map = { completed: { color: 'green', text: '已完成' }, in_progress: { color: 'orange', text: '进行中' }, pending: { color: 'default', text: '待开始' }, blocked: { color: 'red', text: '阻塞' } }
                const cfg = map[v] || map.pending
                return <Tag color={cfg.color}>{cfg.text}</Tag>
              }
            },
            { title: '负责人', dataIndex: ['fields', 'assignee'] },
            { title: '计划日期', dataIndex: ['fields', 'plan_date'] },
            { title: '实际日期', dataIndex: ['fields', 'actual_date'] },
            {
              title: '操作', render: (_, record) => (
                <Space>
                  {record.fields?.status !== 'completed' && (
                    <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleAdvance(record.fields?.stage_key)}>完成</Button>
                  )}
                  {record.fields?.status !== 'blocked' && (
                    <Button size="small" danger icon={<WarningOutlined />} onClick={() => handleAbnormal(record.fields?.stage_key)}>异常</Button>
                  )}
                </Space>
              )
            },
          ]}
        />
      </Card>
    </div>
  )
}
```

- [ ] **Step 8: 创建 IssueTracker 页面**

```jsx
// web/src/pages/IssueTracker.jsx
import React, { useState, useEffect } from 'react'
import { Table, Button, Tag, Space, Modal, Form, Input, Select, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getIssues, createIssue, updateIssue, getProjects } from '../api'

export default function IssueTracker() {
  const [issues, setIssues] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    const [iRes, pRes] = await Promise.all([getIssues(), getProjects()])
    setIssues(iRes.data?.data || [])
    setProjects(pRes.data?.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async () => {
    const values = await form.validateFields()
    await createIssue(values)
    message.success('问题创建成功')
    setModalOpen(false)
    form.resetFields()
    fetchData()
  }

  const handleStatusChange = async (id, status) => {
    await updateIssue(id, { status })
    message.success('状态已更新')
    fetchData()
  }

  const priorityColor = { high: 'red', medium: 'orange', low: 'default' }
  const statusColor = { open: 'red', in_progress: 'orange', closed: 'green' }
  const statusText = { open: '待处理', in_progress: '处理中', closed: '已解决' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>问题追踪</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建问题</Button>
      </div>
      <Table
        loading={loading}
        dataSource={issues}
        rowKey="record_id"
        columns={[
          { title: '项目', dataIndex: ['fields', 'project_id'] },
          { title: '阶段', dataIndex: ['fields', 'stage_key'] },
          { title: '描述', dataIndex: ['fields', 'description'] },
          { title: '责任人', dataIndex: ['fields', 'assignee'] },
          { title: '优先级', dataIndex: ['fields', 'priority'], render: v => <Tag color={priorityColor[v]}>{v}</Tag> },
          { title: '状态', dataIndex: ['fields', 'status'], render: v => <Tag color={statusColor[v]}>{statusText[v]}</Tag> },
          {
            title: '操作', render: (_, record) => (
              <Space>
                {record.fields?.status === 'open' && (
                  <Button size="small" onClick={() => handleStatusChange(record.record_id, 'in_progress')}>处理中</Button>
                )}
                {record.fields?.status === 'in_progress' && (
                  <Button size="small" type="primary" onClick={() => handleStatusChange(record.record_id, 'closed')}>已解决</Button>
                )}
              </Space>
            )
          },
        ]}
      />
      <Modal title="创建问题" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="projectId" label="关联项目" rules={[{ required: true }]}>
            <Select
              options={projects.map(p => ({ value: p.record_id, label: p.fields?.name }))}
            />
          </Form.Item>
          <Form.Item name="stageKey" label="关联阶段" rules={[{ required: true }]}>
            <Select options={Object.entries({ requirement: '需求确认', supplier_dev: '供应商开发', tech_exchange: '技术交流', bid_approval: '招标审批', bid_issue: '发标', bid_qa: '招标答疑', bid_return: '供应商回标', bid_open: '开标', bid_determine: '定标', bid_notify: '中标通知', contract: '合同签订', production: '生产', shipping: '海运' }).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="description" label="问题描述" rules={[{ required: true }]}>
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="assignee" label="责任人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select options={[{ value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 9: 验证前端页面**

```bash
cd web && npm run dev
# → 访问 http://localhost:3000
# → 点击各菜单验证页面渲染
```

- [ ] **Step 10: 提交**

```bash
git add web/src/
git commit -m "feat: add web frontend pages with Ant Design"
```

---

## Task 6: 飞书 SSO 登录

**Files:**
- Create: `server/src/routes/auth.js`
- Modify: `server/src/index.js`
- Modify: `web/src/App.jsx`

- [ ] **Step 1: 创建飞书 SSO 路由**

```javascript
// server/src/routes/auth.js
const express = require('express')
const router = express.Router()
const client = require('../feishu/client')

// 跳转飞书授权页
router.get('/feishu', (req, res) => {
  const appId = process.env.FEISHU_APP_ID
  const redirectUri = encodeURIComponent(`${process.env.SERVER_URL}/api/auth/feishu/callback`)
  const url = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${redirectUri}`
  res.redirect(url)
})

// 飞书回调
router.get('/feishu/callback', async (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).json({ error: 'Missing code' })

  try {
    const tokenRes = await client.authen.accessToken.create({
      data: { grant_type: 'authorization_code', code },
    })
    const { access_token, refresh_token, expires_in } = tokenRes.data

    // 获取用户信息
    const userRes = await client.authen.userInfo.get({
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const userInfo = userRes.data

    // TODO: 存储到 users 表
    // await callTool('upsert_user', { openId: userInfo.open_id, name: userInfo.name, avatar: userInfo.avatar })

    // 返回 token 给前端
    res.redirect(`${process.env.WEB_URL}/auth/callback?token=${access_token}&user=${encodeURIComponent(JSON.stringify(userInfo))}`)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
```

- [ ] **Step 2: 更新 server/src/index.js 挂载 auth 路由**

```javascript
// 在 server/src/index.js 中追加
const authRouter = require('./routes/auth')
app.use('/api/auth', authRouter)
```

- [ ] **Step 3: 更新前端支持 SSO**

```jsx
// 修改 web/src/App.jsx
import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// ... 其他 import

function AuthCallback() {
  const [status, setStatus] = useState('处理中...')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const user = params.get('user')
    if (token) {
      localStorage.setItem('token', token)
      localStorage.setItem('user', user)
      setStatus('登录成功，跳转中...')
      setTimeout(() => window.location.href = '/', 1000)
    } else {
      setStatus('登录失败')
    }
  }, [])

  return <div style={{ padding: 100, textAlign: 'center' }}>{status}</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="issues" element={<IssueTracker />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: 更新 .env.example**

```bash
# 追加到 server/.env.example
SERVER_URL=http://localhost:4000
WEB_URL=http://localhost:3000
```

- [ ] **Step 5: 提交**

```bash
git add server/src/routes/auth.js server/src/index.js web/src/App.jsx
git commit -m "feat: add Feishu SSO login flow"
```

---

## Task 7: ngrok 配置与联调

**Files:**
- Create: `server/scripts/start.sh`

- [ ] **Step 1: 创建启动脚本**

```bash
# server/scripts/start.sh
#!/bin/bash

echo "=== 启动采购协同平台后端 ==="

# 检查 ngrok
if ! command -v ngrok &> /dev/null; then
  echo "安装 ngrok..."
  brew install ngrok
fi

# 启动后端服务
echo "启动后端服务 (port 4000)..."
node src/index.js &
SERVER_PID=$!

sleep 2

# 启动 ngrok
echo "启动 ngrok 穿透..."
ngrok http 4000 &
NGROK_PID=$!

sleep 3

# 获取 ngrok 公网地址
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""
echo "=== 服务已启动 ==="
echo "后端地址: http://localhost:4000"
echo "ngrok 公网地址: $NGROK_URL"
echo "Bot Webhook: ${NGROK_URL}/webhook/bot"
echo "Card Webhook: ${NGROK_URL}/webhook/card"
echo ""
echo "请将以上 Webhook 地址配置到飞书开放平台"
echo ""

# 等待退出
trap "kill $SERVER_PID $NGROK_PID; exit" SIGINT SIGTERM
wait
```

- [ ] **Step 2: 设置执行权限**

```bash
chmod +x server/scripts/start.sh
```

- [ ] **Step 3: 更新 .env.example**

```bash
# 追加到 server/.env.example
LLM_MODEL=claude-sonnet-4-20250514
```

- [ ] **Step 4: 提交**

```bash
git add server/scripts/
git commit -m "feat: add startup script with ngrok tunnel"
```

---

## Task 8: Vercel 部署配置

**Files:**
- Create: `web/vercel.json`
- Create: `web/.env.production`

- [ ] **Step 1: 创建 Vercel 配置**

```json
// web/vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 2: 创建生产环境变量**

```bash
# web/.env.production
VITE_API_URL=https://your-ngrok-url.ngrok.io/api
```

- [ ] **Step 3: 提交并部署**

```bash
git add web/vercel.json web/.env.production
git commit -m "feat: add Vercel deployment config"

# 部署到 Vercel
cd web && npx vercel --prod
```

---

## 开发顺序总结

| Task | 内容 | 依赖 |
|------|------|------|
| 1 | 项目初始化 | — |
| 2 | MCP 层（多维表格操作） | Task 1 |
| 3 | API 路由 | Task 2 |
| 4 | Bot 服务 | Task 2 |
| 5 | Web 前端页面 | Task 3 |
| 6 | 飞书 SSO | Task 5 |
| 7 | ngrok 联调 | Task 4 |
| 8 | Vercel 部署 | Task 5 |

**预计工时：** 8-10 小时（单人开发）
