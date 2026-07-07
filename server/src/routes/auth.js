const express = require('express')
const router = express.Router()
const client = require('../feishu/client')
const { listRecords, createRecord, updateRecord } = require('../db')
const { getFeishuUserInfo } = require('../feishu/user')
const { invalidateUserCache } = require('../middleware/auth')

// 跳转飞书授权页
router.get('/feishu', (req, res) => {
  const appId = process.env.FEISHU_APP_ID
  const redirectUri = encodeURIComponent(`${process.env.SERVER_URL}/api/auth/feishu/callback`)
  const url = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${redirectUri}&response_type=code`
  console.log('[Auth] Redirecting to Feishu:', url.substring(0, 100))
  res.redirect(url)
})

// 飞书回调
router.get('/feishu/callback', async (req, res) => {
  const { code } = req.query
  console.log('[Auth] Callback received, code:', code ? code.substring(0, 10) + '...' : 'MISSING')
  if (!code) return res.status(400).json({ error: 'Missing code' })

  try {
    const tokenRes = await client.authen.accessToken.create({
      data: { grant_type: 'authorization_code', code },
    })

    // Log response structure (redact sensitive fields)
    console.log('[Auth] Token response code:', tokenRes.code)
    console.log('[Auth] Token response msg:', tokenRes.msg)

    const tokenData = tokenRes.data || {}
    // Handle both flat and nested response formats
    const access_token = tokenData.access_token || tokenData.user?.access_token || ''
    const openId = tokenData.open_id || tokenData.user?.open_id || ''
    const employeeName = tokenData.name || tokenData.user?.name || '未知用户'
    const avatarUrl = tokenData.avatar_url || tokenData.avatar_thumb || tokenData.user?.avatar_url || ''

    console.log('[Auth] Extracted:', { hasToken: !!access_token, openId, employeeName })

    if (!access_token) {
      console.error('[Auth] No access_token in response!')
      return res.redirect(`${process.env.WEB_URL}/auth/callback?error=${encodeURIComponent('Token exchange failed: no access_token')}`)
    }

    // 写入 users 表
    const existingUsers = await listRecords('users')
    const existing = existingUsers.find(u => u.fields.feishu_open_id === openId)

    const userData = {
      feishu_open_id: openId,
      feishu_user_id: tokenData.user_id || tokenData.user?.user_id || '',
      name: employeeName,
      avatar: avatarUrl,
      role: 'pm',
    }

    if (existing) {
      // 保留原有角色，不覆盖
      userData.role = existing.fields?.role || userData.role
      await updateRecord('users', existing.record_id, userData)
    } else {
      await createRecord('users', userData)
    }
    // 清除缓存，确保角色变更立即生效
    invalidateUserCache(openId)

    const user = encodeURIComponent(JSON.stringify({
      openId,
      name: employeeName,
      avatar: avatarUrl,
    }))
    const redirectUrl = `${process.env.WEB_URL}/auth/callback?token=${encodeURIComponent(access_token)}&user=${user}`
    console.log('[Auth] Redirecting to frontend:', `${process.env.WEB_URL}/auth/callback?token=...&user=...`)
    res.redirect(redirectUrl)
  } catch (e) {
    console.error('[Auth] SSO callback error:', e.message)
    console.error('[Auth] SSO callback stack:', e.stack)
    res.redirect(`${process.env.WEB_URL}/auth/callback?error=${encodeURIComponent(e.message)}`)
  }
})

// 获取当前用户信息（通过 token 校验身份）
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'No token' })

  try {
    const token = authHeader.replace('Bearer ', '')
    const userInfo = await getFeishuUserInfo(token)
    const openId = userInfo.open_id
    if (!openId) return res.status(401).json({ error: 'Invalid token' })

    const users = await listRecords('users')
    const user = users.find(u => u.fields.feishu_open_id === openId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    res.json({
      data: {
        open_id: user.fields.feishu_open_id,
        name: user.fields.name,
        avatar: user.fields.avatar,
        role: user.fields.role || 'pm',
        record_id: user.record_id,
      }
    })
  } catch (e) {
    console.error('[Auth] /me error:', e.message)
    res.status(401).json({ error: e.message })
  }
})

// 更新用户角色（仅管理员可用）
router.put('/role', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'No token' })

  try {
    const token = authHeader.replace('Bearer ', '')
    const userInfo = await getFeishuUserInfo(token)
    const operatorOpenId = userInfo.open_id || ''

    const users = await listRecords('users')
    const operator = users.find(u => u.fields.feishu_open_id === operatorOpenId)
    if (!operator || operator.fields.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' })
    }

    const { record_id, role } = req.body
    if (!record_id || !['admin', 'pm'].includes(role)) {
      return res.status(400).json({ error: '参数错误' })
    }

    await updateRecord('users', record_id, { role })
    // Invalidate auth cache so role change takes effect immediately
    const allUsers = await listRecords('users')
    const targetUser = allUsers.find(u => u.record_id === record_id)
    if (targetUser?.fields?.feishu_open_id) {
      invalidateUserCache(targetUser.fields.feishu_open_id)
    }
    res.json({ success: true })
  } catch (e) {
    console.error('Update role error:', e.message)
    res.status(500).json({ error: '更新角色失败' })
  }
})

// 获取所有用户（用于下拉选择，不需要管理员权限）
router.get('/users', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: '未登录' })

  try {
    const users = await listRecords('users')
    res.json({ data: users })
  } catch (e) {
    console.error('List users error:', e.message)
    res.status(500).json({ error: '查询用户失败' })
  }
})

module.exports = router
