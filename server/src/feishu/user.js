// 直接调飞书 API 获取用户信息
// SDK 的 authen.userInfo.get 在 v1.66.0 有兼容问题，改用 HTTP 直调
async function getFeishuUserInfo(accessToken) {
  const resp = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await resp.json()
  if (data.code !== 0) throw new Error(data.msg || 'Failed to get user info')
  return data.data
}

module.exports = { getFeishuUserInfo }
