const express = require('express')
const router = express.Router()
const { getDashboardStats } = require('../mcp/stats')

router.get('/', async (req, res) => {
  try {
    const stats = await getDashboardStats()
    res.json({ data: stats })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
