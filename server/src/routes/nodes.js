const express = require('express')
const router = express.Router()
const { callTool } = require('../mcp')

// Helper: check if user owns the project (admin bypasses)
async function checkProjectOwnership(req, res, next) {
  if (req.user?.role === 'admin') return next()

  const projectId = req.params.projectId
  if (!projectId) return next()

  try {
    const project = await callTool('get_project', { projectId })
    if (project?.fields?.owner !== req.user?.name) {
      return res.status(403).json({ error: '无权操作此项目' })
    }
    next()
  } catch (e) {
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
