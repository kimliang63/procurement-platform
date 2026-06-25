const { callTool } = require('../mcp')
const { listRecords } = require('../db')

// Get group binding by chat ID
async function getGroupBinding(chatId) {
  const groups = await callTool('list_groups')
  return groups.find(g => g.fields?.chat_id === chatId)
}

// Bind group to project
async function bindGroup(chatId, projectName, senderId) {
  // Find project by exact name match first, fallback to includes
  const projects = await callTool('list_projects')
  const project = projects.find(p => p.fields?.name === projectName)
    || projects.find(p => p.fields?.name?.includes(projectName))
  if (!project) {
    return { success: false, message: `未找到项目"${projectName}"` }
  }

  // Check if group already bound — 已绑定同一项目则返回，已绑定其他项目则自动切换
  const existing = await getGroupBinding(chatId)
  if (existing) {
    if (existing.fields?.project_id === project.record_id) {
      return { success: true, project, message: `该群已绑定项目：${project.fields?.name}` }
    }
    // 自动解绑旧项目，绑定新项目
    await callTool('delete_group', { groupId: existing.record_id })
  }

  // Create binding
  await callTool('create_group', {
    chat_id: chatId,
    project_id: project.record_id,
    project_name: project.fields?.name,
  })

  return { success: true, project }
}

// Unbind group from project
async function unbindGroup(chatId) {
  const binding = await getGroupBinding(chatId)
  if (!binding) {
    return { success: false, message: '当前群未绑定任何项目' }
  }
  await callTool('delete_group', { groupId: binding.record_id })
  return { success: true, projectName: binding.fields?.project_name }
}

// Check if user is project owner (userId is open_id, need to look up name)
async function isProjectOwner(projectId, userId) {
  const [project, users] = await Promise.all([
    callTool('get_project', { projectId }),
    listRecords('users'),
  ])
  const user = users.find(u => u.fields?.feishu_open_id === userId)
  if (!user) return false
  return project?.fields?.owner === user.fields?.name
}

module.exports = { getGroupBinding, bindGroup, unbindGroup, isProjectOwner }
