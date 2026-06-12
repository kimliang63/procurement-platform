const { listRecords, getRecord, createRecord, updateRecord, deleteRecord } = require('../feishu/bitable')

async function createProject(params) {
  const existing = await listRecords('projects') || []
  if (existing.some(p => p.fields?.name === params.name)) {
    throw new Error('项目名称已存在')
  }

  const company = params.company || 'ZT'
  const prefix = company === 'GOFO' ? 'GFCG' : 'CG'
  const year = new Date().getFullYear()
  const yearProjects = existing.filter(p => p.fields?.no?.startsWith(`${prefix}-${year}`))
  const seq = String(yearProjects.length + 1).padStart(3, '0')
  const projectNo = `${prefix}-${year}-${seq}`

  const fields = {
    name: params.name,
    no: projectNo,
    owner: params.owner,
    budget: Number(params.budget) || 0,
    category: params.category || '',
    department: params.department || '',
    task_type: params.taskType || '',
    is_single_source: params.isSingleSource || '',
    procurement_method: params.procurementMethod || '',
    plan_start: params.planStart || '',
    plan_end: params.planEnd || '',
    current_stage: 'requirement',
    status: '进行中',
    remark: params.remark || '',
  }

  return await createRecord('projects', fields)
}

async function updateProject(params) {
  let { projectId, ...rest } = params

  // 兜底：如果没有 projectId，按名称查找
  if (!projectId && rest.projectName) {
    const all = await listRecords('projects')
    const match = all.find(p => p.fields?.name === rest.projectName || p.fields?.name?.includes(rest.projectName))
    if (match) projectId = match.record_id
  }

  if (!projectId) throw new Error('缺少 projectId')

  const fields = {}
  if (rest.name) fields.name = rest.name
  if (rest.owner) fields.owner = rest.owner
  if (rest.budget !== undefined) fields.budget = Number(rest.budget)
  if (rest.category !== undefined) fields.category = rest.category
  if (rest.department !== undefined) fields.department = rest.department
  if (rest.taskType !== undefined) fields.task_type = rest.taskType
  if (rest.isSingleSource !== undefined) fields.is_single_source = rest.isSingleSource
  if (rest.procurementMethod !== undefined) fields.procurement_method = rest.procurementMethod
  if (rest.status) fields.status = rest.status
  if (rest.remark !== undefined) fields.remark = rest.remark
  if (rest.planStart !== undefined) fields.plan_start = rest.planStart
  if (rest.planEnd !== undefined) fields.plan_end = rest.planEnd
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
  const conditions = []
  if (params.owner) conditions.push(`CurrentValue.[owner]="${params.owner}"`)
  if (params.status) conditions.push(`CurrentValue.[status]="${params.status}"`)

  const filterExpr = conditions.length > 1
    ? `AND(${conditions.join(',')})`
    : conditions[0] || ''

  return await listRecords('projects', filterExpr ? { filter: filterExpr } : {})
}

module.exports = { createProject, updateProject, deleteProject, getProject, listProjects }
