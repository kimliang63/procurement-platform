const { understandIntent, getSession } = require('./llm')
const { callTool, STAGE_MAP, STAGE_KEYS } = require('../mcp')
const { getGroupBinding, bindGroup, unbindGroup, isProjectOwner } = require('./group')
const { generateGroupWeeklyReport, generateAdminWeeklyReport, generateMyWeeklyReport } = require('./weekly')
const { listRecords } = require('../feishu/bitable')

const STATUS_MAP = { completed: '已完成', in_progress: '进行中', pending: '待开始', blocked: '异常' }
const { buildProjectConfirmCard, buildProjectCreatedCard, buildCardProcessed, buildNodeUpdateConfirmCard } = require('./cards')
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

// 预算单位归一化："80万" → 80，raw number 假设已是万元单位
function normalizeBudget(val) {
  if (!val) return val
  if (typeof val === 'string') {
    const num = parseFloat(val.replace(/万/g, ''))
    if (!isNaN(num)) return num
  }
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

  // Check for group binding command — 必须以"绑定"开头，避免"之前绑定的项目"等误触发
  if (/^绑定/.test(text)) {
    if (!chatId) {
      return { text: '绑定功能仅支持群聊使用' }
    }
    const match = text.match(/绑定[项目]*\s*(.+)/)
    const projectName = match?.[1]?.trim()
    if (projectName) {
      const result = await bindGroup(chatId, projectName, senderId)
      return { text: result.message || `已绑定项目：${result.project.fields?.name}` }
    }
    return { text: '请告诉我要绑定的项目名称，例如：绑定 XX设备采购项目' }
  }

  // 解绑群聊 — 仅精确匹配"解绑"
  if (/^解绑$/.test(text.trim())) {
    if (!chatId) {
      return { text: '解绑功能仅支持群聊使用' }
    }
    const result = await unbindGroup(chatId)
    return { text: result.message || `已解绑项目：${result.projectName}` }
  }

  // Weekly report command — 发周报/出周报/周报/管理周报/admin周报/weekly
  if (/^(发|出|看|生成)?周报|管理周报|admin周报|^weekly$/i.test(text.trim())) {
    if (text.includes('管理') || text.includes('admin')) {
      const card = await generateAdminWeeklyReport()
      return { card }
    }
    if (chatId) {
      const card = await generateGroupWeeklyReport(chatId)
      return card ? { card } : { text: '未绑定项目，无法生成周报' }
    }
    if (senderName) {
      const card = await generateMyWeeklyReport(senderName)
      return card ? { card } : { text: '你没有负责的项目' }
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
    if (params.budget === undefined || params.budget === null || params.budget === '') missing.push('预算')
    if (!params.isSingleSource) missing.push('是否单一来源')
    if (!params.procurementMethod) missing.push('采购方式（框架类/项目类）')
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
        } catch (e) { console.error('Duplicate check error:', e.message) }
      }
      return { text: result.message || `还缺少以下信息：\n${missing.map(m => `- ${m}`).join('\n')}\n请补充告诉我` }
    }

    // 日期校验
    const dateError = validateDates(params)
    if (dateError) {
      return { text: dateError }
    }

    // 信息完整 → 先检查重名，再校验负责人，再弹确认卡片
    if (params.name) {
      try {
        const projects = await callTool('list_projects')
        const duplicate = projects.find(p => p.fields?.name === params.name)
        if (duplicate) {
          return { text: `项目名称"${params.name}"已存在（编号：${duplicate.fields?.no}），请换个名称` }
        }
      } catch (e) { console.error('Duplicate check error:', e.message) }
    }

    // 校验负责人是否已注册
    if (senderName) {
      try {
        const users = await listRecords('users') || []
        if (!users.some(u => u.fields?.name === senderName)) {
          return { text: `你的账号（${senderName}）未在系统中注册，请先联系管理员添加` }
        }
      } catch (e) { console.error('Owner validation error:', e.message) }
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
      } else if (chatId) {
        // 群聊：使用绑定的项目（私聊无绑定，getGroupBinding 返回 null）
        try {
          const binding = await getGroupBinding(chatId)
          if (binding?.fields?.project_id) {
            result.params = { ...result.params, projectId: binding.fields.project_id }
            if (session) session.currentProjectId = binding.fields.project_id
          }
        } catch (e) { console.error('Group binding lookup error:', e.message) }
      }
      if (!result.params?.projectId && result.params?.name) {
        // 按名称查找项目
        try {
          const projects = await callTool('list_projects')
          const exactMatches = projects.filter(p => p.fields?.name === result.params.name)
          if (exactMatches.length === 1) {
            result.params = { ...result.params, projectId: exactMatches[0].record_id }
            if (session) session.currentProjectId = exactMatches[0].record_id
          } else if (exactMatches.length === 0) {
            const partialMatches = projects.filter(p => p.fields?.name?.includes(result.params.name))
            if (partialMatches.length === 1) {
              result.params = { ...result.params, projectId: partialMatches[0].record_id }
              if (session) session.currentProjectId = partialMatches[0].record_id
            } else if (partialMatches.length > 1) {
              const list = partialMatches.map((p, i) => `${i + 1}. ${p.fields.name}`).join('\n')
              return { text: `找到多个匹配项目，请告诉我要操作哪一个：\n${list}` }
            }
          } else {
            const list = exactMatches.map((p, i) => `${i + 1}. ${p.fields.name}`).join('\n')
            return { text: `找到多个同名项目，请告诉我要操作哪一个：\n${list}` }
          }
        } catch (e) { console.error('Project lookup error:', e.message) }
      }
      // 仍然没有 projectId，提示用户
      if (!result.params?.projectId) {
        return { text: `未找到项目"${result.params?.name || ''}"，请确认项目名称是否正确` }
      }
    }

    // 拦截 update_node（在 callTool 之前，统一处理单节点和批量）
    if (result.intent === 'update_node') {
      console.log('[update_node] params:', JSON.stringify(result.params))

      // Normalize: 单节点格式 → 批量格式
      let updates = result.params.updates
      if (!updates && result.params.stageKey) {
        const { stageKey, plan_start, plan_end, actual_date, note } = result.params
        updates = [{ stageKey, plan_start, plan_end, actual_date, note }]
      }

      if (!updates || updates.length === 0) {
        if (result.message) return { text: result.message }
        return { text: '未识别到要更新的节点信息，请重试' }
      }

      for (const u of updates) {
        if (!u.stageKey) return { text: '更新信息不完整，缺少阶段标识' }
      }

      if (updates.length > 10) {
        return { text: '单次最多更新10个节点，请分批操作' }
      }

      // 单节点：直接执行
      if (updates.length === 1) {
        try {
          await callTool('update_node', {
            projectId: result.params.projectId,
            stageKey: updates[0].stageKey,
            ...(updates[0].plan_start !== undefined && { plan_start: updates[0].plan_start }),
            ...(updates[0].plan_end !== undefined && { plan_end: updates[0].plan_end }),
            ...(updates[0].actual_date !== undefined && { actual_date: updates[0].actual_date }),
            ...(updates[0].note !== undefined && { note: updates[0].note }),
          })
          const nodeLabel = STAGE_MAP[updates[0].stageKey]?.label || updates[0].stageKey
          const changes = []
          if (updates[0].plan_start) changes.push(`计划开始：${updates[0].plan_start}`)
          if (updates[0].plan_end) changes.push(`计划结束：${updates[0].plan_end}`)
          if (updates[0].actual_date) changes.push(`实际完成：${updates[0].actual_date}`)
          if (updates[0].note) changes.push(`备注：${updates[0].note}`)
          const detail = changes.length > 0 ? '\n' + changes.join('\n') : ''
          return { text: `✅ ${nodeLabel} 已更新${detail}` }
        } catch (e) {
          return { text: `操作失败：${e.message}` }
        }
      }

      // 多节点批量：弹确认卡片
      let currentNodes = []
      try {
        currentNodes = await callTool('list_project_nodes', { projectId: result.params.projectId })
      } catch (e) {
        console.error('Failed to fetch current nodes:', e.message)
      }

      const currentMap = {}
      for (const node of currentNodes) {
        const f = node.fields || {}
        currentMap[f.stage_key] = {
          plan_start: f.plan_start || '',
          plan_end: f.plan_end || '',
          actual_date: f.actual_date || '',
          note: f.note || '',
        }
      }

      return {
        card: buildNodeUpdateConfirmCard({
          projectId: result.params.projectId,
          projectName: result.params.name || '',
          updates,
          currentMap,
        })
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

      if (result.intent === 'mark_node_abnormal') {
        const nodeLabel = STAGE_MAP[result.params.stageKey]?.label || result.params.stageKey
        return { text: `⚠️ ${nodeLabel} 已标记为异常\n原因：${result.params.reason || '未说明'}\n请尽快跟进处理` }
      }

      if (result.intent === 'list_issues') {
        if (!data || data.length === 0) return { text: '没有找到相关问题。' }
        const list = data.map(i => {
          const priority = i.fields?.priority === '高' ? '🔴' : i.fields?.priority === '中' ? '🟡' : '🟢'
          const stage = STAGE_MAP[i.fields?.stage_key]?.label || i.fields?.stage_key || '—'
          const status = i.fields?.status === 'closed' ? '已关闭' : i.fields?.status === 'in_progress' ? '处理中' : '待处理'
          return `${priority} ${i.fields?.description || '无描述'}（${stage} · ${status}）`
        }).join('\n')
        return { text: `共 ${data.length} 个问题：\n${list}` }
      }

      if (result.intent === 'create_issue') return { text: result.message || '问题已创建' }
      if (result.intent === 'update_issue') return { text: result.message || '问题已更新' }
      if (result.intent === 'delete_issue') return { text: result.message || '问题已删除' }

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

// 已创建项目缓存（防止重复点击确认按钮导致重复创建）
const createdProjects = new Set()

function actionKey(action) {
  if (action.action === 'confirm_project') return `confirm:${action.params?.name}`
  if (action.action === 'cancel_project') return `cancel:${action.params?.name}`
  if (action.action === 'confirm_node') return `node:${action.project_id}:${action.stage_key}`
  if (action.action === 'mark_abnormal') return `abnormal:${action.project_id}:${action.stage_key}`
  if (action.action === 'confirm_node_update') return `node_update:${action.project_id}:${Date.now()}`
  if (action.action === 'cancel_node_update') return `cancel_update:${action.project_id}`
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

  // confirm_project：不通过 callback response 返回卡片（避免 200341），异步发消息
  if (action.action === 'confirm_project') {
    const params = action.params
    // 已创建过的项目 → 直接返回成功（防止重复点击）
    if (params.name && createdProjects.has(params.name)) {
      processingActions.delete(key)
      return { toast: { content: '项目已创建成功', type: 'success' } }
    }
    // 重名检查（同步，快速返回）
    try {
      const projects = await callTool('list_projects')
      const duplicate = projects.find(p => p.fields?.name === params.name)
      if (duplicate) {
        processingActions.delete(key)
        if (chatId) {
          client.im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: `项目名称"${params.name}"已存在（编号：${duplicate.fields?.no}），请换个名称` }) },
          }).catch(() => {})
        }
        return { success: false, error: 'duplicate_name' }
      }
    } catch (e) { console.error('Card action duplicate check error:', e.message) }
    // 后台异步创建项目，不阻塞 callback 响应
    ;(async () => {
      try {
        const data = await callTool('create_project', params)
        if (!data || !data.record_id) {
          throw new Error('项目创建失败：未返回有效数据')
        }
        // 初始化节点
        if (data.record_id) {
          try {
            await callTool('init_project_nodes', {
              projectId: data.record_id,
              isSingleSource: params.isSingleSource,
              budget: params.budget,
              procurementMethod: params.procurementMethod,
            })
          } catch (e) {
            console.error('Init project nodes error:', e.message)
          }
        }
        if (chatId && data.record_id) {
          try { await bindGroup(chatId, data.fields?.name, senderId) } catch (e) { console.error('Auto-bind group error:', e.message) }
        }
        if (chatId) {
          try {
            const card = buildProjectCreatedCard(data, params)
            await client.im.message.create({
              params: { receive_id_type: 'chat_id' },
              data: { receive_id: chatId, msg_type: 'interactive', content: JSON.stringify(card) },
            })
          } catch (e) {
            console.error('Failed to send success card:', e.message)
          }
        }
        // 记录已创建，防止重复点击
        if (params.name) createdProjects.add(params.name)
      } catch (e) {
        console.error('Create project error:', e.message)
        if (chatId) {
          try {
            await client.im.message.create({
              params: { receive_id_type: 'chat_id' },
              data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: `创建失败：${e.message}` }) },
            })
          } catch (msgErr) {
            console.error('Failed to send error message:', msgErr.message)
          }
        }
      } finally {
        processingActions.delete(key)
      }
    })()
    return { success: true }
  }

  try {
    // Permission check for node operations
    if (action.action === 'confirm_node' || action.action === 'mark_abnormal' || action.action === 'confirm_node_update') {
      if (senderId && action.project_id) {
        const isOwner = await isProjectOwner(action.project_id, senderId)
        if (!isOwner) {
          return { toast: { content: '仅负责人可操作', type: 'warning' } }
        }
      }
    }

    if (action.action === 'cancel_project') {
      if (chatId) {
        try {
          await client.im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: '已取消创建' }) },
          })
        } catch (e) {
          console.error('Failed to send cancel message:', e.message)
        }
      }
      return { success: true }
    }

    if (action.action === 'cancel_node_update') {
      if (chatId) {
        try {
          await client.im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: '已取消节点更新' }) },
          })
        } catch (e) {
          console.error('Failed to send cancel message:', e.message)
        }
      }
      return { success: true }
    }

    if (action.action === 'confirm_node_update') {
      const { project_id, updates } = action
      if (!project_id || !updates || !Array.isArray(updates)) {
        return { success: false, error: 'invalid_params' }
      }

      ;(async () => {
        const results = []
        const errors = []
        for (const update of updates) {
          try {
            await callTool('update_node', {
              projectId: project_id,
              stageKey: update.stageKey,
              ...(update.plan_start !== undefined && { plan_start: update.plan_start }),
              ...(update.plan_end !== undefined && { plan_end: update.plan_end }),
              ...(update.actual_date !== undefined && { actual_date: update.actual_date }),
              ...(update.note !== undefined && { note: update.note }),
            })
            results.push(update.stageKey)
          } catch (e) {
            console.error(`Failed to update node ${update.stageKey}:`, e.message)
            errors.push({ stageKey: update.stageKey, error: e.message })
          }
        }

        if (chatId) {
          try {
            const successLabels = results.map(k => STAGE_MAP[k]?.label || k)
            let msg = `✅ 已更新 ${results.length} 个节点：${successLabels.join('、')}`
            if (errors.length > 0) {
              const errLabels = errors.map(e => `${STAGE_MAP[e.stageKey]?.label || e.stageKey}（${e.error}）`)
              msg += `\n❌ 失败 ${errors.length} 个：${errLabels.join('、')}`
            }
            await client.im.message.create({
              params: { receive_id_type: 'chat_id' },
              data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: msg }) },
            })
          } catch (e) {
            console.error('Failed to send batch update result:', e.message)
          }
        }
      })()

      return { success: true }
    }

    if (action.action === 'confirm_node') {
      try {
        await callTool('advance_node', { projectId: action.project_id, stageKey: action.stage_key, status: 'completed' })
        const nodeLabel = STAGE_MAP[action.stage_key]?.label || action.stage_key
        if (chatId) {
          try {
            await client.im.message.create({
              params: { receive_id_type: 'chat_id' },
              data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: `✅ ${nodeLabel} 已标记为完成` }) },
            })
          } catch (e) {
            console.error('Failed to send node complete message:', e.message)
          }
        }
        return { success: true }
      } catch (e) {
        return { success: false, error: e.message }
      }
    }

    if (action.action === 'mark_abnormal') {
      try {
        const reason = action.reason || '用户标记异常'
        await callTool('mark_node_abnormal', { projectId: action.project_id, stageKey: action.stage_key, reason })
        const nodeLabel = STAGE_MAP[action.stage_key]?.label || action.stage_key
        if (chatId) {
          try {
            await client.im.message.create({
              params: { receive_id_type: 'chat_id' },
              data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: `⚠️ ${nodeLabel} 已标记为异常\n原因：${reason}` }) },
            })
          } catch (e) {
            console.error('Failed to send abnormal message:', e.message)
          }
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
