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
    console.error('List issues error:', e.message)
    res.status(500).json({ error: '查询问题失败' })
  }
})

router.post('/', async (req, res) => {
  try {
    const issue = await callTool('create_issue', req.body)
    res.json({ data: issue })
  } catch (e) {
    console.error('Create issue error:', e.message)
    res.status(500).json({ error: '创建问题失败' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const issue = await callTool('update_issue', { issueId: req.params.id, ...req.body })
    res.json({ data: issue })
  } catch (e) {
    console.error('Update issue error:', e.message)
    res.status(500).json({ error: '更新问题失败' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await callTool('delete_issue', { issueId: req.params.id })
    res.json({ success: true })
  } catch (e) {
    console.error('Delete issue error:', e.message)
    res.status(500).json({ error: '删除问题失败' })
  }
})

module.exports = router
