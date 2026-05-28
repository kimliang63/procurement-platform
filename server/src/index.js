require('dotenv').config()
const express = require('express')
const cors = require('cors')
const projectsRouter = require('./routes/projects')
const nodesRouter = require('./routes/nodes')
const issuesRouter = require('./routes/issues')
const authRouter = require('./routes/auth')
const { handleMessage, handleCardAction } = require('./bot')
const { callTool } = require('./mcp')

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 4000

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})
app.use('/api/projects', projectsRouter)
app.use('/api/nodes', nodesRouter)
app.use('/api/issues', issuesRouter)
app.use('/api/auth', authRouter)

// Stats API
app.get('/api/stats', async (req, res) => {
  try {
    const projects = await callTool('list_projects')
    const issues = await callTool('list_issues')

    const stats = {
      doing: projects.filter(p => p.fields?.status === '正常').length,
      done: projects.filter(p => p.fields?.status === '已完成').length,
      problem: projects.filter(p => p.fields?.status === '异常').length,
      total: projects.length,
      issues_open: issues.filter(i => i.fields?.status === 'open').length,
      issues_in_progress: issues.filter(i => i.fields?.status === 'in_progress').length,
      issues_closed: issues.filter(i => i.fields?.status === 'closed').length,
    }
    res.json({ data: stats })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Bot Webhook
app.post('/webhook/bot', async (req, res) => {
  const { type, challenge, event } = req.body

  if (type === 'url_verification') {
    return res.json({ challenge })
  }

  if (event?.message?.message_type === 'text') {
    const reply = await handleMessage(event)
    if (reply) {
      console.log('Bot reply:', reply)
    }
  }

  res.json({ success: true })
})

// Card Action Webhook
app.post('/webhook/card', async (req, res) => {
  const { action } = req.body
  if (action?.value) {
    await handleCardAction(action.value)
  }
  res.json({ success: true })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
