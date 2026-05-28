const { listRecords, getRecord, createRecord, updateRecord } = require('../feishu/bitable')

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

async function initProjectNodes(projectId) {
  const results = []
  for (const [key, info] of Object.entries(STAGE_MAP)) {
    const record = await createRecord('nodes', {
      project_id: projectId,
      stage_key: key,
      stage_label: info.label,
      order: info.order,
      status: info.order === 1 ? 'in_progress' : 'pending',
      plan_date: '',
      actual_date: '',
      note: '',
      abnormal_reason: '',
    })
    results.push(record)
  }
  return results
}

async function advanceNode(params) {
  const { projectId, stageKey, status = 'completed' } = params
  const nodes = await listRecords('nodes')
  const node = nodes.find(n => n.fields.project_id === projectId && n.fields.stage_key === stageKey)
  if (!node) throw new Error('Node not found')

  const fields = { status }
  if (status === 'completed') {
    fields.actual_date = new Date().toISOString().split('T')[0]
  }
  return await updateRecord('nodes', node.record_id, fields)
}

async function updateNode(params) {
  const { projectId, stageKey, ...rest } = params
  const nodes = await listRecords('nodes')
  const node = nodes.find(n => n.fields.project_id === projectId && n.fields.stage_key === stageKey)
  if (!node) throw new Error('Node not found')

  const fields = {}
  if (rest.assignee) fields.assignee = rest.assignee
  if (rest.planDate) fields.plan_date = rest.planDate
  if (rest.note) fields.note = rest.note
  return await updateRecord('nodes', node.record_id, fields)
}

async function markNodeAbnormal(params) {
  const { projectId, stageKey, reason } = params
  const nodes = await listRecords('nodes')
  const node = nodes.find(n => n.fields.project_id === projectId && n.fields.stage_key === stageKey)
  if (!node) throw new Error('Node not found')

  return await updateRecord('nodes', node.record_id, {
    status: 'blocked',
    abnormal_reason: reason,
  })
}

async function listProjectNodes(projectId) {
  const nodes = await listRecords('nodes')
  return nodes
    .filter(n => n.fields.project_id === projectId)
    .sort((a, b) => (a.fields.order || 0) - (b.fields.order || 0))
}

module.exports = { initProjectNodes, advanceNode, updateNode, markNodeAbnormal, listProjectNodes, STAGE_MAP, STAGE_KEYS }
