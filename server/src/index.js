if (!process.env.VERCEL) require('dotenv').config()
const express = require('express')
const cors = require('cors')
const os = require('os')
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

// HRAS 指标采集
let _requestCount = 0
let _errorCount = 0
let _totalResponseMs = 0
const _startedAt = Date.now()

app.use((req, res, next) => {
  _requestCount++
  const start = Date.now()
  res.on('finish', () => {
    const elapsed = Date.now() - start
    _totalResponseMs += elapsed
    if (res.statusCode >= 400) _errorCount++
  })
  next()
})

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

// HRAS 健康检查端点（壳子每 30 秒轮询）
app.get('/health', (req, res) => {
  res.json({ status: 'UP' })
})

// HRAS 监控指标端点（壳子每 30 秒拉取）
app.get('/metrics', (req, res) => {
  const avgMs = _requestCount > 0 ? Math.round(_totalResponseMs / _requestCount * 100) / 100 : 0
  const errorRate = _requestCount > 0 ? Math.round(_errorCount / _requestCount * 1000) / 1000 : 0

  const memUsage = process.memoryUsage()
  const memoryMb = Math.round(memUsage.rss / (1024 * 1024) * 10) / 10

  // CPU 使用率（简化计算）
  const cpus = os.cpus()
  const cpuPercent = Math.round((process.cpuUsage().user / 1000000) * 100) / 100

  res.json({
    status: 'UP',
    timestamp: Math.floor(Date.now() / 1000),
    base: {
      request_count: _requestCount,
      error_rate: errorRate,
      avg_response_ms: avgMs,
      cpu_percent: cpuPercent,
      memory_mb: memoryMb,
    },
    custom: {
      uptime_seconds: Math.floor((Date.now() - _startedAt) / 1000),
    },
  })
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

// Bot Webhook - 消息去重（最多保留 10000 条）
const processedEvents = new Set()
const MAX_EVENTS = 10000


app.post('/webhook/bot', async (req, res) => {
  const { type, challenge, event, header } = req.body
  console.log(`[${new Date().toISOString()}] /webhook/bot:`, header?.event_type || type || 'unknown')

  // 飞书事件订阅验证
  if (type === 'url_verification') {
    return res.json({ challenge })
  }

  // 验证事件 token（防止伪造 webhook）
  const verifyToken = process.env.FEISHU_VERIFY_TOKEN
  if (verifyToken && header?.token && header.token !== verifyToken) {
    console.warn('[Webhook] Token verification failed')
    return res.status(403).json({ error: 'Invalid token' })
  }

  // 消息去重
  const eventId = header?.event_id
  if (eventId && processedEvents.has(eventId)) {
    return res.json({ success: true })
  }
  if (eventId) {
    // 防止内存泄漏：超过上限时清理最早的条目
    if (processedEvents.size >= MAX_EVENTS) {
      const first = processedEvents.values().next().value
      processedEvents.delete(first)
    }
    processedEvents.add(eventId)
    // 5分钟后清理
    setTimeout(() => processedEvents.delete(eventId), 300000)
  }

  // 未知事件类型
  if (header?.event_type && header.event_type !== 'card.action.trigger') {
    console.log(`[${new Date().toISOString()}] Unknown event type:`, header.event_type)
  }

  // 处理卡片回调
  if (header?.event_type === 'card.action.trigger') {
    const action = event?.action
    const chatId = event?.context?.open_chat_id
    const operatorId = event?.operator?.open_id
    console.log(`[${new Date().toISOString()}] Card action received:`, JSON.stringify(action), 'chat:', chatId, 'operator:', operatorId)

    if (action?.value) {
      // fire-and-forget: 不等待业务逻辑，立即返回空对象避免 200341 超时
      handleCardAction(action.value, chatId, operatorId).catch(e => {
        console.error('Card action async error:', e.message)
      })
    }
    return res.json({})
  }

  // 处理消息
  if (event?.message?.message_type === 'text') {
    const chatId = event.message?.chat_id
    const messageId = event.message?.message_id
    console.log(`[${new Date().toISOString()}] Message received:`, event.message?.content?.substring(0, 100), 'chat:', chatId)
    const chatType = event.message?.chat_type // "group" or "p2p"
    const senderId = event.sender?.sender_id?.open_id
    const mentions = event.message?.mentions || []
    // 有 mention 就认为被@了（群聊中用户@机器人时 mentions 不为空）
    const isMentioned = mentions.length > 0

    console.log('Webhook event message:', JSON.stringify(event.message))

    // 群聊中：仅 @机器人 时处理消息
    if (chatType === 'group' && !isMentioned) {
      return res.json({ success: true })
    }

    // 立即加表情回应，表示收到消息
    if (messageId) {
      client.im.messageReaction.create({
        path: { message_id: messageId },
        data: { reaction_type: { emoji_type: 'OnIt' } },
      }).then(r => console.log('Reaction added:', r.code === 0 ? 'OK' : r.msg))
        .catch(e => console.error('Reaction failed:', e.response?.data?.msg || e.message))
    }

    // fire-and-forget: 不阻塞 webhook 响应，8秒超时兜底
    const msgTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    Promise.race([handleMessage(event), msgTimeout]).then(reply => {
      if (reply && chatId) {
        const msgType = reply.card ? 'interactive' : 'text'
        const content = reply.card ? JSON.stringify(reply.card) : JSON.stringify({ text: reply.text })
        client.im.message.create({
          params: { receive_id_type: 'chat_id' },
          data: { receive_id: chatId, msg_type: msgType, content },
        }).catch(e => console.error('Failed to send reply:', e.message))
      }
    }).catch(e => {
      console.error('Message handling error:', e.message)
      if (chatId && e.message === 'timeout') {
        client.im.message.create({
          params: { receive_id_type: 'chat_id' },
          data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: '处理超时，请稍后重试' }) },
        }).catch(() => {})
      }
    })
  }

  res.json({ success: true })
})

// Card Action Webhook - 与 /webhook/bot 合并，避免双重处理
app.post('/webhook/card', async (req, res) => {
  const { type, challenge, header, event } = req.body

  // URL验证
  if (type === 'url_verification') {
    return res.json({ challenge })
  }

  // 验证事件 token
  const verifyToken = process.env.FEISHU_VERIFY_TOKEN
  if (verifyToken && header?.token && header.token !== verifyToken) {
    console.warn('[Webhook/card] Token verification failed')
    return res.status(403).json({ error: 'Invalid token' })
  }

  // 事件去重（复用 /webhook/bot 的 processedEvents）
  const eventId = header?.event_id
  if (eventId && processedEvents.has(eventId)) {
    return res.json({ success: true })
  }
  if (eventId) {
    processedEvents.add(eventId)
    setTimeout(() => processedEvents.delete(eventId), 300000)
  }

  // 卡片回传交互事件
  if (header?.event_type === 'card.action.trigger') {
    const action = event?.action
    const chatId = event?.context?.open_chat_id
    const operatorId = event?.operator?.open_id
    console.log(`[${new Date().toISOString()}] /webhook/card action:`, JSON.stringify(action), 'chat:', chatId)

    if (action?.value) {
      handleCardAction(action.value, chatId, operatorId).catch(e => {
        console.error('Card action async error:', e.message)
      })
    }
  }

  return res.json({})
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
    // 启动后自动注册到 HRAS 壳子
    registerToShell()
  })
}

// HRAS 模块自动注册
async function registerToShell() {
  const enabled = process.env.HRAS_SHELL_REGISTER_ENABLED !== 'false'
  if (!enabled) {
    console.log('[HRAS] 注册已跳过（HRAS_SHELL_REGISTER_ENABLED=false）')
    return
  }

  const shellUrl = process.env.HRAS_SHELL_URL || 'http://localhost:8066'
  const payload = {
    module_key: process.env.HRAS_MODULE_KEY || 'hras-procurement',
    name: process.env.HRAS_MODULE_NAME || '采购项目进度管理',
    frontend_url: process.env.HRAS_MODULE_FRONTEND_URL || 'http://localhost:3000',
    backend_url: process.env.HRAS_MODULE_BACKEND_URL || `http://localhost:${PORT}`,
    health_path: '/health',
    metrics_path: '/metrics',
    menu: {
      icon: 'shopping',
      children: [
        { path: '/', name: '项目列表' },
      ],
    },
  }

  console.log(`[HRAS] 正在向壳子注册: ${shellUrl}/api/modules/register`)
  try {
    const resp = await fetch(`${shellUrl}/api/modules/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await resp.json()
    console.log(`[HRAS] ✅ 注册成功 | module_key=${payload.module_key} | status=${resp.status}`)
  } catch (err) {
    console.log(`[HRAS] ⚠️ 注册失败（壳子可能未启动），模块仍可独立运行。错误：${err.message}`)
  }
}

module.exports = app
