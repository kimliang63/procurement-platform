const { listRecords } = require('../feishu/bitable')

async function getDashboardStats() {
  const projects = await listRecords('projects')
  const nodes = await listRecords('nodes')
  const issues = await listRecords('issues')

  const currentYear = new Date().getFullYear()
  const yearStart = `${currentYear}-01-01`
  const yearEnd = `${currentYear}-12-31`

  // Basic stats (support both V1 and V2 status values)
  const doing = projects.filter(p => p.fields?.status === '进行中' || p.fields?.status === '正常').length
  const completed = projects.filter(p => p.fields?.status === '项目完成' || p.fields?.status === '已完成').length
  const total = projects.length

  // 本年累计项目数
  const yearProjects = projects.filter(p => {
    const created = p.created_time ? new Date(p.created_time * 1000) : null
    return created && created >= new Date(yearStart) && created <= new Date(yearEnd)
  })
  const yearTotal = yearProjects.length

  // 已定标: bid_determine node completed
  const bidDetermined = projects.filter(p => {
    const projectNodes = nodes.filter(n => n.fields?.project_id === p.record_id)
    return projectNodes.some(n => n.fields?.stage_key === 'bid_determine' && n.fields?.actual_date)
  }).length

  // 100万以上项目
  const over100w = projects.filter(p => (p.fields?.budget || 0) >= 100).length

  // BU stats
  const buStats = {}
  const buses = ['LBU', 'FBU', 'ABU']
  const totalAmount = projects.reduce((sum, p) => sum + (p.fields?.budget || 0), 0)
  buses.forEach(bu => {
    const buProjects = projects.filter(p => p.fields?.department === bu)
    const buDoing = buProjects.filter(p => p.fields?.status === '进行中' || p.fields?.status === '正常').length
    const buYearProjects = buProjects.filter(p => {
      const created = p.created_time ? new Date(p.created_time * 1000) : null
      return created && created >= new Date(yearStart) && created <= new Date(yearEnd)
    })
    const buYearAmount = buYearProjects.reduce((sum, p) => sum + (p.fields?.budget || 0), 0)

    buStats[bu] = {
      doing: buDoing,
      yearCount: buYearProjects.length,
      yearAmount: buYearAmount,
      percentage: totalAmount > 0 ? Math.round((buYearAmount / totalAmount) * 100) : 0,
    }
  })

  // Owner stats
  const ownerStats = {}
  projects.forEach(p => {
    const owner = p.fields?.owner
    if (!owner) return
    if (!ownerStats[owner]) ownerStats[owner] = { doing: 0, yearCount: 0 }
    if (p.fields?.status === '进行中' || p.fields?.status === '正常') ownerStats[owner].doing++
    const created = p.created_time ? new Date(p.created_time * 1000) : null
    if (created && created >= new Date(yearStart) && created <= new Date(yearEnd)) {
      ownerStats[owner].yearCount++
    }
  })

  // Task type stats
  const taskTypeStats = {}
  projects.forEach(p => {
    const tt = p.fields?.task_type || '未分类'
    if (!taskTypeStats[tt]) taskTypeStats[tt] = 0
    taskTypeStats[tt]++
  })

  return {
    basic: { doing, completed, total, yearTotal, bidDetermined, over100w },
    buStats,
    ownerStats,
    taskTypeStats,
  }
}

module.exports = { getDashboardStats }
