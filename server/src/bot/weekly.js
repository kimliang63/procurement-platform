const { callTool, STAGE_MAP } = require('../mcp')
const { getGroupBinding } = require('./group')
const client = require('../feishu/client')
const { listRecords } = require('../feishu/bitable')

const STATUS_MAP = { completed: '已完成', in_progress: '进行中', pending: '待开始', blocked: '异常' }

async function generateAdminWeeklyReport() {
  const projects = await callTool('list_projects')

  // Filter projects active this week — check plan dates and status
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

  // Fetch nodes for all active projects
  const projectNodeMap = {}
  for (const p of activeProjects) {
    try {
      const nodes = await callTool('list_project_nodes', { projectId: p.record_id })
      projectNodeMap[p.record_id] = nodes
    } catch {
      projectNodeMap[p.record_id] = []
    }
  }

  // Build report
  const lines = ['采购项目周报', '']
  lines.push(`本周活跃项目：${activeProjects.length} 个`)
  lines.push(`全部项目：${projects.length} 个`)
  lines.push('')

  if (activeProjects.length === 0) {
    lines.push('本周无项目变动。')
  } else {
    activeProjects.forEach(p => {
      const projectNodes = projectNodeMap[p.record_id] || []
      const completed = projectNodes.filter(n => n.fields?.actual_date).length
      const stageLabel = STAGE_MAP[p.fields?.current_stage]?.label || p.fields?.current_stage || '—'
      lines.push(`· ${p.fields?.name}（${p.fields?.no}）`)
      lines.push(`  状态：${p.fields?.status} | 阶段：${stageLabel} | 进度：${completed}/${projectNodes.length} 节点`)
    })
  }

  return lines.join('\n')
}

async function generateGroupWeeklyReport(chatId) {
  const binding = await getGroupBinding(chatId)
  if (!binding) return null

  const projectId = binding.fields?.project_id
  const project = await callTool('get_project', { projectId })
  const nodes = await callTool('list_project_nodes', { projectId })

  const completed = nodes.filter(n => n.fields?.actual_date).length
  const total = nodes.length
  const current = nodes.find(n => n.fields?.status === 'in_progress')

  const lines = [`${project.fields?.name} 周报`, '']
  lines.push(`项目编号：${project.fields?.no}`)
  lines.push(`当前阶段：${current ? STAGE_MAP[current.fields?.stage_key]?.label || current.fields?.stage_key : '已完成'}`)
  lines.push(`进度：${completed}/${total} 节点完成`)
  lines.push('')

  // List this week's changes — check actual_date (completion) and plan dates
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay()) // Sunday
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

  if (recentNodes.length > 0) {
    lines.push('本周变化：')
    recentNodes.forEach(n => {
      const f = n.fields || {}
      const label = STAGE_MAP[f.stage_key]?.label || f.stage_key
      const changes = []
      if (f.actual_date && inRange(f.actual_date)) changes.push(`实际完成 ${f.actual_date}`)
      if (f.plan_start && inRange(f.plan_start)) changes.push(`计划开始 ${f.plan_start}`)
      if (f.plan_end && inRange(f.plan_end)) changes.push(`计划结束 ${f.plan_end}`)
      lines.push(`· ${label}：${changes.join('，') || STATUS_MAP[f.status] || f.status}`)
    })
  } else {
    lines.push('本周无节点变动。')
  }

  return lines.join('\n')
}

async function sendWeeklyReports() {
  const results = { admin: 0, groups: 0, errors: [] }

  // Admin weekly
  try {
    const adminReport = await generateAdminWeeklyReport()
    const configs = await listRecords('weekly_config')
    if (configs.length > 0) {
      const config = configs[0]
      const chatIds = JSON.parse(config.fields?.admin_chat_ids || '[]')
      for (const chatId of chatIds) {
        try {
          await client.im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: adminReport }) },
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
        const report = await generateGroupWeeklyReport(chatId)
        if (report) {
          await client.im.message.create({
            params: { receive_id_type: 'chat_id' },
            data: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text: report }) },
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
