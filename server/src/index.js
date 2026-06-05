if (!process.env.VERCEL) require('dotenv').config()
const express = require('express')
const cors = require('cors')
const projectsRouter = require('./routes/projects')
const nodesRouter = require('./routes/nodes')
const issuesRouter = require('./routes/issues')
const authRouter = require('./routes/auth')
const groupsRouter = require('./routes/groups')
const weeklyRouter = require('./routes/weekly')
const statsRouter = require('./routes/stats')
const { handleMessage, handleCardAction } = require('./bot')
const { callTool } = require('./mcp')
const client = require('./feishu/client')
const { extractUser } = require('./middleware/auth')

const app = express()
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['https://procurement-platform-rosy.vercel.app', 'http://localhost:5173'],
  credentials: true,
}))
app.use(express.json())

const PORT = process.env.PORT || 4000

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})
app.use('/api/auth', authRouter)
// Auth middleware for all API routes (except health and auth)
app.use('/api', extractUser)
app.use('/api/projects', projectsRouter)
app.use('/api/nodes', nodesRouter)
app.use('/api/issues', issuesRouter)
app.use('/api/groups', groupsRouter)
app.use('/api/weekly', weeklyRouter)

// Stats API
app.use('/api/stats', statsRouter)

// Bot Webhook - 消息去重
const processedEvents = new Set()

// 群聊免@会话追踪：chatId:{userId: lastActiveTime}
const chatActiveUsers = new Map()
const CHAT_SESSION_TTL = 5 * 60 * 1000 // 5分钟

function isUserActiveInChat(chatId, userId) {
  const chat = chatActiveUsers.get(chatId)
  if (!chat) return false
  const lastActive = chat.get(userId)
  if (!lastActive) return false
  return Date.now() - lastActive < CHAT_SESSION_TTL
}

function markUserActiveInChat(chatId, userId) {
  if (!chatActiveUsers.has(chatId)) {
    chatActiveUsers.set(chatId, new Map())
  }
  chatActiveUsers.get(chatId).set(userId, Date.now())
}

// 清理过期记录（每10分钟）
setInterval(() => {
  const now = Date.now()
  for (const [chatId, users] of chatActiveUsers) {
    for (const [userId, time] of users) {
      if (now - time > CHAT_SESSION_TTL) users.delete(userId)
    }
    if (users.size === 0) chatActiveUsers.delete(chatId)
  }
}, 600000)

app.post('/webhook/bot', async (req, res) => {
  const { type, challenge, event, header } = req.body

  if (type === 'url_verification') {
    return res.json({ challenge })
  }

  // 消息去重
  const eventId = header?.event_id
  if (eventId && processedEvents.has(eventId)) {
    return res.json({ success: true })
  }
  if (eventId) {
    processedEvents.add(eventId)
    // 5分钟后清理
    setTimeout(() => processedEvents.delete(eventId), 300000)
  }

  // 处理卡片回调
  if (header?.event_type === 'card.action.trigger') {
    const action = event?.action
    const chatId = event?.context?.open_chat_id
    console.log('Card action:', JSON.stringify(action), 'chat:', chatId)

    if (action?.value) {
      const result = await handleCardAction(action.value, chatId)

      if (result?.card && chatId) {
        try {
          await client.im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: {
              receive_id: chatId,
              msg_type: 'interactive',
              content: JSON.stringify(result.card),
            },
          })
          console.log('Card reply sent to chat:', chatId)
        } catch (e) {
          console.error('Failed to send card reply:', e.message)
        }
      }

      // 返回 toast
      if (result?.toast) {
        return res.json({ toast: result.toast })
      }
    }
    return res.json({ success: true })
  }

  // 处理消息
  if (event?.message?.message_type === 'text') {
    const chatId = event.message?.chat_id
    const chatType = event.message?.chat_type // "group" or "p2p"
    const senderId = event.sender?.sender_id?.open_id
    const mentions = event.message?.mentions || []
    // 有 mention 就认为被@了（群聊中用户@机器人时 mentions 不为空）
    const isMentioned = mentions.length > 0

    console.log('Webhook event message:', JSON.stringify(event.message))

    // 群聊中：@机器人 或 5分钟内活跃过的用户 → 处理消息
    if (chatType === 'group' && !isMentioned) {
      if (!isUserActiveInChat(chatId, senderId)) {
        console.log('Group message ignored (no @mention, no active session):', senderId)
        return res.json({ success: true })
      }
    }

    // 标记用户活跃（@机器人 或 在会话中回复都算）
    if (chatType === 'group' && senderId) {
      markUserActiveInChat(chatId, senderId)
    }

    const reply = await handleMessage(event)

    if (reply && chatId) {
      try {
        const msgType = reply.card ? 'interactive' : 'text'
        const content = reply.card ? JSON.stringify(reply.card) : JSON.stringify({ text: reply.text })
        await client.im.message.create({
          params: { receive_id_type: 'chat_id' },
          data: {
            receive_id: chatId,
            msg_type: msgType,
            content,
          },
        })
        console.log('Reply sent to chat:', chatId, msgType)
      } catch (e) {
        console.error('Failed to send reply:', e.message)
      }
    }
  }

  res.json({ success: true })
})

// Card Action Webhook - 处理 card.action.trigger 事件
app.post('/webhook/card', async (req, res) => {
  const { type, challenge, header, event } = req.body

  // URL验证
  if (type === 'url_verification') {
    return res.json({ challenge })
  }

  console.log('Card webhook received:', JSON.stringify({ type, event_type: header?.event_type }))

  // 卡片回传交互事件
  if (header?.event_type === 'card.action.trigger') {
    // 事件去重
    const eventId = header?.event_id
    if (eventId && processedEvents.has(eventId)) {
      return res.json({ success: true })
    }
    if (eventId) {
      processedEvents.add(eventId)
      setTimeout(() => processedEvents.delete(eventId), 300000)
    }

    const action = event?.action
    const chatId = event?.context?.open_chat_id
    console.log('Card action:', JSON.stringify(action), 'chat:', chatId)

    if (action?.value) {
      try {
        const result = await handleCardAction(action.value, chatId)
        if (result?.toast) {
          return res.json({ toast: result.toast })
        }
      } catch (e) {
        console.error('Card action error:', e.message)
      }
    }
    return res.json({ success: true })
  }

  res.json({ success: true })
})

// 静态文件服务（Vercel 生产环境）
if (process.env.VERCEL) {
  const path = require('path')
  const fs = require('fs')
  const distDir = path.join(__dirname, '../../web/dist')

  app.use(express.static(distDir))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

module.exports = app
