const express = require('express')
const router = express.Router()
const { listRecords, createRecord, updateRecord, deleteRecord } = require('../db')

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
    if (!chat_id || !project_id) {
      return res.status(400).json({ error: 'chat_id and project_id are required' })
    }
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
