const { getFeishuUserInfo } = require('../feishu/user')
const { listRecords } = require('../feishu/bitable')

// Simple in-memory cache for user lookups
const userCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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

    // Look up user role from bitable
    const users = await listRecords('users')
    const user = users.find(u => u.fields.feishu_open_id === openId)
    if (!user) {
      return res.status(401).json({ error: '用户不存在' })
    }

    const userData = {
      open_id: user.fields.feishu_open_id,
      name: user.fields.name,
      role: user.fields.role || 'member',
      record_id: user.record_id,
    }

    // Cache the result
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
// Note: Using name for ownership matching. Schema migration to open_id recommended.
// Current data model stores owner/assignee as display name.
function filterByOwner(req, res, next) {
  if (req.user.role === 'admin') {
    return next()
  }
  req.query.owner = req.user.name
  next()
}

module.exports = { extractUser, requireAdmin, filterByOwner }
