function buildStatusChangeCard(project, nodeKey, status, nextNode) {
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
          { is_short: true, text: { tag: 'lark_md', content: `**节点**\n${nodeKey}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**状态**\n${status}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**完成时间**\n${new Date().toLocaleDateString('zh-CN')}` } },
          { is_short: true, text: { tag: 'lark_md', content: `**下一节点**\n${nextNode || '—'}` } },
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
          { is_short: true, text: { tag: 'lark_md', content: `**待确认节点**\n${nodeKey}` } },
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
          { is_short: true, text: { tag: 'lark_md', content: `**关联节点**\n${issue.stage_key}` } },
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

module.exports = { buildStatusChangeCard, buildConfirmCard, buildIssueAlertCard }
