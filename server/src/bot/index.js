const { understandIntent, getSession } = require('./llm')
const { callTool, STAGE_MAP, STAGE_KEYS } = require('../mcp')
const { getGroupBinding, bindGroup, unbindGroup, isProjectOwner } = require('./group')
const { generateGroupWeeklyReport, generateAdminWeeklyReport } = require('./weekly')
const { listRecords } = require('../feishu/bitable')

const STATUS_MAP = { completed: '已完成', in_progress: '进行中', pending: '待开始', blocked: '异常' }
const { buildProjectConfirmCard, buildProjectCreatedCard, buildCardProcessed } = require('./cards')
const client = require('../feishu/client')

// 根据 open_id 从 users 表查找用户姓名
async function resolveUserName(openId) {
  if (!openId) return null
  try {
    const users = await listRecords('users')
    const user = users.find(u => u.fields?.feishu_open_id === openId)
    return user?.fields?.name || null
  } catch {
    return null
  }
}

// LLM 可能返回 camelCase 或 snake_case，统一映射
const INTENT_MAP = {
  createProject: 'create_project', updateProject: 'update_project',
  deleteProject: 'delete_project', getProject: 'get_project',
  listProjects: 'list_projects', listProjectNodes: 'list_project_nodes',
  advanceNode: 'advance_node', updateNode: 'update_node',
  markNodeAbnormal: 'mark_node_abnormal',
  createIssue: 'create_issue', updateIssue: 'update_issue',
  deleteIssue: 'delete_issue', listIssues: 'list_issues',
}

// 预算单位归一化：800000 → 80，"80万" → 80
function normalizeBudget(val) {
  if (!val) return val
  if (typeof val === 'string') {
    const num = parseFloat(val.replace(/万/g, ''))
    if (!isNaN(num)) return num
  }
  if (typeof val === 'number' && val > 1000) return val / 10000
  return val
}

// 校验日期顺序
function validateDates(params) {
  if (params.planStart && params.planEnd) {
    if (new Date(params.planStart) > new Date(params.planEnd)) {
      return '计划结束日期不能早于开始日期'
    }
  }
  return null
}

async function handleMessage(event) {
  const userMessage = event.message?.content
  if (!userMessage) return null

  let text
  try {
    text = typeof userMessage === 'string' ? JSON.parse(userMessage).text : userMessage.text
  } catch {
    console.log('Failed to parse message content:', userMessage)
    return null
  }
  if (!text) return null

  // 私聊中消息可能带 @_user_N 前缀，去掉
  text = text.replace(/@_user_\d+\s*/g, '').trim()
  if (!text) return null

  const senderId = event.sender?.sender_id?.open_id || 'unknown'
  const chatId = event.message?.chat_id
  console.log('Bot received:', text, 'from:', senderId)

  // 解析发送者真实姓名
  const senderName = await resolveUserName(senderId)

  // Check for group binding command — 支持多种写法
  if (text.includes('绑定')) {
    if (!chatId) {
      return { text: '绑定功能仅支持群聊使用' }
    }
    // 提取项目名称：支持 "绑定 XX项目" / "绑定XX" / "绑定 项目名称"
    const match = text.match(/绑定[项目]*\s*(.+)/)
    const projectName = match?.[1]?.trim()
    if (projectName) {
      const result = await bindGroup(chatId, projectName, senderId)
      return { text: result.message || `已绑定项目：${result.project.fields?.name}` }
    }
    // 没有项目名 → 追问
    return { text: '请告诉我要绑定的项目名称，例如：绑定 XX设备采购项目' }
  }

  // 解绑群聊
  if (text.includes('解绑')) {
    if (!chatId) {
      return { text: '解绑功能仅支持群聊使用' }
    }
    const result = await unbindGroup(chatId)
    return { text: result.message || `已解绑项目：${result.projectName}` }
  }

  // Weekly report command
  if (text.includes('周报') || text.includes('weekly')) {
    if (text.includes('管理') || text.includes('admin')) {
      const card = await generateAdminWeeklyReport()
      return { card }
    }
    if (chatId) {
      const card = await generateGroupWeeklyReport(chatId)
      return card ? { card } : { text: '未绑定项目，无法生成周报' }
    }
    return { text: '请在群聊中使用周报功能，或使用"管理周报"查看全局周报' }
  }

  // 使用 LLM 理解意图（内部维护会话上下文）
  const result = await understandIntent(text, senderId, senderName)
  console.log('LLM result:', JSON.stringify(result, null, 2))

  // 兼容 intent 命名
  if (result.intent && INTENT_MAP[result.intent]) {
    result.intent = INTENT_MAP[result.intent]
  }

  // LLM 回复（追问、确认、回答问题等）
  if (result.message && !result.intent) {
    return { text: result.message }
  }

  // 创建项目 - 检查必填字段
  if (result.intent === 'create_project') {
    const params = result.params || {}

    // 预算归一化
    params.budget = normalizeBudget(params.budget)

    const missing = []
    if (!params.name) missing.push('项目名称')
    if (!params.category) missing.push('采购品类')
    if (!params.department) missing.push('所属部门')
    if (!params.budget) missing.push('预算')
    if (!params.planStart) missing.push('计划开始日期')
    if (!params.planEnd) missing.push('计划结束日期')

    // 负责人始终使用当前发送者的真实姓名
    if (senderName) params.owner = senderName

    // 信息不完整，返回追问消息
    if (missing.length > 0) {
      // 有项目名称时提前校验重名
      if (params.name) {
        try {
          const projects = await callTool('list_projects')
          const duplicate = projects.find(p => p.fields?.name === params.name)
          if (duplicate) {
            return { text: `项目名称"${params.name}"已存在（编号：${duplicate.fields?.no}），请换个名称` }
          }
        } catch {}
      }
      return { text: result.message || `还缺少以下信息：\n${missing.map(m => `- ${m}`).join('\n')}\n请补充告诉我` }
    }

    // 日期校验
    const dateError = validateDates(params)
    if (dateError) {
      return { text: dateError }
    }

    // 信息完整 → 始终弹确认卡片，由卡片按钮执行创建
    return { card: buildProjectConfirmCard(params) }
  }

  // 用户取消（严格匹配）
  const cancelWords = ['取消', '不要', '算了', '不做了']
  const singleCharCancel = ['否']
  const isCancel = cancelWords.includes(text.trim()) || (singleCharCancel.includes(text.trim()) && text.trim().length <= 2)
  if (isCancel) {
    return { text: result.message || '已取消操作' }
  }

  // 执行其他操作
  if (result.intent && result.intent !== 'create_project') {
    // 需要 projectId 的操作
    const needsProjectId = ['get_project', 'update_project', 'advance_node', 'update_node', 'mark_node_abnormal', 'list_project_nodes', 'create_issue', 'update_issue', 'list_issues'].includes(result.intent)

    if (needsProjectId && !result.params?.projectId) {
      // 优先从 session 获取
      const session = getSession(senderId)
      if (session?.currentProjectId) {
        result.params = { ...result.params, projectId: session.currentProjectId }
      } else if (result.params?.name) {
        // 按名称查找项目
        try {
          const projects = await callTool('list_projects')
          const match = projects.find(p => p.fields?.name === result.params.name || p.fields?.name?.includes(result.params.name))
          if (match) {
            result.params = { ...result.params, projectId: match.record_id }
            if (session) session.currentProjectId = match.record_id
          }
        } catch {}
      }
      // 仍然没有 projectId，提示用户
      if (!result.params?.projectId) {
        return { text: `未找到项目"${result.params?.name || ''}"，请确认项目名称是否正确` }
      }
    }

    try {
      const data = await callTool(result.intent, result.params)

      if (result.intent === 'advance_node') {
        const nodeLabel = STAGE_MAP[result.params.stageKey]?.label || result.params.stageKey
        const statusLabel = STATUS_MAP[result.params.status] || '已完成'
        // 找下一阶段
        const stageKeys = Object.keys(STAGE_MAP)
        const idx = stageKeys.indexOf(result.params.stageKey)
        const nextStage = idx >= 0 && idx < stageKeys.length - 1 ? STAGE_MAP[stageKeys[idx + 1]]?.label : null
        let msg = `✅ ${nodeLabel} 已标记为${statusLabel}`
        if (nextStage) msg += `\n下一步：${nextStage}`
        return { text: msg }
      }

      if (result.intent === 'list_projects') {
        if (!data || data.length === 0) return { text: '没有找到匹配的项目。' }
        const list = data.map(p => {
          const stageLabel = STAGE_MAP[p.fields?.current_stage]?.label || p.fields?.current_stage || '—'
          const statusTag = p.fields?.status === '异常' ? ' ⚠️' : ''
          return `· ${p.fields?.name}（${stageLabel}）${statusTag}`
        }).join('\n')
        return { text: `共 ${data.length} 个项目：\n${list}` }
      }

      if (result.intent === 'get_project') {
        const f = data.fields
        const stageLabel = STAGE_MAP[f?.current_stage]?.label || f?.current_stage || '—'
        const statusTag = f?.status === '异常' ? ' ⚠️异常' : ''
        return { text: `📋 ${f?.name}（${f?.no}）${statusTag}\n负责人：${f?.owner} | 部门：${f?.department} | 品类：${f?.category}\n预算：${f?.budget}万 | 周期：${f?.plan_start} ~ ${f?.plan_end}\n当前阶段：${stageLabel}` }
      }

      if (result.intent === 'list_project_nodes') {
        if (!data || data.length === 0) return { text: '没有找到项目节点。' }
        const statusIcons = { completed: '✅', in_progress: '🔄', pending: '⏳', blocked: '❌' }
        // 找到当前进行中的节点
        const current = data.find(n => n.fields?.status === 'in_progress')
        const list = data.map(n => {
          const label = STAGE_MAP[n.fields?.stage_key]?.label || n.fields?.stage_key
          const icon = statusIcons[n.fields?.status] || '⏳'
          const extra = n.fields?.actual_date ? ` (${n.fields.actual_date})` : ''
          return `${icon} ${label}${extra}`
        }).join('\n')
        const currentLabel = current ? STAGE_MAP[current.fields?.stage_key]?.label : null
        let summary = list
        if (currentLabel) summary += `\n\n当前进行中：${currentLabel}`
        return { text: summary }
      }

      if (result.intent === 'update_node') {
        const nodeLabel = STAGE_MAP[result.params.stageKey]?.label || result.params.stageKey
        return { text: `已更新 ${nodeLabel} 的信息` }
      }

      if (result.intent === 'mark_node_abnormal') {
        const nodeLabel = STAGE_MAP[result.params.stageKey]?.label || result.params.stageKey
        return { text: `⚠️ ${nodeLabel} 已标记为异常\n原因：${result.params.reason || '未说明'}\n请尽快跟进处理` }
      }

      return { text: result.message || `操作完成：${result.intent}` }
    } catch (e) {
      if (e.code === 'NEED_PLAN_DATE') {
        const nodeLabel = STAGE_MAP[result.params?.stageKey]?.label || result.params?.stageKey || '该节点'
        return { text: `⚠️ ${nodeLabel}还没有计划完成日期，无法标记完成\n请先在 Web 端设置计划日期，或告诉我计划完成时间` }
      }
      return { text: `操作失败：${e.message}` }
    }
  }

  // 有消息但没有意图（纯对话）
  if (result.message) {
    return { text: result.message }
  }

  return { text: '抱歉，我没有理解你的意思。请告诉我你想做什么，比如：\n- "创建一个新项目"\n- "查看XX设备采购的进度"\n- "把定标标记为完成"' }
}

// 防重复操作：记录正在处理的 action
const processingActions = new Set()

function actionKey(action) {
  if (action.action === 'confirm_project') return `confirm:${action.params?.name}`
  if (action.action === 'cancel_project') return `cancel:${action.params?.name}`
  if (action.action === 'confirm_node') return `node:${action.project_id}:${action.stage_key}`
  if (action.action === 'mark_abnormal') return `abnormal:${action.project_id}:${action.stage_key}`
  return `${action.action}:${JSON.stringify(action)}`
}

// 发送无按钮的"已处理"卡片替换原卡片
async function sendProcessedCard(chatId, headerTitle, color, params, statusText) {
  if (!chatId) return
  const fields = [
    { is_short: true, text: { tag: 'lark_md', content: `**项目名称**\n${params.name || '—'}` } },
    { is_short: true, text: { tag: 'lark_md', content: `**采购品类**\n${params.category || '—'}` } },
    { is_short: true, text: { tag: 'lark_md', content: `**负责人**\n${params.owner || '—'}` } },
    { is_short: true, text: { tag: 'lark_md', content: `**所属部门**\n${params.department || '—'}` } },
    { is_short: true, text: { tag: 'lark_md', content: `**预算**\n${params.budget || '—'}万` } },
    { is_short: true, text: { tag: 'lark_md', content: `**计划周期**\n${params.planStart || '—'} ~ ${params.planEnd || '—'}` } },
  ]
  const card = buildCardProcessed(headerTitle, color, fields, statusText)
  await client.im.message.create({
    params: { receive_id_type: 'chat_id' },
    data: { receive_id: chatId, msg_type: 'interactive', content: JSON.stringify(card) },
  })
}

async function handleCardAction(action, chatId, senderId) {
  const key = actionKey(action)

  // 防重复点击
  if (processingActions.has(key)) {
    console.log('Duplicate action ignored:', key)
    return { toast: { content: '正在处理中，请勿重复点击', type: 'info' } }
  }
  processingActions.add(key)

  try {
    // Permission check for node operations
    if (action.action === 'confirm_node' || action.action === 'mark_abnormal') {
      if (senderId && action.project_id) {
        const isOwner = await isProjectOwner(action.project_id, senderId)
        if (!isOwner) {
          return { toast: { content: '仅负责人可操作', type: 'warning' } }
        }
      }
    }

    if (action.action === 'confirm_project') {
      const params = action.params
      // 重名检查
      try {
        const projects = await callTool('list_projects')
        const duplicate = projects.find(p => p.fields?.name === params.name)
        if (duplicate) {
          if (chatId) {
            await client.im.message.create({
              params: { receive_id_type: 'chat_id' },
              data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: `项目名称"${params.name}"已存在（编号：${duplicate.fields?.no}），请换个名称` }) },
            })
          }
          return { success: false, error: 'duplicate_name' }
        }
      } catch {}
      // 立即发送"处理中"卡片（无按钮），替换原卡片
      await sendProcessedCard(chatId, '正在创建项目...', 'blue', params, '⏳ 正在创建项目，请稍候...')
      try {
        const data = await callTool('create_project', params)
        if (!data || !data.record_id) {
          throw new Error('项目创建失败：未返回有效数据')
        }
        // 群聊中创建 → 自动绑定
        if (chatId && data.record_id) {
          try { await bindGroup(chatId, data.fields?.name, senderId) } catch {}
        }
        // 发送成功卡片
        if (chatId) {
          const card = buildProjectCreatedCard(data, params)
          await client.im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: chatId, msg_type: 'interactive', content: JSON.stringify(card) },
          })
        }
        return { success: true }
      } catch (e) {
        console.error('Create project error:', e.message)
        if (chatId) {
          await client.im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: `创建失败：${e.message}` }) },
          })
        }
        return { success: false, error: e.message }
      }
    }

    if (action.action === 'cancel_project') {
      if (chatId) {
        await client.im.message.create({
          params: { receive_id_type: 'chat_id' },
          data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: '已取消创建' }) },
        })
      }
      return { success: true }
    }

    if (action.action === 'confirm_node') {
      try {
        await callTool('advance_node', { projectId: action.project_id, stageKey: action.stage_key, status: 'completed' })
        const nodeLabel = STAGE_MAP[action.stage_key]?.label || action.stage_key
        if (chatId) {
          await client.im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: `✅ ${nodeLabel} 已标记为完成` }) },
          })
        }
        return { success: true }
      } catch (e) {
        return { success: false, error: e.message }
      }
    }

    if (action.action === 'mark_abnormal') {
      try {
        await callTool('mark_node_abnormal', { projectId: action.project_id, stageKey: action.stage_key, reason: '用户标记异常' })
        const nodeLabel = STAGE_MAP[action.stage_key]?.label || action.stage_key
        if (chatId) {
          await client.im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: `⚠️ ${nodeLabel} 已标记为异常` }) },
          })
        }
        return { success: true }
      } catch (e) {
        return { success: false, error: e.message }
      }
    }
  } finally {
    processingActions.delete(key)
  }
}

function clearProcessingActions() {
  processingActions.clear()
}

module.exports = { handleMessage, handleCardAction, normalizeBudget, validateDates, clearProcessingActions }
