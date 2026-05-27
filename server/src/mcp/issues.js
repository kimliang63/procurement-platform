const { listRecords, getRecord, createRecord, updateRecord } = require('../feishu/bitable')

async function createIssue(params) {
  const fields = {
    project_id: params.projectId,
    stage_key: params.stageKey,
    description: params.description,
    assignee: params.assignee,
    priority: params.priority || 'medium',
    status: 'open',
  }
  return await createRecord('issues', fields)
}

async function updateIssue(issueId, params) {
  const fields = {}
  if (params.status) fields.status = params.status
  if (params.priority) fields.priority = params.priority
  if (params.assignee) fields.assignee = params.assignee
  if (params.description) fields.description = params.description
  return await updateRecord('issues', issueId, fields)
}

async function listIssues(filter = {}) {
  let issues = await listRecords('issues')
  if (filter.projectId) issues = issues.filter(i => i.fields.project_id === filter.projectId)
  if (filter.status) issues = issues.filter(i => i.fields.status === filter.status)
  if (filter.priority) issues = issues.filter(i => i.fields.priority === filter.priority)
  return issues
}

async function getIssue(issueId) {
  return await getRecord('issues', issueId)
}

module.exports = { createIssue, updateIssue, listIssues, getIssue }
