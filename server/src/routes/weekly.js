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
