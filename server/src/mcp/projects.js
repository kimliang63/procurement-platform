const { listRecords, getRecord, createRecord, updateRecord, deleteRecord } = require('../feishu/bitable')

async function createProject(params) {
  // 校验项目名称唯一性
  const existing = await listRecords('projects')
  if (existing.some(p => p.fields?.name === params.name)) {
    throw new Error('项目名称已存在')
  }

  const fields = {
    name: params.name,
    no: params.no || `CG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    category: params.category,
    owner: params.owner,
    department: params.department || '',
    budget: Number(params.budget) || 0,
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

async function updateProject(params) {
  const { projectId, ...rest } = params
  const fields = {}
  if (rest.name) fields.name = rest.name
  if (rest.owner) fields.owner = rest.owner
  if (rest.department) fields.department = rest.department
  if (rest.budget !== undefined) fields.budget = Number(rest.budget)
  if (rest.planStart) fields.plan_start = rest.planStart
  if (rest.planEnd) fields.plan_end = rest.planEnd
  if (rest.remark !== undefined) fields.remark = rest.remark
  if (rest.status) fields.status = rest.status
  if (rest.risk !== undefined) fields.risk = rest.risk
  return await updateRecord('projects', projectId, fields)
}

async function deleteProject(params) {
  const { projectId } = params
  return await deleteRecord('projects', projectId)
}

async function getProject(params) {
  const { projectId } = params
  return await getRecord('projects', projectId)
}

async function listProjects(params = {}) {
  return await listRecords('projects', params)
}

module.exports = { createProject, updateProject, deleteProject, getProject, listProjects }
