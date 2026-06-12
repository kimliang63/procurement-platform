const { listRecords, getRecord, createRecord, updateRecord, deleteRecord } = require('../feishu/bitable')
const { sanitizeFilterValue } = require('../utils/sanitize')

async function createIssue(params) {
  const fields = {
    project_id: params.project_id || params.projectId,
    stage_key: params.stage_key || params.stageKey,
    description: params.description,
    assignee: params.assignee,
    priority: params.priority || '中',
    status: 'open',
  }
  return await createRecord('issues', fields)
}

async function updateIssue(params) {
  const { issueId, ...rest } = params
  const fields = {}
  if (rest.status) fields.status = rest.status
  if (rest.priority) fields.priority = rest.priority
  if (rest.assignee) fields.assignee = rest.assignee
  if (rest.description) fields.description = rest.description
  return await updateRecord('issues', issueId, fields)
}

async function listIssues(params = {}) {
  const conditions = []
  if (params.projectId) conditions.push(`CurrentValue.[project_id]="${sanitizeFilterValue(params.projectId)}"`)
  if (params.status) conditions.push(`CurrentValue.[status]="${sanitizeFilterValue(params.status)}"`)
  if (params.priority) conditions.push(`CurrentValue.[priority]="${sanitizeFilterValue(params.priority)}"`)
  if (params.owner) conditions.push(`CurrentValue.[assignee]="${sanitizeFilterValue(params.owner)}"`)

  const filterExpr = conditions.length > 1
    ? `AND(${conditions.join(',')})`
    : conditions[0] || ''

  return await listRecords('issues', filterExpr ? { filter: filterExpr } : {})
}

async function getIssue(params) {
  const { issueId } = params
  return await getRecord('issues', issueId)
}

async function deleteIssue(params) {
  const { issueId } = params
  return await deleteRecord('issues', issueId)
}

module.exports = { createIssue, updateIssue, listIssues, getIssue, deleteIssue }
