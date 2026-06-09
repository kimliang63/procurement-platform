const express = require('express')
const router = express.Router()
const { callTool } = require('../mcp')
const { listRecords } = require('../feishu/bitable')

// Batch fetch nodes for multiple projects (single Bitable query)
router.get('/batch', async (req, res) => {
  try {
    const ids = (req.query.projectIds || '').split(',').filter(Boolean)
    if (ids.length === 0) return res.json({ data: {} })

    const allNodes = await listRecords('nodes')
    const result = {}
    ids.forEach(id => { result[id] = [] })
    allNodes.forEach(n => {
      const pid = n.fields?.project_id
      if (result[pid]) result[pid].push(n)
    })
    res.json({ data: result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Helper: check if user owns the project (admin bypasses)
async function checkProjectOwnership(req, res, next) {
  if (req.user?.role === 'admin') return next()

  const projectId = req.params.projectId
  if (!projectId) return next()

  try {
    const project = await callTool('get_project', { projectId })
    if (!project) {
      return res.status(404).json({ error: '项目不存在' })
    }
    if (project?.fields?.owner !== req.user?.name) {
      return res.status(403).json({ error: '无权操作此项目' })
    }
    next()
  } catch (e) {
    if (e.message?.includes('not found') || e.message?.includes('不存在')) {
      return res.status(404).json({ error: '项目不存在' })
    }
    next(e)
  }
}

router.get('/:projectId', checkProjectOwnership, async (req, res) => {
  try {
    const nodes = await callTool('list_project_nodes', { projectId: req.params.projectId })
    res.json({ data: nodes })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/:projectId/:stageKey', checkProjectOwnership, async (req, res) => {
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

router.post('/:projectId/:stageKey/advance', checkProjectOwnership, async (req, res) => {
  try {
    const node = await callTool('advance_node', {
      projectId: req.params.projectId,
      stageKey: req.params.stageKey,
      actualDate: req.body.actualDate,
    })
    res.json({ data: node })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/:projectId/:stageKey/abnormal', checkProjectOwnership, async (req, res) => {
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
