const { listRecords, getRecord, createRecord, updateRecord, deleteRecord } = require('../feishu/bitable')

async function createProject(params) {
  const fields = {
    name: params.name,
    no: params.no || `CG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    category: params.category,
    owner: params.owner,
    budget: params.budget || 0,
    plan_start: params.planStart || '',
    plan_end: params.planEnd || '',
    current_stage: 'requirement',
    status: '正常',
    remark: params.remark || '',
    risk: '',
    suppliers: '[]',
  }
  return await createRecord('projects', fields)
}

async function updateProject(projectId, params) {
  const fields = {}
  if (params.name) fields.name = params.name
  if (params.owner) fields.owner = params.owner
  if (params.budget !== undefined) fields.budget = params.budget
  if (params.planStart) fields.plan_start = params.planStart
  if (params.planEnd) fields.plan_end = params.planEnd
  if (params.remark !== undefined) fields.remark = params.remark
  if (params.status) fields.status = params.status
  if (params.risk !== undefined) fields.risk = params.risk
  return await updateRecord('projects', projectId, fields)
}

async function deleteProject(projectId) {
  return await deleteRecord('projects', projectId)
}

async function getProject(projectId) {
  return await getRecord('projects', projectId)
}

async function listProjects(filter = {}) {
  return await listRecords('projects', filter)
}

module.exports = { createProject, updateProject, deleteProject, getProject, listProjects }
