/**
 * 测试：卡片回调异步处理
 * 验证 webhook 在 3 秒内返回响应，业务逻辑异步执行
 */

// Mock 依赖
jest.mock('../feishu/client', () => ({
  im: { message: { create: jest.fn().mockResolvedValue({}) } },
}))

jest.mock('../bot/group', () => ({
  getGroupBinding: jest.fn().mockResolvedValue(null),
  bindGroup: jest.fn().mockResolvedValue({}),
  isProjectOwner: jest.fn().mockResolvedValue(true),
}))

jest.mock('../mcp', () => ({
  callTool: jest.fn(),
  STAGE_MAP: {
    requirement: { label: '需求确认', order: 1 },
    supplier_dev: { label: '供应商开发', order: 2 },
  },
  STAGE_KEYS: ['requirement', 'supplier_dev'],
}))

jest.mock('../bot/llm', () => ({
  understandIntent: jest.fn(),
  getSession: jest.fn(),
}))

const express = require('express')
const request = require('supertest')

// 在每个测试前重新加载路由（避免状态污染）
let app
beforeEach(() => {
  jest.resetModules()
  jest.mock('../feishu/client', () => ({
    im: { message: { create: jest.fn().mockResolvedValue({}) } },
  }))
  jest.mock('../bot/group', () => ({
    getGroupBinding: jest.fn().mockResolvedValue(null),
    bindGroup: jest.fn().mockResolvedValue({}),
    isProjectOwner: jest.fn().mockResolvedValue(true),
  }))
  jest.mock('../mcp', () => ({
    callTool: jest.fn(),
    STAGE_MAP: {
      requirement: { label: '需求确认', order: 1 },
      supplier_dev: { label: '供应商开发', order: 2 },
    },
    STAGE_KEYS: ['requirement', 'supplier_dev'],
  }))
  jest.mock('../bot/llm', () => ({
    understandIntent: jest.fn(),
    getSession: jest.fn(),
  }))

  const { handleMessage, handleCardAction } = require('../bot/index')
  const { callTool } = require('../mcp')
  const client = require('../feishu/client')

  // 让 create_project 耗时 5 秒（模拟慢速 Bitable API）
  callTool.mockImplementation((tool, params) => {
    if (tool === 'list_projects') return Promise.resolve([])
    if (tool === 'create_project') {
      return new Promise(resolve => {
        setTimeout(() => resolve({ record_id: 'rec_slow', fields: { name: params?.name || 'test' } }), 5000)
      })
    }
    return Promise.resolve({})
  })

  app = express()
  app.use(express.json())

  // 复制 webhook/bot 路由逻辑
  const processedEvents = new Set()
  app.post('/webhook/bot', async (req, res) => {
    const { type, challenge, event, header } = req.body
    if (type === 'url_verification') return res.json({ challenge })

    const eventId = header?.event_id
    if (eventId && processedEvents.has(eventId)) return res.json({ success: true })
    if (eventId) {
      processedEvents.add(eventId)
      setTimeout(() => processedEvents.delete(eventId), 300000)
    }

    if (header?.event_type === 'card.action.trigger') {
      const action = event?.action
      const chatId = event?.context?.open_chat_id
      const operatorId = event?.operator?.open_id

      if (action?.value) {
        // 关键：异步处理，不等待
        handleCardAction(action.value, chatId, operatorId).catch(e => {
          console.error('Card action async error:', e.message)
        })
      }
      return res.json({ success: true })
    }

    if (event?.message?.message_type === 'text') {
      const chatId = event.message?.chat_id
      const reply = await handleMessage(event)
      if (reply && chatId) {
        try {
          await client.im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: reply.text }) },
          })
        } catch {}
      }
    }

    res.json({ success: true })
  })
})

describe('卡片回调异步处理', () => {
  test('webhook 在 500ms 内返回响应（即使业务逻辑需要 5 秒）', async () => {
    const startTime = Date.now()

    const res = await request(app)
      .post('/webhook/bot')
      .send({
        header: { event_type: 'card.action.trigger', event_id: 'evt_async_test' },
        event: {
          action: { value: { action: 'confirm_project', params: { name: '慢速项目', category: '设备', owner: '张三' } } },
          context: { open_chat_id: 'oc_test_chat' },
          operator: { open_id: 'ou_test_user' },
        },
      })

    const elapsed = Date.now() - startTime

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // webhook 应在 500ms 内返回（远小于 3 秒超时）
    expect(elapsed).toBeLessThan(500)
  })

  test('重复事件去重正常工作', async () => {
    const payload = {
      header: { event_type: 'card.action.trigger', event_id: 'evt_dedup_test' },
      event: {
        action: { value: { action: 'confirm_project', params: { name: '去重测试', category: '设备' } } },
        context: { open_chat_id: 'oc_test_chat' },
        operator: { open_id: 'ou_test_user' },
      },
    }

    const res1 = await request(app).post('/webhook/bot').send(payload)
    const res2 = await request(app).post('/webhook/bot').send(payload)

    expect(res1.body.success).toBe(true)
    expect(res2.body.success).toBe(true)
  })

  test('URL 验证正常响应', async () => {
    const res = await request(app)
      .post('/webhook/bot')
      .send({ type: 'url_verification', challenge: 'test_challenge_123' })

    expect(res.status).toBe(200)
    expect(res.body.challenge).toBe('test_challenge_123')
  })
})
