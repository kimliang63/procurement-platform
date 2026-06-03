const { listRecords, getRecord, createRecord, updateRecord, TABLE_IDS } = require('../feishu/bitable')
const client = require('../feishu/client')

const STAGE_MAP = {
  requirement: { label: '需求确认', order: 1 },
  supplier_dev: { label: '供应商开发', order: 2 },
  tech_exchange: { label: '技术交流', order: 3 },
  bid_approval: { label: '招标审批', order: 4 },
  bid_issue: { label: '发标', order: 5 },
  bid_qa: { label: '招标答疑', order: 6 },
  bid_return: { label: '供应商回标', order: 7 },
  bid_open: { label: '开标', order: 8 },
  bid_determine: { label: '定标', order: 9 },
  bid_notify: { label: '中标通知', order: 10 },
  contract: { label: '合同签订', order: 11 },
  production: { label: '生产', order: 12 },
  shipping: { label: '海运', order: 13 },
}

const STAGE_KEYS = Object.keys(STAGE_MAP)

function computeNodeStatus(node) {
  const f = node.fields || {}
  if (f.abnormal_reason) return 'blocked'

  const today = new Date().toISOString().split('T')[0]
  const planStart = f.plan_start || ''
  const planEnd = f.plan_end || f.plan_date || ''
  const actualDate = f.actual_date || ''

  if (actualDate) return 'completed'
  if (!planStart && !planEnd) {
    const stageInfo = STAGE_MAP[f.stage_key]
    return stageInfo?.order === 1 ? 'in_progress' : 'pending'
  }
  if (planStart && today < planStart) return 'pending'
  if (planStart && planEnd && today >= planStart && today <= planEnd) return 'in_progress'
  if (planEnd && today > planEnd) return 'overdue'
  return 'pending'
}

async function initProjectNodes(params) {
  const { projectId } = params
  const records = Object.entries(STAGE_MAP).map(([key, info]) => ({
    fields: {
      project_id: projectId,
      stage_key: key,
      status: info.order === 1 ? 'in_progress' : 'pending',
      plan_start: '',
      plan_end: '',
      plan_date: '',
      actual_date: '',
      note: '',
    }
  }))

  const res = await client.bitable.appTableRecord.batchCreate({
    path: { app_token: process.env.FEISHU_BITABLE_APP_TOKEN, table_id: TABLE_IDS.nodes },
    data: { records },
  })
  return res.data?.records || []
}

async function advanceNode(params) {
  const { projectId, stageKey, actualDate } = params
  if (!projectId) throw new Error('缺少 projectId 参数')
  if (!stageKey) throw new Error('缺少 stageKey 参数')

  const nodes = await listRecords('nodes', {
    filter: `AND(CurrentValue.[project_id]="${projectId}", CurrentValue.[stage_key]="${stageKey}")`
  })
  const node = nodes[0]
  if (!node) throw new Error(`未找到节点: projectId=${projectId}, stageKey=${stageKey}`)
  if (!node.record_id) throw new Error('节点数据异常: 缺少 record_id')

  const finalActualDate = actualDate || new Date().toISOString().split('T')[0]
  return await updateRecord('nodes', node.record_id, {
    actual_date: finalActualDate,
  })
}

async function updateNode(params) {
  const { projectId, stageKey, ...rest } = params
  if (!projectId) throw new Error('缺少 projectId 参数')
  if (!stageKey) throw new Error('缺少 stageKey 参数')

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
  if (rest.plan_date !== undefined) fields.plan_date = rest.plan_date
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
    filter: `CurrentValue.[project_id]="${projectId}"`
  })
  return nodes
    .sort((a, b) => (STAGE_MAP[a.fields.stage_key]?.order || 0) - (STAGE_MAP[b.fields.stage_key]?.order || 0))
    .map(n => ({ ...n, fields: { ...n.fields, status: computeNodeStatus(n) } }))
}

module.exports = { initProjectNodes, advanceNode, updateNode, markNodeAbnormal, listProjectNodes, computeNodeStatus, STAGE_MAP, STAGE_KEYS }
