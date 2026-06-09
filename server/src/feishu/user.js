// 直接调飞书 API 获取用户信息
// SDK 的 authen.userInfo.get 在 v1.66.0 有兼容问题，改用 HTTP 直调

const userTokenCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 min

async function getFeishuUserInfo(accessToken) {
  const cached = userTokenCache.get(accessToken)
  if (cached && Date.now() < cached.expireAt) return cached.data

  const resp = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await resp.json()
  if (data.code !== 0) throw new Error(data.msg || 'Failed to get user info')

  userTokenCache.set(accessToken, { data: data.data, expireAt: Date.now() + CACHE_TTL })
  return data.data
}

module.exports = { getFeishuUserInfo }
