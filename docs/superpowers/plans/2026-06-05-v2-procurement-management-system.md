# V2 采购项目进度管理系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the procurement platform from V1 (basic project tracking) to V2 (full procurement project management system) with BU-based stats, timeline views, role-based permissions, business rule engine, enhanced Bot, and 16-stage nodes.

**Architecture:** V2 builds on V1's Express + React + Feishu Bitable stack. Key changes: new Bitable tables/fields, dashboard with multi-dimensional stats, timeline-based project list, permission middleware, business rule engine (fast vs bidding), enhanced Bot with group binding and weekly reports, 16-stage node system with 4-color status.

**Tech Stack:** React 18, Ant Design 5, Express, Feishu Bitable SDK, Feishu Bot SDK, DeepSeek LLM

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `server/src/middleware/auth.js` | Permission check middleware (admin vs buyer) |
| `server/src/mcp/rules.js` | Business rule engine (fast vs bidding rules) |
| `server/src/mcp/stats.js` | Dashboard statistics aggregation |
| `server/src/bot/weekly.js` | Bot weekly report generation |
| `server/src/bot/group.js` | Bot group binding management |
| `web/src/pages/ProjectTimeline.jsx` | Timeline view for project list |
| `web/src/pages/DashboardV2.jsx` | New dashboard with BU/owner stats |
| `web/src/components/PermissionGuard.jsx` | Frontend permission wrapper |

### Modified Files
| File | Changes |
|------|---------|
| `server/src/mcp/nodes.js` | 13→16 stages, 4-color status, auto-completion check |
| `server/src/mcp/projects.js` | New fields (bu, task_type, application_no, company), auto-numbering by company |
| `server/src/mcp/issues.js` | No changes needed |
| `server/src/index.js` | Add auth middleware, new routes |
| `server/src/routes/projects.js` | Auth middleware, new fields passthrough |
| `server/src/routes/nodes.js` | No changes needed |
| `server/src/bot/index.js` | Group binding, permission check, weekly report trigger |
| `server/src/bot/cards.js` | Update STAGE_MAP reference, new card templates |
| `web/src/constants/stages.js` | 13→16 stages, 4-color scheme |
| `web/src/App.jsx` | New routes for DashboardV2, ProjectTimeline |
| `web/src/components/Layout.jsx` | Menu update, permission-based items |
| `web/src/pages/Dashboard.jsx` | Replace with DashboardV2 |
| `web/src/pages/ProjectList.jsx` | Replace with ProjectTimeline |
| `web/src/pages/ProjectDetail.jsx` | New fields, 16-node timeline |
| `web/src/api/index.js` | New API endpoints |
| `CLAUDE.md` | Update V2 feature list |

---

## Task 1: Database Schema — New Bitable Tables & Fields

**Goal:** Add V2 fields to existing tables and create new tables for group bindings and weekly report config.

**Files:**
- Modify: `server/src/feishu/bitable.js`

- [ ] **Step 1: Add new table IDs to bitable.js**

```js
// server/src/feishu/bitable.js — add to TABLE_IDS
const TABLE_IDS = {
  projects: process.env.BITABLE_PROJECTS_TABLE_ID,
  nodes: process.env.BITABLE_NODES_TABLE_ID,
  issues: process.env.BITABLE_ISSUES_TABLE_ID,
  users: process.env.BITABLE_USERS_TABLE_ID,
  groups: process.env.BITABLE_GROUPS_TABLE_ID,       // NEW: group bindings
  weekly_config: process.env.BITABLE_WEEKLY_CONFIG_TABLE_ID, // NEW: weekly report config
}
```

- [ ] **Step 2: Add V2 project fields to createProject**

```js
// server/src/mcp/projects.js — update createProject
async function createProject(params) {
  const existing = await listRecords('projects')
  if (existing.some(p => p.fields?.name === params.name)) {
    throw new Error('项目名称已存在')
  }

  // Auto-generate project number by company
  const company = params.company || 'ZT'
  const prefix = company === 'GOFO' ? 'GFCG' : 'CG'
  const year = new Date().getFullYear()
  const yearProjects = existing.filter(p => p.fields?.no?.startsWith(`${prefix}-${year}`))
  const seq = String(yearProjects.length + 1).padStart(3, '0')
  const projectNo = `${prefix}-${year}-${seq}`

  const fields = {
    name: params.name,
    no: projectNo,
    company: company,
    bu: params.bu || '',
    application_no: params.applicationNo || '',
    owner: params.owner,
    budget: Number(params.budget) || 0,
    task_type: params.taskType || '',
    current_stage: 'requirement',
    status: '进行中',
    remark: params.remark || '',
  }
  return await createRecord('projects', fields)
}
```

- [ ] **Step 3: Add V2 fields to updateProject**

```js
// server/src/mcp/projects.js — update updateProject
async function updateProject(params) {
  const { projectId, ...rest } = params
  const fields = {}
  if (rest.name) fields.name = rest.name
  if (rest.bu !== undefined) fields.bu = rest.bu
  if (rest.applicationNo !== undefined) fields.application_no = rest.applicationNo
  if (rest.owner) fields.owner = rest.owner
  if (rest.budget !== undefined) fields.budget = Number(rest.budget)
  if (rest.taskType !== undefined) fields.task_type = rest.taskType
  if (rest.status) fields.status = rest.status
  if (rest.remark !== undefined) fields.remark = rest.remark
  return await updateRecord('projects', projectId, fields)
}
```

- [ ] **Step 4: Add new route for group bindings**

```js
// server/src/routes/groups.js (NEW FILE)
const express = require('express')
const router = express.Router()
const { listRecords, createRecord, updateRecord, deleteRecord } = require('../feishu/bitable')

router.get('/', async (req, res) => {
  try {
    const groups = await listRecords('groups')
    res.json({ data: groups })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { chat_id, project_id, project_name } = req.body
    // Check if group already bound
    const existing = await listRecords('groups')
    if (existing.some(g => g.fields?.chat_id === chat_id)) {
      return res.status(400).json({ error: '该群已绑定其他项目' })
    }
    const group = await createRecord('groups', {
      chat_id,
      project_id,
      project_name,
      bound_at: new Date().toISOString(),
    })
    res.json({ data: group })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:chatId', async (req, res) => {
  try {
    const groups = await listRecords('groups')
    const group = groups.find(g => g.fields?.chat_id === req.params.chatId)
    if (!group) return res.status(404).json({ error: '未找到绑定' })
    await deleteRecord('groups', group.record_id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
```

- [ ] **Step 5: Add weekly config route**

```js
// server/src/routes/weekly.js (NEW FILE)
const express = require('express')
const router = express.Router()
const { listRecords, createRecord, updateRecord } = require('../feishu/bitable')

router.get('/', async (req, res) => {
  try {
    const configs = await listRecords('weekly_config')
    res.json({ data: configs })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { admin_chat_ids, specific_users } = req.body
    const config = await createRecord('weekly_config', {
      admin_chat_ids: JSON.stringify(admin_chat_ids || []),
      specific_users: JSON.stringify(specific_users || []),
      updated_at: new Date().toISOString(),
    })
    res.json({ data: config })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
```

- [ ] **Step 6: Register new routes in index.js**

```js
// server/src/index.js — add after existing routes
const groupsRouter = require('./routes/groups')
const weeklyRouter = require('./routes/weekly')
app.use('/api/groups', groupsRouter)
app.use('/api/weekly', weeklyRouter)
```

- [ ] **Step 7: Update CLAUDE.md with new environment variables**

Add to Railway env:
- `BITABLE_GROUPS_TABLE_ID` — group bindings table
- `BITABLE_WEEKLY_CONFIG_TABLE_ID` — weekly report config table

---

## Task 2: 16-Stage Node System

**Goal:** Upgrade from 13 to 16 stages, add 4-color status scheme, implement auto-completion check.

**Files:**
- Modify: `server/src/mcp/nodes.js`
- Modify: `web/src/constants/stages.js`

- [ ] **Step 1: Update server STAGE_MAP to 16 stages**

```js
// server/src/mcp/nodes.js — replace STAGE_MAP
const STAGE_MAP = {
  requirement: { label: '需求确认', order: 1 },
  supplier_dev: { label: '供应商开发', order: 2 },
  tech_exchange: { label: '技术交流', order: 3 },
  sampling: { label: '打样', order: 4 },
  bid_approval: { label: '招标方案审批', order: 5 },
  bid_issue: { label: '发标', order: 6 },
  bid_qa: { label: '答疑', order: 7 },
  bid_return: { label: '供应商回标', order: 8 },
  bid_open: { label: '开标', order: 9 },
  bid_determine: { label: '定标', order: 10 },
  bid_notify: { label: '中标/未中标通知', order: 11 },
  contract_approval: { label: '合同审批', order: 12 },
  production: { label: '生产', order: 13 },
  shipping: { label: '运输', order: 14 },
  acceptance: { label: '验收', order: 15 },
}
```

- [ ] **Step 2: Update computeNodeStatus for 4-color scheme**

```js
// server/src/mcp/nodes.js — replace computeNodeStatus
function computeNodeStatus(node) {
  const f = node.fields || {}
  // Red: blocked
  if (f.abnormal_reason) return 'blocked'

  const today = new Date().toISOString().split('T')[0]
  const planStart = f.plan_start || ''
  const planEnd = f.plan_end || ''
  const actualDate = f.actual_date || ''

  // Green: completed
  if (actualDate) return 'completed'

  // No dates → pending (gray)
  if (!planStart && !planEnd) return 'pending'

  // Blue: in_progress (current node)
  if (planStart && today >= planStart && (!planEnd || today <= planEnd)) return 'in_progress'

  // Before start → pending (gray)
  if (planStart && today < planStart) return 'pending'

  // After end, no actual date → overdue (red)
  if (planEnd && today > planEnd) return 'overdue'

  return 'pending'
}
```

- [ ] **Step 3: Add auto-completion check function**

```js
// server/src/mcp/nodes.js — add after computeNodeStatus
async function checkAndAutoComplete(projectId) {
  const nodes = await listProjectNodes({ projectId })
  const allCompleted = nodes.every(n => n.fields?.actual_date)
  if (allCompleted) {
    const project = await require('./projects').getProject({ projectId })
    if (project?.fields?.status !== '项目完成') {
      await require('./projects').updateProject({ projectId, status: '项目完成' })
    }
  }
}
```

- [ ] **Step 4: Update initProjectNodes for 16 stages**

```js
// server/src/mcp/nodes.js — update initProjectNodes
async function initProjectNodes(params) {
  const { projectId } = params
  const records = Object.entries(STAGE_MAP).map(([key, info]) => ({
    fields: {
      project_id: projectId,
      stage_key: key,
      status: info.order === 1 ? 'in_progress' : 'pending',
      plan_start: '',
      plan_end: '',
      actual_date: '',
      note: '',
    }
  }))

  const res = await client.bitable.appTableRecord.batchCreate({
    path: { app_token: process.env.FEISHU_BITABLE_APP_TOKEN, table_id: TABLE_IDS.nodes },
    data: { records },
  })
  return res.data?.records || []
}
```

- [ ] **Step 5: Update advanceNode to trigger auto-completion**

```js
// server/src/mcp/nodes.js — update advanceNode
async function advanceNode(params) {
  const { projectId, stageKey, actualDate } = params
  if (!projectId) throw new Error('缺少 projectId 参数')
  if (!stageKey) throw new Error('缺少 stageKey 参数')

  const nodes = await listRecords('nodes', {
    filter: `AND(CurrentValue.[project_id]="${projectId}", CurrentValue.[stage_key]="${stageKey}")`
  })
  const node = nodes[0]
  if (!node) throw new Error(`未找到节点: projectId=${projectId}, stageKey=${stageKey}`)
  if (!node.record_id) throw new Error('节点数据异常: 缺少 record_id')

  const finalActualDate = actualDate || new Date().toISOString().split('T')[0]
  const result = await updateRecord('nodes', node.record_id, {
    actual_date: finalActualDate,
  })

  // Auto-complete project if all nodes done
  await checkAndAutoComplete(projectId)

  return result
}
```

- [ ] **Step 6: Update frontend STAGE_MAP to 16 stages**

```js
// web/src/constants/stages.js — replace entire file
export const STAGE_MAP = {
  requirement: '需求确认',
  supplier_dev: '供应商开发',
  tech_exchange: '技术交流',
  sampling: '打样',
  bid_approval: '招标方案审批',
  bid_issue: '发标',
  bid_qa: '答疑',
  bid_return: '供应商回标',
  bid_open: '开标',
  bid_determine: '定标',
  bid_notify: '中标/未中标通知',
  contract_approval: '合同审批',
  production: '生产',
  shipping: '运输',
  acceptance: '验收',
}

export const STAGE_KEYS = Object.keys(STAGE_MAP)

export const STAGE_OPTIONS = Object.entries(STAGE_MAP).map(([k, v]) => ({ value: k, label: v }))

// 4-color scheme: completed=green, current=blue, pending=gray, blocked=red
export const STAGE_COLORS = {
  requirement: '#1677ff',
  supplier_dev: '#1677ff',
  tech_exchange: '#1677ff',
  sampling: '#1677ff',
  bid_approval: '#1677ff',
  bid_issue: '#1677ff',
  bid_qa: '#1677ff',
  bid_return: '#1677ff',
  bid_open: '#1677ff',
  bid_determine: '#1677ff',
  bid_notify: '#1677ff',
  contract_approval: '#1677ff',
  production: '#1677ff',
  shipping: '#1677ff',
  acceptance: '#1677ff',
}

export const NODE_STATUS_COLORS = {
  completed: '#52c41a',  // Green
  in_progress: '#1677ff', // Blue
  pending: '#d9d9d9',    // Gray
  blocked: '#ff4d4f',    // Red
  overdue: '#ff4d4f',    // Red
}
```

- [ ] **Step 7: Update NodeBar component for 16 stages and 4-color scheme**

```jsx
// web/src/components/NodeBar.jsx — replace entire file
import React from 'react'
import { Tooltip } from 'antd'
import { STAGE_KEYS, STAGE_MAP as STAGE_LABELS, NODE_STATUS_COLORS } from '../constants/stages'

export default function NodeBar({ nodes = [], currentStage }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {STAGE_KEYS.map((key) => {
        const node = nodes.find(n => n.fields?.stage_key === key)
        const status = node?.fields?.status || 'pending'
        const color = NODE_STATUS_COLORS[status] || NODE_STATUS_COLORS.pending
        return (
          <Tooltip key={key} title={`${STAGE_LABELS[key]}: ${status}`}>
            <div style={{
              flex: 1, height: 4, borderRadius: 2,
              background: color,
              opacity: status === 'pending' ? 0.3 : 1,
            }} />
          </Tooltip>
        )
      })}
    </div>
  )
}
```

---

## Task 3: Business Rule Engine

**Goal:** Implement fast rules (4 mandatory nodes) vs bidding rules (12 mandatory nodes) based on task type.

**Files:**
- Create: `server/src/mcp/rules.js`
- Modify: `server/src/mcp/index.js`

- [ ] **Step 1: Create rules.js**

```js
// server/src/mcp/rules.js (NEW FILE)

// 快速规则: 单次<100万 / 单一来源
const FAST_RULE_MANDATORY = ['requirement', 'bid_issue', 'bid_determine', 'contract_approval']

// 招标规则: 单次≥100万 / 框架招标
const BIDDING_RULE_MANDATORY = [
  'requirement', 'supplier_dev', 'tech_exchange',
  'bid_approval', 'bid_issue', 'bid_qa',
  'bid_return', 'bid_open', 'bid_determine',
  'bid_notify', 'contract_approval', 'sampling',
]

const TASK_TYPE_RULES = {
  '单次采购<100万': 'fast',
  '单次采购≥100万': 'bidding',
  '单一来源': 'fast',
  '框架招标': 'bidding',
}

function getMandatoryNodes(taskType) {
  const rule = TASK_TYPE_RULES[taskType] || 'bidding'
  return rule === 'fast' ? FAST_RULE_MANDATORY : BIDDING_RULE_MANDATORY
}

function isNodeMandatory(taskType, stageKey) {
  const mandatory = getMandatoryNodes(taskType)
  return mandatory.includes(stageKey)
}

function getNodeValidation(taskType, stageKey, nodeData) {
  const mandatory = getMandatoryNodes(taskType)
  const isMandatory = mandatory.includes(stageKey)

  if (isMandatory) {
    // Mandatory nodes require actual_date
    if (!nodeData.actual_date) {
      return { valid: false, message: `节点"${stageKey}"为必填项，需要填写实际完成日期` }
    }
  }

  // Optional nodes: can be left empty
  return { valid: true }
}

module.exports = { getMandatoryNodes, isNodeMandatory, getNodeValidation, TASK_TYPE_RULES, FAST_RULE_MANDATORY, BIDDING_RULE_MANDATORY }
```

- [ ] **Step 2: Export rules from mcp/index.js**

```js
// server/src/mcp/index.js — add export
const rules = require('./rules')
module.exports = { callTool, TOOLS, STAGE_MAP: nodes.STAGE_MAP, STAGE_KEYS: nodes.STAGE_KEYS, ...rules }
```

---

## Task 4: Permission Middleware

**Role-based access:** Admin sees all projects, buyer sees only own projects.

**Files:**
- Create: `server/src/middleware/auth.js`
- Modify: `server/src/index.js`
- Modify: `server/src/routes/projects.js`
- Modify: `server/src/routes/issues.js`

- [ ] **Step 1: Create auth middleware**

```js
// server/src/middleware/auth.js (NEW FILE)
const client = require('../feishu/client')

// Extract user from token
async function extractUser(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' })
  }

  const token = authHeader.slice(7)
  try {
    // Verify token and get user info
    const userRes = await client.authen.v1.accessToken.list({
      params: { token }
    })
    const user = userRes.data?.user
    if (!user) {
      return res.status(401).json({ error: 'token无效' })
    }
    req.user = user
    next()
  } catch (e) {
    return res.status(401).json({ error: 'token已过期' })
  }
}

// Check if user is admin
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' })
  }
  next()
}

// Filter projects by owner (buyer only sees own)
function filterByOwner(req, res, next) {
  if (req.user?.role === 'admin') {
    // Admin sees all
    return next()
  }
  // Buyer: add owner filter
  req.query.owner = req.user?.name || req.user?.open_id
  next()
}

module.exports = { extractUser, requireAdmin, filterByOwner }
```

- [ ] **Step 2: Apply auth middleware to routes**

```js
// server/src/index.js — add after existing middleware
const { extractUser } = require('./middleware/auth')

// Apply auth to all API routes (except health)
app.use('/api', extractUser)
```

- [ ] **Step 3: Add owner filter to projects route**

```js
// server/src/routes/projects.js — add filterByOwner
const { filterByOwner } = require('../middleware/auth')

router.get('/', filterByOwner, async (req, res) => {
  try {
    const projects = await callTool('list_projects', req.query)
    res.json({ data: projects })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
```

- [ ] **Step 4: Add owner filter to issues route**

```js
// server/src/routes/issues.js — add filterByOwner
const { filterByOwner } = require('../middleware/auth')

router.get('/', filterByOwner, async (req, res) => {
  try {
    const issues = await callTool('list_issues', {
      projectId: req.query.projectId,
      status: req.query.status,
      priority: req.query.priority,
      owner: req.query.owner, // NEW: filter by owner
    })
    res.json({ data: issues })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
```

- [ ] **Step 5: Update listIssues to support owner filter**

```js
// server/src/mcp/issues.js — update listIssues
async function listIssues(params = {}) {
  let issues = await listRecords('issues')
  if (params.projectId) issues = issues.filter(i => i.fields.project_id === params.projectId)
  if (params.status) issues = issues.filter(i => i.fields.status === params.status)
  if (params.priority) issues = issues.filter(i => i.fields.priority === params.priority)
  if (params.owner) issues = issues.filter(i => i.fields.assignee === params.owner)
  return issues
}
```

---

## Task 5: Dashboard with BU/Owner Stats

**Goal:** New dashboard with BU-based statistics, owner stats, and amount aggregation.

**Files:**
- Create: `server/src/mcp/stats.js`
- Create: `web/src/pages/DashboardV2.jsx`
- Modify: `web/src/App.jsx`

- [ ] **Step 1: Create stats.js**

```js
// server/src/mcp/stats.js (NEW FILE)
const { listRecords } = require('../feishu/bitable')

async function getDashboardStats() {
  const projects = await listRecords('projects')
  const nodes = await listRecords('nodes')
  const issues = await listRecords('issues')

  const currentYear = new Date().getFullYear()
  const yearStart = `${currentYear}-01-01`
  const yearEnd = `${currentYear}-12-31`

  // Basic stats
  const doing = projects.filter(p => p.fields?.status === '进行中').length
  const completed = projects.filter(p => p.fields?.status === '项目完成').length
  const total = projects.length

  // 已定标: bid_determine node completed
  const bidDetermined = projects.filter(p => {
    const projectNodes = nodes.filter(n => n.fields?.project_id === p.record_id)
    return projectNodes.some(n => n.fields?.stage_key === 'bid_determine' && n.fields?.actual_date)
  }).length

  // 100万以上项目
  const over100w = projects.filter(p => (p.fields?.budget || 0) >= 100).length

  // BU stats
  const buStats = {}
  const buses = ['LBU', 'FBU', 'HQU', 'ABU', 'PBU', 'GUS', 'GUE']
  buses.forEach(bu => {
    const buProjects = projects.filter(p => p.fields?.bu === bu)
    const buDoing = buProjects.filter(p => p.fields?.status === '进行中').length
    const buYearProjects = buProjects.filter(p => {
      const created = p.created_time ? new Date(p.created_time * 1000) : null
      return created && created >= new Date(yearStart) && created <= new Date(yearEnd)
    })
    const buYearAmount = buYearProjects.reduce((sum, p) => sum + (p.fields?.budget || 0), 0)
    const totalAmount = projects.reduce((sum, p) => sum + (p.fields?.budget || 0), 0)

    buStats[bu] = {
      doing: buDoing,
      yearCount: buYearProjects.length,
      yearAmount: buYearAmount,
      percentage: totalAmount > 0 ? Math.round((buYearAmount / totalAmount) * 100) : 0,
    }
  })

  // Owner stats
  const ownerStats = {}
  projects.forEach(p => {
    const owner = p.fields?.owner
    if (!owner) return
    if (!ownerStats[owner]) ownerStats[owner] = { doing: 0, yearCount: 0 }
    if (p.fields?.status === '进行中') ownerStats[owner].doing++
    const created = p.created_time ? new Date(p.created_time * 1000) : null
    if (created && created >= new Date(yearStart) && created <= new Date(yearEnd)) {
      ownerStats[owner].yearCount++
    }
  })

  return {
    basic: { doing, completed, total, bidDetermined, over100w },
    buStats,
    ownerStats,
  }
}

module.exports = { getDashboardStats }
```

- [ ] **Step 2: Add stats route**

```js
// server/src/routes/stats.js (NEW FILE)
const express = require('express')
const router = express.Router()
const { getDashboardStats } = require('../mcp/stats')

router.get('/', async (req, res) => {
  try {
    const stats = await getDashboardStats()
    res.json({ data: stats })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
```

- [ ] **Step 3: Register stats route in index.js**

```js
// server/src/index.js — add
const statsRouter = require('./routes/stats')
app.use('/api/stats', statsRouter)
```

- [ ] **Step 4: Create DashboardV2.jsx**

```jsx
// web/src/pages/DashboardV2.jsx (NEW FILE)
import React, { useState, useEffect } from 'react'
import { Row, Col, Card, Table, Tag, Space, Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getStats, getUsers } from '../api'

export default function DashboardV2() {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    Promise.all([getStats(), getUsers()])
      .then(([sRes, uRes]) => {
        setStats(sRes.data?.data)
        setUsers(uRes.data?.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!stats) return null

  const { basic, buStats, ownerStats } = stats

  // Basic stat cards
  const statCards = [
    { title: '项目总数', value: basic.total, color: '#8c8c8c' },
    { title: '进行中', value: basic.doing, color: '#1677ff' },
    { title: '已定标', value: basic.bidDetermined, color: '#52c41a' },
    { title: '100万以上', value: basic.over100w, color: '#722ed1' },
  ]

  // BU table data
  const buData = Object.entries(buStats).map(([bu, data]) => ({
    key: bu,
    bu,
    ...data,
  })).filter(d => d.doing > 0 || d.yearCount > 0)

  // Owner table data
  const ownerData = Object.entries(ownerStats).map(([owner, data]) => ({
    key: owner,
    owner,
    ...data,
  }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>项目看板</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/projects/new')}>
          创建项目
        </Button>
      </div>

      {/* Basic Stats */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {statCards.map((s, i) => (
          <Col span={6} key={i}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 6 }}>{s.title}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        {/* BU Stats */}
        <Col span={14}>
          <Card title="按 BU 统计">
            <Table
              dataSource={buData}
              pagination={false}
              columns={[
                { title: 'BU', dataIndex: 'bu' },
                { title: '进行中', dataIndex: 'doing' },
                { title: '本年累计', dataIndex: 'yearCount' },
                { title: '年度金额(万)', dataIndex: 'yearAmount', render: v => v.toLocaleString() },
                { title: '占比', dataIndex: 'percentage', render: v => `${v}%` },
              ]}
            />
          </Card>
        </Col>

        {/* Owner Stats */}
        <Col span={10}>
          <Card title="按负责人统计">
            <Table
              dataSource={ownerData}
              pagination={false}
              columns={[
                { title: '负责人', dataIndex: 'owner' },
                { title: '进行中', dataIndex: 'doing' },
                { title: '本年累计', dataIndex: 'yearCount' },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
```

- [ ] **Step 5: Add getStats to api/index.js**

```js
// web/src/api/index.js — add
export const getStats = () => api.get('/stats')
export const getGroups = () => api.get('/groups')
export const createGroup = (data) => api.post('/groups', data)
export const deleteGroup = (chatId) => api.delete(`/groups/${chatId}`)
```

- [ ] **Step 6: Update App.jsx routes**

```jsx
// web/src/App.jsx — update imports and routes
import DashboardV2 from './pages/DashboardV2'

// Replace Dashboard with DashboardV2 in routes
<Route index element={<DashboardV2 />} />
```

---

## Task 6: Timeline Project List

**Goal:** Replace table view with horizontal timeline view for project list.

**Files:**
- Create: `web/src/pages/ProjectTimeline.jsx`
- Modify: `web/src/App.jsx`

- [ ] **Step 1: Create ProjectTimeline.jsx**

```jsx
// web/src/pages/ProjectTimeline.jsx (NEW FILE)
import React, { useState, useEffect } from 'react'
import { Card, Input, Select, Space, Tag, Button, Modal, Form, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getProjects, createProject, getUsers } from '../api'
import { STAGE_MAP, NODE_STATUS_COLORS } from '../constants/stages'

export default function ProjectTimeline() {
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterOwner, setFilterOwner] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const res = await getProjects()
      setProjects(res.data?.data || [])
    } catch {}
    setLoading(false)
  }

  const fetchUsers = async () => {
    try {
      const res = await getUsers()
      setUsers(res.data?.data || [])
    } catch {}
  }

  useEffect(() => {
    fetchProjects()
    fetchUsers()
  }, [])

  const filtered = projects.filter(p => {
    if (searchText && !p.fields?.name?.toLowerCase().includes(searchText.toLowerCase())) return false
    if (filterOwner && p.fields?.owner !== filterOwner) return false
    return true
  })

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      await createProject(values)
      message.success('项目创建成功')
      setModalOpen(false)
      form.resetFields()
      fetchProjects()
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message
      if (msg) message.error(msg)
    }
  }

  const userOptions = users.map(u => ({
    value: u.fields?.name || u.fields?.feishu_open_id,
    label: u.fields?.name || '未知用户',
  }))

  const statusColors = {
    '进行中': 'blue',
    '项目完成': 'green',
    '项目暂停': 'orange',
    '项目取消': 'red',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>项目列表</h1>
        <Space>
          <Input.Search placeholder="搜索项目名称" style={{ width: 200 }} allowClear onChange={e => setSearchText(e.target.value)} />
          <Select placeholder="按负责人" allowClear style={{ width: 160 }} onChange={setFilterOwner} options={userOptions} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建项目</Button>
        </Space>
      </div>

      {filtered.map(project => (
        <Card
          key={project.record_id}
          style={{ marginBottom: 12, cursor: 'pointer' }}
          onClick={() => navigate(`/projects/${project.record_id}`)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{project.fields?.name}</span>
              <span style={{ marginLeft: 8, color: '#8c8c8c' }}>{project.fields?.no}</span>
            </div>
            <Space>
              <span>{project.fields?.owner}</span>
              <Tag color={statusColors[project.fields?.status] || 'default'}>{project.fields?.status}</Tag>
            </Space>
          </div>
          {/* Timeline bar */}
          <div style={{ display: 'flex', gap: 2 }}>
            {Object.entries(STAGE_MAP).map(([key, label]) => (
              <div
                key={key}
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  background: NODE_STATUS_COLORS.pending,
                  opacity: 0.3,
                }}
                title={label}
              />
            ))}
          </div>
        </Card>
      ))}

      <Modal title="创建项目" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="如：XX设备采购" />
          </Form.Item>
          <Form.Item name="bu" label="所属BU" rules={[{ required: true, message: '请选择BU' }]}>
            <Select placeholder="请选择" options={[
              { value: 'LBU', label: 'LBU' },
              { value: 'FBU', label: 'FBU' },
              { value: 'HQU', label: 'HQU' },
              { value: 'ABU', label: 'ABU' },
              { value: 'PBU', label: 'PBU' },
              { value: 'GUS', label: 'GUS' },
              { value: 'GUE', label: 'GUE' },
            ]} />
          </Form.Item>
          <Form.Item name="owner" label="负责人" rules={[{ required: true, message: '请选择负责人' }]}>
            <Select placeholder="请选择" showSearch filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} options={userOptions} />
          </Form.Item>
          <Form.Item name="budget" label="采购金额(万元)" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="taskType" label="任务类型" rules={[{ required: true, message: '请选择任务类型' }]}>
            <Select placeholder="请选择" options={[
              { value: '单次采购<100万', label: '单次采购<100万' },
              { value: '单次采购≥100万', label: '单次采购≥100万' },
              { value: '单一来源', label: '单一来源' },
              { value: '框架招标', label: '框架招标' },
            ]} />
          </Form.Item>
          <Form.Item name="applicationNo" label="申请单号">
            <Input placeholder="飞书OA单号" />
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

- [ ] **Step 2: Update App.jsx routes**

```jsx
// web/src/App.jsx — update imports and routes
import ProjectTimeline from './pages/ProjectTimeline'

// Replace ProjectList with ProjectTimeline
<Route path="projects" element={<ProjectTimeline />} />
```

---

## Task 7: Enhanced Project Detail with 16 Nodes

**Goal:** Update project detail page with new fields, 16-node timeline, and rule-based validation.

**Files:**
- Modify: `web/src/pages/ProjectDetail.jsx`

- [ ] **Step 1: Update ProjectDetail with new fields and 16-node timeline**

```jsx
// web/src/pages/ProjectDetail.jsx — key changes
// Add to imports:
import { NODE_STATUS_COLORS } from '../constants/stages'

// Update Descriptions to show new fields:
<Descriptions column={3}>
  <Descriptions.Item label="负责人">{f?.owner}</Descriptions.Item>
  <Descriptions.Item label="所属BU">{f?.bu}</Descriptions.Item>
  <Descriptions.Item label="任务类型">{f?.task_type}</Descriptions.Item>
  <Descriptions.Item label="采购金额">{f?.budget}万</Descriptions.Item>
  <Descriptions.Item label="申请单号">{f?.application_no || '-'}</Descriptions.Item>
  <Descriptions.Item label="状态"><Tag color={statusColors[f?.status]}>{f?.status}</Tag></Descriptions.Item>
</Descriptions>

// Update node timeline to show 16 stages with colors
<div style={{ display: 'flex', gap: 2, marginTop: 16 }}>
  {nodes.map(node => (
    <Tooltip key={node.fields?.stage_key} title={`${STAGE_MAP[node.fields?.stage_key]}: ${node.fields?.status}`}>
      <div
        style={{
          flex: 1,
          height: 12,
          borderRadius: 6,
          background: NODE_STATUS_COLORS[node.fields?.status] || NODE_STATUS_COLORS.pending,
          cursor: 'pointer',
        }}
        onClick={() => handleEdit(node)}
      />
    </Tooltip>
  ))}
</div>
```

---

## Task 8: Bot Group Binding & Permission

**Goal:** Bot can bind to group chats, check permissions, and support group-specific operations.

**Files:**
- Create: `server/src/bot/group.js`
- Modify: `server/src/bot/index.js`

- [ ] **Step 1: Create group.js**

```js
// server/src/bot/group.js (NEW FILE)
const { callTool } = require('../mcp')
const client = require('../feishu/client')

// Get group binding
async function getGroupBinding(chatId) {
  const groups = await callTool('list_groups')
  return groups.find(g => g.fields?.chat_id === chatId)
}

// Bind group to project
async function bindGroup(chatId, projectName, senderId) {
  // Find project by name
  const projects = await callTool('list_projects')
  const project = projects.find(p => p.fields?.name?.includes(projectName))
  if (!project) {
    return { success: false, message: `未找到项目"${projectName}"` }
  }

  // Check if group already bound
  const existing = await getGroupBinding(chatId)
  if (existing) {
    return { success: false, message: '该群已绑定其他项目，请先解绑' }
  }

  // Create binding
  await callTool('create_group', {
    chat_id: chatId,
    project_id: project.record_id,
    project_name: project.fields?.name,
  })

  return { success: true, project }
}

// Check if user is project owner
async function isProjectOwner(projectId, userId) {
  const project = await callTool('get_project', { projectId })
  return project?.fields?.owner === userId
}

module.exports = { getGroupBinding, bindGroup, isProjectOwner }
```

- [ ] **Step 2: Update bot/index.js for group binding**

```js
// server/src/bot/index.js — add group binding handling
const { getGroupBinding, bindGroup, isProjectOwner } = require('./group')

// In handleMessage, add before intent handling:
// Check for group binding command
if (text.includes('绑定')) {
  const match = text.match(/绑定\s+(.+)/)
  if (match && chatId) {
    const result = await bindGroup(chatId, match[1], senderId)
    return { text: result.message || `已绑定项目：${result.project.fields?.name}` }
  }
}

// In handleCardAction, add permission check:
if (action.action === 'confirm_node' || action.action === 'mark_abnormal') {
  // Check if user is owner
  const isOwner = await isProjectOwner(action.project_id, senderId)
  if (!isOwner) {
    return { toast: { content: '仅负责人可操作', type: 'warning' } }
  }
}
```

---

## Task 9: Bot Weekly Reports

**Goal:** Generate and send weekly reports to admin groups and project groups.

**Files:**
- Create: `server/src/bot/weekly.js`
- Modify: `server/src/bot/index.js`

- [ ] **Step 1: Create weekly.js**

```js
// server/src/bot/weekly.js (NEW FILE)
const { callTool } = require('../mcp')
const client = require('../feishu/client')

async function generateAdminWeeklyReport() {
  const projects = await callTool('list_projects')
  const nodes = await callTool('list_nodes') // Need to add this tool

  const thisWeek = new Date()
  thisWeek.setDate(thisWeek.getDate() - 7)

  // Filter projects active this week
  const activeProjects = projects.filter(p => {
    const updated = p.last_modified_time ? new Date(p.last_modified_time * 1000) : null
    return updated && updated >= thisWeek
  })

  // Build report
  const lines = ['📊 采购项目周报', '']
  lines.push(`本周活跃项目：${activeProjects.length} 个`)
  lines.push('')

  activeProjects.forEach(p => {
    const projectNodes = nodes.filter(n => n.fields?.project_id === p.record_id)
    const completed = projectNodes.filter(n => n.fields?.actual_date).length
    lines.push(`· ${p.fields?.name}（${p.fields?.no}）`)
    lines.push(`  状态：${p.fields?.status} | 进度：${completed}/${projectNodes.length} 节点`)
  })

  return lines.join('\n')
}

async function generateGroupWeeklyReport(chatId) {
  const binding = await callTool('get_group_binding', { chatId })
  if (!binding) return null

  const projectId = binding.fields?.project_id
  const project = await callTool('get_project', { projectId })
  const nodes = await callTool('list_project_nodes', { projectId })

  const completed = nodes.filter(n => n.fields?.actual_date).length
  const total = nodes.length
  const current = nodes.find(n => n.fields?.status === 'in_progress')

  const lines = [`📊 ${project.fields?.name} 周报`, '']
  lines.push(`项目编号：${project.fields?.no}`)
  lines.push(`当前阶段：${current ? STAGE_MAP[current.fields?.stage_key] : '已完成'}`)
  lines.push(`进度：${completed}/${total} 节点完成`)
  lines.push('')

  // List this week's changes
  const thisWeek = new Date()
  thisWeek.setDate(thisWeek.getDate() - 7)
  const recentNodes = nodes.filter(n => {
    const updated = n.last_modified_time ? new Date(n.last_modified_time * 1000) : null
    return updated && updated >= thisWeek
  })

  if (recentNodes.length > 0) {
    lines.push('本周变化：')
    recentNodes.forEach(n => {
      lines.push(`· ${STAGE_MAP[n.fields?.stage_key]}：${n.fields?.status}`)
    })
  }

  return lines.join('\n')
}

async function sendWeeklyReports() {
  // Admin weekly
  const adminReport = await generateAdminWeeklyReport()
  const configs = await callTool('list_weekly_config')
  if (configs.length > 0) {
    const config = configs[0]
    const chatIds = JSON.parse(config.fields?.admin_chat_ids || '[]')
    for (const chatId of chatIds) {
      await client.im.message.create({
        params: { receive_id_type: 'chat_id' },
        data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: adminReport }) },
      })
    }
  }

  // Group weekly
  const groups = await callTool('list_groups')
  for (const group of groups) {
    const chatId = group.fields?.chat_id
    const report = await generateGroupWeeklyReport(chatId)
    if (report) {
      await client.im.message.create({
        params: { receive_id_type: 'chat_id' },
        data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: report }) },
      })
    }
  }
}

module.exports = { generateAdminWeeklyReport, generateGroupWeeklyReport, sendWeeklyReports }
```

- [ ] **Step 2: Add weekly report trigger in index.js**

```js
// server/src/index.js — add weekly report endpoint
app.post('/api/weekly/send', async (req, res) => {
  try {
    const { sendWeeklyReports } = require('./bot/weekly')
    await sendWeeklyReports()
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})
```

- [ ] **Step 3: Add weekly report command to bot**

```js
// server/src/bot/index.js — add in handleMessage
if (text.includes('周报') || text.includes('weekly')) {
  const report = await generateGroupWeeklyReport(chatId)
  return { text: report || '未绑定项目，无法生成周报' }
}
```

---

## Task 10: Frontend Permission Guard

**Goal:** Hide admin-only UI elements for non-admin users.

**Files:**
- Create: `web/src/components/PermissionGuard.jsx`
- Modify: `web/src/components/Layout.jsx`
- Modify: `web/src/pages/ProjectDetail.jsx`

- [ ] **Step 1: Create PermissionGuard.jsx**

```jsx
// web/src/components/PermissionGuard.jsx (NEW FILE)
import React from 'react'

export default function PermissionGuard({ children, requiredRole = 'admin' }) {
  const user = JSON.parse(localStorage.getItem('feishu_user') || '{}')
  if (user.role !== requiredRole) {
    return null
  }
  return children
}
```

- [ ] **Step 2: Use PermissionGuard in Layout**

```jsx
// web/src/components/Layout.jsx — wrap admin menu item
import PermissionGuard from './PermissionGuard'

{ key: '/admin', icon: <TeamOutlined />, label: '用户管理',
  hidden: user?.role !== 'admin' },
```

- [ ] **Step 3: Use PermissionGuard in ProjectDetail**

```jsx
// web/src/pages/ProjectDetail.jsx — wrap admin actions
<PermissionGuard requiredRole="admin">
  <Popconfirm title="确认删除该项目？" onConfirm={handleDeleteProject}>
    <Button danger icon={<DeleteOutlined />}>删除项目</Button>
  </Popconfirm>
</PermissionGuard>
```

---

## Task 11: Integration & Testing

**Goal:** Verify all V2 features work together.

- [ ] **Step 1: Run backend tests**

```bash
cd server && npm test
```

- [ ] **Step 2: Run frontend build**

```bash
cd web && npm run build
```

- [ ] **Step 3: Test API endpoints**

```bash
# Health check
curl https://procurement-server-production-b325.up.railway.app/api/health

# Stats
curl -H "Authorization: Bearer $TOKEN" https://procurement-server-production-b325.up.railway.app/api/stats
```

- [ ] **Step 4: Deploy to Vercel**

```bash
npm run deploy
```

- [ ] **Step 5: Deploy to Railway**

```bash
railway up --service procurement-server
```

- [ ] **Step 6: Update CLAUDE.md with V2 features**

```markdown
## V2.0 Features (2026-06-05)

### Dashboard 项目看板
- 统计卡片：项目总数/进行中/已定标/100万元以上
- 按 BU 统计：进行中+本年累计+年度金额+占比
- 按负责人统计：进行中+本年累计
- 创建项目快捷入口

### 项目列表（时间线视图）
- 横向时间线展示 16 个节点
- 节点颜色：已完成=绿色/当前=蓝色/未开始=灰色/阻塞=红色
- 点击节点弹窗编辑

### 业务规则引擎
- 快速规则（<100万/单一来源）：必填4个节点
- 招标规则（≥100万/框架招标）：必填12个节点
- 项目自动完成：全部16节点有实际日期时自动更新

### 权限管理
- 管理员：看所有项目
- 采购员：只看自己负责的项目

### 飞书 Bot 增强
- 群聊绑定项目
- 群聊指令：查询/更新/创建问题
- 周报推送：管理员周报+项目群周报

### 16 阶段节点
- 需求确认→供应商开发→技术交流→打样→招标方案审批→发标→答疑→供应商回标→开标→定标→中标/未中标通知→合同审批→生产→运输→验收
```

---

## Task 12: Deployment & Rollback Strategy

**Goal:** Ensure V2 deployment is safe with rollback capability.

- [ ] **Step 1: Create git tag for V1.0**

```bash
git tag -a v1.0 -m "V1.0 stable release"
git push origin v1.0
```

- [ ] **Step 2: Merge v2-dev to main after testing**

```bash
git checkout main
git merge v2-dev
git push origin main
```

- [ ] **Step 3: Rollback procedure if needed**

```bash
# Rollback backend
git checkout v1.0 -- server/
railway up --service procurement-server

# Rollback frontend
git checkout v1.0 -- web/
npm run deploy
```

---

## Key Decisions Log

1. **16 Stages**: Upgraded from V1's 13 stages to V2's 16 stages (added sampling, bid_approval renamed, contract renamed, acceptance added)
2. **4-Color Status**: Green (completed), Blue (in_progress), Gray (pending), Red (blocked/overdue)
3. **Auto-Completion**: Project status auto-updates to "项目完成" when all 16 nodes have actual_date
4. **Project Numbering**: Auto-prefix by company (CG for 纵腾, GFCG for GOFO), sequential 3-digit suffix
5. **Permission Model**: Admin sees all, buyer sees only own projects
6. **Business Rules**: Fast rules (4 mandatory) vs bidding rules (12 mandatory)
7. **Group Binding**: One group = one project, verified by owner
8. **Weekly Reports**: Admin weekly (overall) + project group weekly (changes)
