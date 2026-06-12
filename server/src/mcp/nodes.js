const { listRecords, getRecord, createRecord, updateRecord, TABLE_IDS } = require('../feishu/bitable')
const client = require('../feishu/client')
const { getVisibleNodes, getNodeRule, getNodeValidation } = require('./rules')
const { sanitizeFilterValue } = require('../utils/sanitize')

const STAGE_MAP = {
  requirement: { label: '需求确认', order: 1 },
  supplier_dev: { label: '供应商开发', order: 2 },
  tech_exchange: { label: '技术交流', order: 3 },
  sampling: { label: '打样', order: 4 },
  bid_approval: { label: '招标方案审批', order: 5 },
  bid_issue: { label: '发标', order: 6 },
  bid_qa: { label: '答疑', order: 7 },
  bid_return: { label: '供应商回标', order: 8 },
  bid_open: { label: '开标', order: 9 },
  bid_determine: { label: '定标', order: 10 },
  bid_notify: { label: '中标/未中标通知', order: 11 },
  contract_approval: { label: '合同审批', order: 12 },
  production: { label: '生产', order: 13 },
  shipping: { label: '运输', order: 14 },
  acceptance: { label: '验收', order: 15 },
}

const STAGE_KEYS = Object.keys(STAGE_MAP)

function computeNodeStatus(node) {
  const f = node.fields || {}
  // Red: blocked
  if (f.abnormal_reason) return 'blocked'

  const today = new Date().toISOString().split('T')[0]
  const planStart = f.plan_start || ''
  const planEnd = f.plan_end || ''
  const actualDate = f.actual_date || ''

  // Green: completed
  if (actualDate) return 'completed'

  // No dates → check if it's the first stage (should be in_progress)
  if (!planStart && !planEnd) {
    const stageInfo = STAGE_MAP[f.stage_key]
    return stageInfo?.order === 1 ? 'in_progress' : 'pending'
  }

  // Blue: in_progress (current node)
  if (planStart && today >= planStart && (!planEnd || today <= planEnd)) return 'in_progress'

  // Before start → pending (gray)
  if (planStart && today < planStart) return 'pending'

  // After end, no actual date → overdue (red)
  if (planEnd && today > planEnd) return 'overdue'

  return 'pending'
}

async function checkAndAutoComplete(projectId, projectData, nodesData) {
  // Use provided data or fetch fresh
  const nodes = nodesData || await listProjectNodes({ projectId })
  if (nodes.length === 0) return
  const allCompleted = nodes.every(n => n.fields?.actual_date)
  if (allCompleted) {
    const project = projectData || await require('./projects').getProject({ projectId })
    if (project?.fields?.status !== '项目完成') {
      await require('./projects').updateProject({ projectId, status: '项目完成' })
    }
  }
}

async function initProjectNodes(params) {
  const { projectId, isSingleSource, budget, procurementMethod } = params
  const visibleKeys = (isSingleSource && procurementMethod)
    ? getVisibleNodes(isSingleSource, budget, procurementMethod)
    : STAGE_KEYS
  const visibleSet = new Set(visibleKeys)
  const records = Object.entries(STAGE_MAP)
    .filter(([key]) => visibleSet.has(key))
    .map(([key, info], idx) => ({
    fields: {
      project_id: projectId,
      stage_key: key,
      stage_label: info.label,
      order: info.order,
      status: info.order === 1 ? 'in_progress' : 'pending',
      plan_start: '',
      plan_end: '',
      actual_date: '',
      note: '',
    }
  }))

  const res = await client.bitable.appTableRecord.batchCreate({
    path: { app_token: process.env.FEISHU_BITABLE_APP_TOKEN, table_id: TABLE_IDS.nodes },
    data: { records },
  })
  if (res.code !== 0) {
    throw new Error(`节点初始化失败: ${res.msg}`)
  }
  const { invalidateCache } = require('../feishu/bitable')
  invalidateCache('nodes')
  return res.data?.records || []
}

async function advanceNode(params) {
  const { projectId, stageKey, actualDate } = params
  if (!projectId) throw new Error('缺少 projectId 参数')
  if (!stageKey) throw new Error('缺少 stageKey 参数')

  // Fetch project and node in parallel
  const [project, nodes] = await Promise.all([
    require('./projects').getProject({ projectId }),
    listRecords('nodes', {
      filter: `AND(CurrentValue.[project_id]="${sanitizeFilterValue(projectId)}", CurrentValue.[stage_key]="${sanitizeFilterValue(stageKey)}")`
    }),
  ])

  const isSingleSource = project?.fields?.is_single_source
  const budget = project?.fields?.budget
  const procurementMethod = project?.fields?.procurement_method
  if (isSingleSource && procurementMethod) {
    const rule = getNodeRule(isSingleSource, budget, procurementMethod, stageKey)
    if (rule === 'hidden') {
      throw new Error(`节点"${STAGE_MAP[stageKey]?.label || stageKey}"不适用于当前项目配置，无法推进`)
    }
  }

  const node = nodes[0]
  if (!node) throw new Error(`未找到节点: projectId=${projectId}, stageKey=${stageKey}`)
  if (!node.record_id) throw new Error('节点数据异常: 缺少 record_id')

  const finalActualDate = actualDate || new Date().toISOString().split('T')[0]
  const result = await updateRecord('nodes', node.record_id, {
    actual_date: finalActualDate,
  })

  // Auto-complete check (non-blocking, reuse fetched project data)
  try {
    await checkAndAutoComplete(projectId, project)
  } catch (e) {
    console.error('Auto-complete check failed:', e.message)
  }

  return result
}

async function updateNode(params) {
  const { projectId, stageKey, ...rest } = params
  if (!projectId) throw new Error('缺少 projectId 参数')
  if (!stageKey) throw new Error('缺少 stageKey 参数')

  // Business rule: validate actual_date on required nodes
  if (rest.actual_date) {
    const project = await require('./projects').getProject({ projectId })
    const isSingleSource = project?.fields?.is_single_source
    const budget = project?.fields?.budget
    const procurementMethod = project?.fields?.procurement_method
    if (isSingleSource && procurementMethod) {
      const validation = getNodeValidation(isSingleSource, budget, procurementMethod, stageKey, { actual_date: rest.actual_date })
      if (!validation.valid) throw new Error(validation.message)
    }
  }

  const nodes = await listRecords('nodes', {
    filter: `AND(CurrentValue.[project_id]="${projectId}", CurrentValue.[stage_key]="${stageKey}")`
  })
  const node = nodes[0]
  if (!node) throw new Error(`未找到节点: projectId=${projectId}, stageKey=${stageKey}`)
  if (!node.record_id) throw new Error('节点数据异常: 缺少 record_id')

  const fields = {}
  if (rest.assignee) fields.assignee = rest.assignee
  if (rest.plan_start !== undefined) fields.plan_start = rest.plan_start
  if (rest.plan_end !== undefined) fields.plan_end = rest.plan_end
  if (rest.actual_date !== undefined) fields.actual_date = rest.actual_date
  if (rest.note !== undefined) fields.note = rest.note
  if (rest.abnormal_reason !== undefined) fields.abnormal_reason = rest.abnormal_reason
  return await updateRecord('nodes', node.record_id, fields)
}

async function markNodeAbnormal(params) {
  const { projectId, stageKey, reason } = params
  if (!projectId) throw new Error('缺少 projectId 参数')
  if (!stageKey) throw new Error('缺少 stageKey 参数')

  const nodes = await listRecords('nodes', {
    filter: `AND(CurrentValue.[project_id]="${projectId}", CurrentValue.[stage_key]="${stageKey}")`
  })
  const node = nodes[0]
  if (!node) throw new Error(`未找到节点: projectId=${projectId}, stageKey=${stageKey}`)
  if (!node.record_id) throw new Error('节点数据异常: 缺少 record_id')

  return await updateRecord('nodes', node.record_id, {
    status: 'blocked',
    abnormal_reason: reason,
  })
}

async function listProjectNodes(params) {
  const { projectId } = params
  const nodes = await listRecords('nodes', {
    filter: `CurrentValue.[project_id]="${sanitizeFilterValue(projectId)}"`
  }) || []
  return nodes
    .sort((a, b) => (STAGE_MAP[a.fields?.stage_key]?.order || 0) - (STAGE_MAP[b.fields?.stage_key]?.order || 0))
    .map(n => ({ ...n, fields: { ...n.fields, status: computeNodeStatus(n) } }))
}

module.exports = { initProjectNodes, advanceNode, updateNode, markNodeAbnormal, listProjectNodes, computeNodeStatus, checkAndAutoComplete, STAGE_MAP, STAGE_KEYS }
