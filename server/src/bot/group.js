const { callTool } = require('../mcp')

// Get group binding by chat ID
async function getGroupBinding(chatId) {
  const groups = await callTool('list_groups')
  return groups.find(g => g.fields?.chat_id === chatId)
}

// Bind group to project
async function bindGroup(chatId, projectName, senderId) {
  // Find project by name
  const projects = await callTool('list_projects')
  const project = projects.find(p => p.fields?.name?.includes(projectName))
  if (!project) {
    return { success: false, message: `未找到项目"${projectName}"` }
  }

  // Check if group already bound
  const existing = await getGroupBinding(chatId)
  if (existing) {
    return { success: false, message: '该群已绑定其他项目，请先解绑' }
  }

  // Create binding
  await callTool('create_group', {
    chat_id: chatId,
    project_id: project.record_id,
    project_name: project.fields?.name,
  })

  return { success: true, project }
}

// Check if user is project owner
async function isProjectOwner(projectId, userId) {
  const project = await callTool('get_project', { projectId })
  return project?.fields?.owner === userId
}

module.exports = { getGroupBinding, bindGroup, isProjectOwner }
