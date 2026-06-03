const express = require('express')
const router = express.Router()
const { callTool } = require('../mcp')

router.get('/:projectId', async (req, res) => {
  try {
    const nodes = await callTool('list_project_nodes', { projectId: req.params.projectId })
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
      actualDate: req.body.actualDate,
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
