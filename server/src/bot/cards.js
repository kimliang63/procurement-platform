const { STAGE_MAP } = require('../mcp')

function buildStatusChangeCard(project, nodeKey, status, nextNode) {
  const nodeLabel = STAGE_MAP[nodeKey]?.label || nodeKey
  const nextLabel = nextNode ? (STAGE_MAP[nextNode]?.label || nextNode) : '—'
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '节点状态变更' },
      template: status === 'completed' ? 'green' : 'blue',
    },
    elements: [
      {
        tag: 'div',
        text: { tag: 'lark_md', content: `**${project.name}** · ${project.no}` },
      },
      {
        tag: 'div',
        fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**节点**\n${nodeLabel}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**状态**\n${status}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**完成时间**\n${new Date().toLocaleDateString('zh-CN')}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**下一节点**\n${nextLabel}` } },
        ],
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '查看详情' },
            url: `${process.env.WEB_URL}/projects/${project.record_id}`,
            type: 'primary',
          },
        ],
      },
    ],
  }
}

function buildConfirmCard(project, nodeKey, planDate, overdueDays) {
  const nodeLabel = STAGE_MAP[nodeKey]?.label || nodeKey
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '节点确认请求' },
      template: 'orange',
    },
    elements: [
      {
        tag: 'div',
        text: { tag: 'lark_md', content: `**${project.name}** · ${project.no}` },
      },
      {
        tag: 'div',
        fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**待确认节点**\n${nodeLabel}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**计划日期**\n${planDate}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**当前状态**\n${overdueDays > 0 ? `已超期 ${overdueDays} 天` : '正常'}` } },
        ],
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '确认完成' },
            type: 'primary',
            value: { action: 'confirm_node', project_id: project.record_id, stage_key: nodeKey },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '标记异常' },
            type: 'danger',
            value: { action: 'mark_abnormal', project_id: project.record_id, stage_key: nodeKey },
          },
        ],
      },
    ],
  }
}

function buildProjectConfirmCard(params) {
  const fields = [
    { is_short: true, text: { tag: 'lark_md', content: `**项目名称**\n${params?.name || '—'}` } },
    { is_short: true, text: { tag: 'lark_md', content: `**采购品类**\n${params?.category || '—'}` } },
    { is_short: true, text: { tag: 'lark_md', content: `**负责人**\n${params?.owner || '—'}` } },
    { is_short: true, text: { tag: 'lark_md', content: `**所属部门**\n${params?.department || '—'}` } },
    { is_short: true, text: { tag: 'lark_md', content: `**预算**\n${params?.budget || '—'}万` } },
    { is_short: true, text: { tag: 'lark_md', content: `**是否单一来源**\n${params?.isSingleSource || '—'}` } },
    { is_short: true, text: { tag: 'lark_md', content: `**预算金额**\n${params?.budgetAmount || '—'}` } },
    { is_short: true, text: { tag: 'lark_md', content: `**采购方式**\n${params?.procurementMethod || '—'}` } },
    { is_short: true, text: { tag: 'lark_md', content: `**计划周期**\n${params?.planStart || '—'} ~ ${params?.planEnd || '—'}` } },
  ]

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '请确认创建项目' },
      template: 'blue',
    },
    elements: [
      { tag: 'div', fields },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '确认创建' },
            type: 'primary',
            value: { action: 'confirm_project', params },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '取消' },
            type: 'danger',
            value: { action: 'cancel_project' },
          },
        ],
      },
    ],
  }
}

// 按钮点击后替换的"已处理"卡片（无按钮）
function buildCardProcessed(headerTitle, headerColor, fields, statusText) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: headerTitle },
      template: headerColor,
    },
    elements: [
      { tag: 'div', fields },
      { tag: 'div', text: { tag: 'lark_md', content: statusText } },
    ],
  }
}

function buildProjectCreatedCard(data, params) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '项目创建成功' },
      template: 'green',
    },
    elements: [
      {
        tag: 'div',
        fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**项目名称**\n${data?.fields?.name || '—'}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**项目编号**\n${data?.fields?.no || '—'}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**负责人**\n${params?.owner || '—'}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**所属部门**\n${params?.department || '—'}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**预算**\n${params?.budget || '—'}万` } },
          { is_short: true, text: { tag: 'lark_md', content: `**当前阶段**\n需求确认` } },
        ],
      },
      ...(data?.record_id ? [{
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '查看项目' },
            type: 'primary',
            url: `${process.env.WEB_URL || 'http://localhost:5173'}/projects/${data.record_id}`,
          },
        ],
      }] : []),
    ],
  }
}

function buildIssueAlertCard(project, issue) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '问题提醒' },
      template: 'red',
    },
    elements: [
      {
        tag: 'div',
        text: { tag: 'lark_md', content: `**${project.name}** · ${project.no}` },
      },
      {
        tag: 'div',
        fields: [
          { is_short: false, text: { tag: 'lark_md', content: `**问题描述**\n${issue.description}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**关联节点**\n${STAGE_MAP[issue.stage_key]?.label || issue.stage_key}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**责任人**\n${issue.assignee}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**优先级**\n${issue.priority}` } },
        ],
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '查看问题' },
            type: 'primary',
            value: { action: 'view_issue', issue_id: issue.record_id },
          },
        ],
      },
    ],
  }
}

function buildAdminWeeklyCard(activeProjects, projectNodeMap, totalProjects) {
  const now = new Date()
  const weekStr = `${now.getMonth() + 1}月${now.getDate()}日周报`

  const projectLines = activeProjects.map(p => {
    const nodes = projectNodeMap[p.record_id] || []
    const completed = nodes.filter(n => n.fields?.actual_date).length
    const current = nodes.find(n => n.fields?.status === 'in_progress')
    const currentLabel = current ? (STAGE_MAP[current.fields?.stage_key]?.label || current.fields?.stage_key) : '已完成'
    return `**${p.fields?.name}**（${p.fields?.no}）\n状态：${p.fields?.status} | 阶段：${currentLabel} | 进度：${completed}/${nodes.length}`
  })

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `采购项目周报 · ${weekStr}` },
      template: 'blue',
    },
    elements: [
      {
        tag: 'div',
        fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**本周活跃项目**\n${activeProjects.length} 个` } },
          { is_short: true, text: { tag: 'lark_md', content: `**全部项目**\n${totalProjects} 个` } },
        ],
      },
      { tag: 'hr' },
      ...(activeProjects.length > 0
        ? projectLines.map(line => ({ tag: 'div', text: { tag: 'lark_md', content: line } }))
        : [{ tag: 'div', text: { tag: 'lark_md', content: '本周无项目变动。' } }]
      ),
    ],
  }
}

function buildGroupWeeklyCard(project, nodes, recentNodes) {
  const completed = nodes.filter(n => n.fields?.actual_date).length
  const total = nodes.length
  const current = nodes.find(n => n.fields?.status === 'in_progress')
  const currentLabel = current ? (STAGE_MAP[current.fields?.stage_key]?.label || current.fields?.stage_key) : '已完成'
  const now = new Date()
  const weekStr = `${now.getMonth() + 1}月${now.getDate()}日`

  const changeLines = recentNodes.map(n => {
    const f = n.fields || {}
    const label = STAGE_MAP[f.stage_key]?.label || f.stage_key
    const changes = []
    if (f.actual_date) changes.push(`实际完成 ${f.actual_date}`)
    if (f.plan_start) changes.push(`计划开始 ${f.plan_start}`)
    if (f.plan_end) changes.push(`计划结束 ${f.plan_end}`)
    return `· **${label}**：${changes.join('，') || '—'}`
  })

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: `${project.fields?.name} 周报 · ${weekStr}` },
      template: 'green',
    },
    elements: [
      {
        tag: 'div',
        fields: [
          { is_short: true, text: { tag: 'lark_md', content: `**项目编号**\n${project.fields?.no}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**当前阶段**\n${currentLabel}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**进度**\n${completed}/${total} 节点完成` } },
        ],
      },
      { tag: 'hr' },
      ...(recentNodes.length > 0
        ? [
            { tag: 'div', text: { tag: 'lark_md', content: '**本周变化：**' } },
            ...recentNodes.map(n => {
              const f = n.fields || {}
              const label = STAGE_MAP[f.stage_key]?.label || f.stage_key
              const changes = []
              if (f.actual_date) changes.push(`实际完成 ${f.actual_date}`)
              if (f.plan_start) changes.push(`计划开始 ${f.plan_start}`)
              if (f.plan_end) changes.push(`计划结束 ${f.plan_end}`)
              return { tag: 'div', text: { tag: 'lark_md', content: `· **${label}**：${changes.join('，') || '—'}` } }
            }),
          ]
        : [{ tag: 'div', text: { tag: 'lark_md', content: '本周无节点变动。' } }]
      ),
      ...(project?.record_id ? [{
        tag: 'action',
        actions: [{
          tag: 'button',
          text: { tag: 'plain_text', content: '查看项目' },
          type: 'primary',
          url: `${process.env.WEB_URL || 'http://localhost:5173'}/projects/${project.record_id}`,
        }],
      }] : []),
    ],
  }
}

module.exports = { buildStatusChangeCard, buildConfirmCard, buildIssueAlertCard, buildProjectConfirmCard, buildProjectCreatedCard, buildCardProcessed, buildAdminWeeklyCard, buildGroupWeeklyCard }
