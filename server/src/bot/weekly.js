const { callTool, STAGE_MAP } = require('../mcp')
const { getGroupBinding } = require('./group')
const client = require('../feishu/client')
const { listRecords } = require('../feishu/bitable')
const { buildAdminWeeklyCard, buildGroupWeeklyCard } = require('./cards')

function getWeekRange() {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)
  return { weekStart, weekEnd }
}

function inWeekRange(dateStr, weekStart, weekEnd) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d >= weekStart && d < weekEnd
}

async function generateAdminWeeklyReport() {
  const projects = await callTool('list_projects')
  const { weekStart, weekEnd } = getWeekRange()

  const activeProjects = projects.filter(p => {
    const f = p.fields || {}
    return inWeekRange(f.plan_start, weekStart, weekEnd)
      || inWeekRange(f.plan_end, weekStart, weekEnd)
      || f.status === '进行中'
  })

  // 批量拉取所有 nodes（替代 N+1 查询）
  const allNodes = await listRecords('nodes')
  const projectNodeMap = {}
  activeProjects.forEach(p => { projectNodeMap[p.record_id] = [] })
  allNodes.forEach(n => {
    const pid = n.fields?.project_id
    if (projectNodeMap[pid]) projectNodeMap[pid].push(n)
  })

  return buildAdminWeeklyCard(activeProjects, projectNodeMap, projects.length)
}

async function generateGroupWeeklyReport(chatId) {
  const binding = await getGroupBinding(chatId)
  if (!binding) return null

  const projectId = binding.fields?.project_id
  const project = await callTool('get_project', { projectId })
  const nodes = await callTool('list_project_nodes', { projectId })

  const { weekStart, weekEnd } = getWeekRange()
  const recentNodes = nodes.filter(n => {
    const f = n.fields || {}
    return inWeekRange(f.actual_date, weekStart, weekEnd)
      || inWeekRange(f.plan_start, weekStart, weekEnd)
      || inWeekRange(f.plan_end, weekStart, weekEnd)
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
