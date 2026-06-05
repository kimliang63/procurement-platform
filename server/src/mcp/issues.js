const { listRecords, getRecord, createRecord, updateRecord, deleteRecord } = require('../feishu/bitable')

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
  let issues = await listRecords('issues')
  if (params.projectId) issues = issues.filter(i => i.fields.project_id === params.projectId)
  if (params.status) issues = issues.filter(i => i.fields.status === params.status)
  if (params.priority) issues = issues.filter(i => i.fields.priority === params.priority)
  if (params.owner) issues = issues.filter(i => i.fields.assignee === params.owner)
  return issues
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
