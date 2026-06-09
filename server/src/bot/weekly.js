const { callTool, STAGE_MAP } = require('../mcp')
const { getGroupBinding } = require('./group')
const client = require('../feishu/client')
const { listRecords } = require('../feishu/bitable')
const { buildAdminWeeklyCard, buildGroupWeeklyCard } = require('./cards')

async function generateAdminWeeklyReport() {
  const projects = await callTool('list_projects')

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  function inRange(dateStr) {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return d >= weekStart && d < weekEnd
  }

  const activeProjects = projects.filter(p => {
    const f = p.fields || {}
    return inRange(f.plan_start) || inRange(f.plan_end) || f.status === '进行中'
  })

  const projectNodeMap = {}
  for (const p of activeProjects) {
    try {
      const nodes = await callTool('list_project_nodes', { projectId: p.record_id })
      projectNodeMap[p.record_id] = nodes
    } catch {
      projectNodeMap[p.record_id] = []
    }
  }

  return buildAdminWeeklyCard(activeProjects, projectNodeMap, projects.length)
}

async function generateGroupWeeklyReport(chatId) {
  const binding = await getGroupBinding(chatId)
  if (!binding) return null

  const projectId = binding.fields?.project_id
  const project = await callTool('get_project', { projectId })
  const nodes = await callTool('list_project_nodes', { projectId })

  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  function inRange(dateStr) {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return d >= weekStart && d < weekEnd
  }

  const recentNodes = nodes.filter(n => {
    const f = n.fields || {}
    return inRange(f.actual_date) || inRange(f.plan_start) || inRange(f.plan_end)
  })

  return buildGroupWeeklyCard(project, nodes, recentNodes)
}

async function sendWeeklyReports() {
  const results = { admin: 0, groups: 0, errors: [] }

  // Admin weekly
  try {
    const card = await generateAdminWeeklyReport()
    const configs = await listRecords('weekly_config')
    if (configs.length > 0) {
      const config = configs[0]
      const chatIds = JSON.parse(config.fields?.admin_chat_ids || '[]')
      for (const chatId of chatIds) {
        try {
          await client.im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: chatId, msg_type: 'interactive', content: JSON.stringify(card) },
          })
          results.admin++
        } catch (e) {
          results.errors.push(`Admin chat ${chatId}: ${e.message}`)
        }
      }
    }
  } catch (e) {
    results.errors.push(`Admin report: ${e.message}`)
  }

  // Group weekly
  try {
    const groups = await callTool('list_groups')
    for (const group of groups) {
      const chatId = group.fields?.chat_id
      if (!chatId) continue
      try {
        const card = await generateGroupWeeklyReport(chatId)
        if (card) {
          await client.im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: chatId, msg_type: 'interactive', content: JSON.stringify(card) },
          })
          results.groups++
        }
      } catch (e) {
        results.errors.push(`Group ${chatId}: ${e.message}`)
      }
    }
  } catch (e) {
    results.errors.push(`Group report: ${e.message}`)
  }

  return results
}

module.exports = { generateAdminWeeklyReport, generateGroupWeeklyReport, sendWeeklyReports }
