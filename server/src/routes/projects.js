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
