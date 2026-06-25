const express = require('express')
const router = express.Router()
const { listRecords, createRecord } = require('../db')
const { sendWeeklyReports } = require('../bot/weekly')
const { requireAdmin } = require('../middleware/auth')

router.get('/', requireAdmin, async (req, res) => {
  try {
    const configs = await listRecords('weekly_config')
    res.json({ data: configs })
  } catch (e) {
    console.error('List weekly config error:', e.message)
    res.status(500).json({ error: '查询周报配置失败' })
  }
})

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { admin_chat_ids, specific_users } = req.body
    if (!admin_chat_ids && !specific_users) {
      return res.status(400).json({ error: '缺少配置参数' })
    }
    const config = await createRecord('weekly_config', {
      admin_chat_ids: JSON.stringify(admin_chat_ids || []),
      specific_users: JSON.stringify(specific_users || []),
      updated_at: new Date().toISOString(),
    })
    res.json({ data: config })
  } catch (e) {
    console.error('Create weekly config error:', e.message)
    res.status(500).json({ error: '创建周报配置失败' })
  }
})

router.post('/send', requireAdmin, async (req, res) => {
  try {
    const results = await sendWeeklyReports()
    res.json({ success: true, data: results })
  } catch (e) {
    console.error('Send weekly error:', e.message)
    res.status(500).json({ error: '发送周报失败' })
  }
})

module.exports = router
