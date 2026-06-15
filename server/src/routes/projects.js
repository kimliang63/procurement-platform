const express = require('express')
const router = express.Router()
const { callTool } = require('../mcp')
const { filterByOwner, requireAdmin } = require('../middleware/auth')

router.get('/', filterByOwner, async (req, res) => {
  try {
    const projects = await callTool('list_projects', req.query)
    res.json({ data: projects })
  } catch (e) {
    console.error('List projects error:', e.message)
    res.status(500).json({ error: '查询项目失败' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const project = await callTool('get_project', { projectId: req.params.id })
    res.json({ data: project })
  } catch (e) {
    console.error('Get project error:', e.message)
    res.status(500).json({ error: '查询项目失败' })
  }
})

router.post('/', async (req, res) => {
  try {
    const project = await callTool('create_project', req.body)
    // 自动初始化节点（按规则过滤）
    if (project?.record_id) {
      await callTool('init_project_nodes', {
        projectId: project.record_id,
        isSingleSource: req.body.isSingleSource,
        budget: req.body.budget,
        procurementMethod: req.body.procurementMethod,
      })
    }
    res.json({ data: project })
  } catch (e) {
    console.error('Create project error:', e.message)
    res.status(500).json({ error: '创建项目失败' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    // 非管理员只能编辑自己负责的项目
    if (req.user.role !== 'admin') {
      const existing = await callTool('get_project', { projectId: req.params.id })
      if (existing?.fields?.owner !== req.user.name) {
        return res.status(403).json({ error: '无权编辑此项目' })
      }
    }
    const project = await callTool('update_project', { projectId: req.params.id, ...req.body })
    res.json({ data: project })
  } catch (e) {
    console.error('Update project error:', e.message)
    res.status(500).json({ error: '更新项目失败' })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await callTool('delete_project', { projectId: req.params.id })
    res.json({ success: true })
  } catch (e) {
    console.error('Delete project error:', e.message)
    res.status(500).json({ error: '删除项目失败' })
  }
})

module.exports = router
