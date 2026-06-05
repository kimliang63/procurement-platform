const express = require('express')
const router = express.Router()
const { callTool } = require('../mcp')
const { filterByOwner } = require('../middleware/auth')

router.get('/', filterByOwner, async (req, res) => {
  try {
    const issues = await callTool('list_issues', {
      projectId: req.query.projectId,
      status: req.query.status,
      priority: req.query.priority,
      owner: req.query.owner,
    })
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

router.delete('/:id', async (req, res) => {
  try {
    await callTool('delete_issue', { issueId: req.params.id })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
