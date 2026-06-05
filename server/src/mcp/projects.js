const { listRecords, getRecord, createRecord, updateRecord, deleteRecord } = require('../feishu/bitable')

async function createProject(params) {
  const existing = await listRecords('projects')
  if (existing.some(p => p.fields?.name === params.name)) {
    throw new Error('项目名称已存在')
  }

  // Auto-generate project number by company
  const company = params.company || 'ZT'
  const prefix = company === 'GOFO' ? 'GFCG' : 'CG'
  const year = new Date().getFullYear()
  const yearProjects = existing.filter(p => p.fields?.no?.startsWith(`${prefix}-${year}`))
  const seq = String(yearProjects.length + 1).padStart(3, '0')
  const projectNo = `${prefix}-${year}-${seq}`

  const fields = {
    name: params.name,
    no: projectNo,
    company: company,
    bu: params.bu || '',
    application_no: params.applicationNo || '',
    owner: params.owner,
    budget: Number(params.budget) || 0,
    task_type: params.taskType || '',
    current_stage: 'requirement',
    status: '进行中',
    remark: params.remark || '',
  }

  const result = await createRecord('projects', fields)

  // Post-creation duplicate check to handle race conditions
  const allProjects = await listRecords('projects')
  const duplicates = allProjects.filter(p => p.fields?.no === projectNo)
  if (duplicates.length > 1) {
    const newest = duplicates.sort((a, b) => (b.created_time || 0) - (a.created_time || 0))[0]
    const newSeq = String(allProjects.filter(p => p.fields?.no?.startsWith(`${prefix}-${year}`)).length).padStart(3, '0')
    const newNo = `${prefix}-${year}-${newSeq}`
    await updateRecord('projects', newest.record_id, { no: newNo })
    result.fields.no = newNo
  }

  return result
}

async function updateProject(params) {
  const { projectId, ...rest } = params
  const fields = {}
  if (rest.name) fields.name = rest.name
  if (rest.bu !== undefined) fields.bu = rest.bu
  if (rest.applicationNo !== undefined) fields.application_no = rest.applicationNo
  if (rest.owner) fields.owner = rest.owner
  if (rest.budget !== undefined) fields.budget = Number(rest.budget)
  if (rest.taskType !== undefined) fields.task_type = rest.taskType
  if (rest.status) fields.status = rest.status
  if (rest.remark !== undefined) fields.remark = rest.remark
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
