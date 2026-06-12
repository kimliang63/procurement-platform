const { getFeishuUserInfo } = require('../feishu/user')
const { listRecords } = require('../feishu/bitable')
const { sanitizeFilterValue } = require('../utils/sanitize')

// Simple in-memory cache for user lookups (max 500 entries)
const userCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE = 500

// Extract user from token and attach to req.user
async function extractUser(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' })
  }

  const token = authHeader.slice(7)
  try {
    const userInfo = await getFeishuUserInfo(token)
    const openId = userInfo.open_id
    if (!openId) {
      return res.status(401).json({ error: 'token无效' })
    }

    // Check cache first
    const cached = userCache.get(openId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      req.user = cached.user
      return next()
    }

    // Look up user by open_id filter (not full table scan)
    const filterExpr = `CurrentValue.[feishu_open_id]="${sanitizeFilterValue(openId)}"`
    const users = await listRecords('users', { filter: filterExpr })
    const user = users[0]
    if (!user) {
      return res.status(401).json({ error: '用户不存在' })
    }

    const userData = {
      open_id: user.fields.feishu_open_id,
      name: user.fields.name,
      role: user.fields.role || 'member',
      record_id: user.record_id,
    }

    // Cache with max size enforcement
    if (userCache.size >= MAX_CACHE) {
      const first = userCache.keys().next().value
      userCache.delete(first)
    }
    userCache.set(openId, { user: userData, timestamp: Date.now() })

    req.user = userData
    next()
  } catch (e) {
    console.error('Auth error:', e.message)
    return res.status(401).json({ error: '认证失败' })
  }
}

// Check if user is admin
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' })
  }
  next()
}

// Filter by owner: admin sees all, buyer only sees own
function filterByOwner(req, res, next) {
  if (req.user.role === 'admin') {
    return next()
  }
  req.query.owner = req.user.name
  next()
}

module.exports = { extractUser, requireAdmin, filterByOwner }
