const express = require('express')
const router = express.Router()
const { callTool } = require('../mcp')
const { filterByOwner, requireAdmin } = require('../middleware/auth')

router.get('/', filterByOwner, async (req, res) => {
  try {
    const projects = await callTool('list_projects', req.query)
    res.json({ data: projects })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const project = await callTool('get_project', { projectId: req.params.id })
    res.json({ data: project })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const project = await callTool('create_project', req.body)
    // 自动初始化 13 个节点
    if (project?.record_id) {
      await callTool('init_project_nodes', { projectId: project.record_id })
    }
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

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await callTool('delete_project', { projectId: req.params.id })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
