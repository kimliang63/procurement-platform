const { understandIntent } = require('./llm')
const { callTool, STAGE_MAP, STAGE_KEYS } = require('../mcp')
const { buildStatusChangeCard, buildConfirmCard } = require('./cards')

async function handleMessage(event) {
  const userMessage = event.message?.content
  if (!userMessage) return null

  const text = typeof userMessage === 'string' ? JSON.parse(userMessage).text : userMessage.text
  if (!text) return null

  const result = await understandIntent(text)

  if (!result.intent) {
    return { text: result.message || '抱歉，我没有理解你的意思。请告诉我你想做什么，比如：\n- "创建一个新项目"\n- "查看XX设备采购的进度"\n- "把定标标记为完成"' }
  }

  if (result.confirm_required) {
    return { text: result.message }
  }

  try {
    const data = await callTool(result.intent, result.params)

    if (result.intent === 'create_project') {
      return {
        text: `项目创建成功！\n名称：${data.fields?.name}\n编号：${data.fields?.no}\n当前阶段：需求确认`,
      }
    }

    if (result.intent === 'advance_node') {
      const nodeLabel = STAGE_MAP[result.params.stageKey]?.label || result.params.stageKey
      return {
        text: `节点已更新！\n${nodeLabel} → ${result.params.status || 'completed'}`,
      }
    }

    if (result.intent === 'list_projects') {
      if (!data || data.length === 0) {
        return { text: '没有找到匹配的项目。' }
      }
      const list = data.map(p => `· ${p.fields?.name}（${p.fields?.current_stage || '—'}）`).join('\n')
      return { text: `找到 ${data.length} 个项目：\n${list}` }
    }

    if (result.intent === 'get_project') {
      const f = data.fields
      return { text: `项目详情：\n名称：${f?.name}\n编号：${f?.no}\n负责人：${f?.owner}\n当前阶段：${f?.current_stage}\n预算：${f?.budget}万` }
    }

    return { text: `操作完成：${result.intent}` }
  } catch (e) {
    return { text: `操作失败：${e.message}` }
  }
}

async function handleCardAction(action) {
  if (action.action === 'confirm_node') {
    return await callTool('advance_node', { projectId: action.project_id, stageKey: action.stage_key, status: 'completed' })
  }
  if (action.action === 'mark_abnormal') {
    return await callTool('mark_node_abnormal', { projectId: action.project_id, stageKey: action.stage_key, reason: '用户标记异常' })
  }
}

module.exports = { handleMessage, handleCardAction }
