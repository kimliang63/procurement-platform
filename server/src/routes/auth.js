const express = require('express')
const router = express.Router()
const client = require('../feishu/client')
const { listRecords, createRecord, updateRecord } = require('../feishu/bitable')

// 跳转飞书授权页
router.get('/feishu', (req, res) => {
  const appId = process.env.FEISHU_APP_ID
  const redirectUri = encodeURIComponent(`${process.env.SERVER_URL}/api/auth/feishu/callback`)
  const url = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${redirectUri}&response_type=code`
  res.redirect(url)
})

// 飞书回调
router.get('/feishu/callback', async (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).json({ error: 'Missing code' })

  try {
    // 用 code 换取 user_access_token（token响应已包含用户信息）
    const tokenRes = await client.authen.accessToken.create({
      data: { grant_type: 'authorization_code', code },
    })
    const tokenData = tokenRes.data
    const access_token = tokenData.access_token
    const openId = tokenData.open_id || ''
    const employeeName = tokenData.name || '未知用户'
    const avatarUrl = tokenData.avatar_url || tokenData.avatar_thumb || ''

    console.log('User info:', { openId, employeeName, avatarUrl })

    // 写入 users 表（存在则更新，不存在则创建）
    const existingUsers = await listRecords('users')
    const existing = existingUsers.find(u => u.fields.feishu_open_id === openId)

    // 第一个用户自动成为管理员
    const isFirstUser = existingUsers.length === 0

    const userData = {
      feishu_open_id: openId,
      feishu_user_id: tokenData.user_id || '',
      name: employeeName,
      avatar: avatarUrl,
      role: isFirstUser ? 'admin' : 'member',
    }

    if (existing) {
      await updateRecord('users', existing.record_id, userData)
    } else {
      await createRecord('users', userData)
    }

    // 重定向回前端，带用户信息
    const user = encodeURIComponent(JSON.stringify({
      openId,
      name: employeeName,
      avatar: avatarUrl,
    }))
    res.redirect(`${process.env.WEB_URL}/auth/callback?token=${encodeURIComponent(access_token)}&user=${user}`)
  } catch (e) {
    console.error('SSO callback error:', e.message)
    console.error('SSO callback error stack:', e.stack)
    res.redirect(`${process.env.WEB_URL}/auth/callback?error=${encodeURIComponent(e.message)}`)
  }
})

// 获取当前用户信息（通过 token 校验身份）
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'No token' })

  try {
    const token = authHeader.replace('Bearer ', '')
    const userRes = await client.authen.userInfo.get({
      headers: { Authorization: `Bearer ${token}` },
    })
    const openId = userRes.data?.open_id
    if (!openId) return res.status(401).json({ error: 'Invalid token' })

    const users = await listRecords('users')
    const user = users.find(u => u.fields.feishu_open_id === openId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    res.json({
      data: {
        open_id: user.fields.feishu_open_id,
        name: user.fields.name,
        avatar: user.fields.avatar,
        role: user.fields.role || 'member',
        record_id: user.record_id,
      }
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// 更新用户角色（仅管理员可用）
router.put('/role', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'No token' })

  try {
    const token = authHeader.replace('Bearer ', '')
    const userRes = await client.authen.userInfo.get({
      headers: { Authorization: `Bearer ${token}` },
    })
    const operatorOpenId = userRes.data?.open_id || ''

    // 检查操作者是否为管理员
    const users = await listRecords('users')
    const operator = users.find(u => u.fields.feishu_open_id === operatorOpenId)
    if (!operator || operator.fields.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' })
    }

    const { record_id, role } = req.body
    if (!record_id || !['admin', 'pm', 'member'].includes(role)) {
      return res.status(400).json({ error: '参数错误' })
    }

    await updateRecord('users', record_id, { role })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// 获取所有用户
router.get('/users', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'No token' })

  try {
    const users = await listRecords('users')
    res.json({ data: users })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
