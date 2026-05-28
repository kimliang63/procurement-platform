const lark = require('@larksuiteoapi/node-sdk')

const client = new lark.Client({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
  domain: lark.Domain.Feishu,
})

module.exports = client
