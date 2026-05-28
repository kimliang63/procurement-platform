const express = require('express')
const router = express.Router()
const client = require('../feishu/client')

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
    // 用 code 换取 user_access_token
    const tokenRes = await client.authen.accessToken.create({
      data: { grant_type: 'authorization_code', code },
    })
    const { access_token } = tokenRes.data

    // 获取用户信息
    const userRes = await client.authen.userInfo.get({
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const userInfo = userRes.data

    // 重定向回前端，带用户信息
    const user = encodeURIComponent(JSON.stringify({
      openId: userInfo.open_id,
      name: userInfo.name,
      avatar: userInfo.avatar,
    }))
    res.redirect(`${process.env.WEB_URL}/auth/callback?token=${access_token}&user=${user}`)
  } catch (e) {
    console.error('SSO callback error:', e.message)
    res.redirect(`${process.env.WEB_URL}/auth/callback?error=${encodeURIComponent(e.message)}`)
  }
})

// 获取当前用户信息
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'No token' })

  try {
    const token = authHeader.replace('Bearer ', '')
    const userRes = await client.authen.userInfo.get({
      headers: { Authorization: `Bearer ${token}` },
    })
    res.json({ data: userRes.data })
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' })
  }
})

module.exports = router
