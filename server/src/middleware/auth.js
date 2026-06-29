const { getFeishuUserInfo } = require('../feishu/user')
const { listRecords } = require('../db')
const { sanitizeFilterValue } = require('../utils/sanitize')

// Simple in-memory cache for user lookups (max 500 entries)
const userCache = new Map()
const CACHE_TTL = 5 * 24 * 60 * 60 * 1000 // 5 days
const MAX_CACHE = 500

// 解码 JWT payload（不验证签名，仅提取信息）
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch { return null }
}

// 壳子角色映射
function mapShellRole(jwtPayload) {
  if (!jwtPayload) return 'pm'
  const role = jwtPayload.role || ''
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 'admin'
  return 'pm'
}

// 调用 HRAS 壳子验证 token
async function validateShellToken(token) {
  const shellUrl = process.env.HRAS_SHELL_URL
  if (!shellUrl) return null

  try {
    const resp = await fetch(`${shellUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return null
    const result = await resp.json()
    // 壳子返回 { code: 200, data: { id, username, realName, ... } }
    if (result.code === 200 && result.data) {
      return result.data
    }
    return null
  } catch {
    return null
  }
}

// 从壳子用户信息匹配本地用户（按飞书 open_id 或名称匹配，或自动注册）
async function findOrCreateShellUser(shellUser, role) {
  const name = shellUser.realName || shellUser.username
  if (!name) return null

  const users = await listRecords('users')
  let user = null

  // 1. 先按飞书 open_id 匹配（壳子返回了 feishuOpenId）
  if (shellUser.feishuOpenId) {
    user = users.find(u => u.fields?.feishu_open_id === shellUser.feishuOpenId)
  }
  // 2. 再按名称匹配
  if (!user) {
    user = users.find(u => u.fields?.name === name)
  }

  if (!user) {
    // 3. 壳子用户首次访问：自动注册，角色从 JWT 解析
    const { createRecord } = require('../db')
    const record = await createRecord('users', {
      name,
      feishu_open_id: shellUser.feishuOpenId || `hras_${shellUser.id}`,
      feishu_user_id: shellUser.feishuUserId || `hras_${shellUser.id}`,
      role: role || 'pm',
    })
    return {
      open_id: record.fields?.feishu_open_id || shellUser.feishuOpenId,
      name,
      role: role || 'pm',
      record_id: record.record_id,
    }
  }

  return {
    open_id: user.fields.feishu_open_id,
    name: user.fields.name,
    role: user.fields.role || role || 'pm',
    record_id: user.record_id,
  }
}

// Extract user from token and attach to req.user
async function extractUser(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' })
  }

  const token = authHeader.slice(7)

  // ── 优先：HRAS 壳子 Token 验证 ────────────────────────────
  const shellUser = await validateShellToken(token)
  if (shellUser) {
    try {
      const jwtPayload = decodeJwtPayload(token)
      const role = mapShellRole(jwtPayload)
      const userData = await findOrCreateShellUser(shellUser, role)
      if (userData) {
        req.user = userData
        return next()
      }
    } catch (e) {
      console.error('Shell user lookup error:', e.message)
    }
  }

  // ── 回退：飞书 Token 验证 ──────────────────────────────────
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

    // Look up user by open_id filter
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

function invalidateUserCache(openId) {
  userCache.delete(openId)
}

module.exports = { extractUser, requireAdmin, filterByOwner, invalidateUserCache }
