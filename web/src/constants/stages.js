export const STAGE_MAP = {
  requirement: '需求确认',
  supplier_dev: '供应商开发',
  tech_exchange: '技术交流',
  sampling: '打样',
  bid_approval: '招标方案审批',
  bid_issue: '发标',
  bid_qa: '答疑',
  bid_return: '供应商回标',
  bid_open: '开标',
  bid_determine: '定标',
  bid_notify: '中标/未中标通知',
  contract_approval: '合同审批',
  production: '生产',
  shipping: '运输',
  acceptance: '验收',
}

export const STAGE_KEYS = Object.keys(STAGE_MAP)

export const STAGE_OPTIONS = Object.entries(STAGE_MAP).map(([k, v]) => ({ value: k, label: v }))

// 4-color scheme: completed=green, current=blue, pending=gray, blocked=red
export const STAGE_COLORS = {
  requirement: '#1677ff',
  supplier_dev: '#1677ff',
  tech_exchange: '#1677ff',
  sampling: '#1677ff',
  bid_approval: '#1677ff',
  bid_issue: '#1677ff',
  bid_qa: '#1677ff',
  bid_return: '#1677ff',
  bid_open: '#1677ff',
  bid_determine: '#1677ff',
  bid_notify: '#1677ff',
  contract_approval: '#1677ff',
  production: '#1677ff',
  shipping: '#1677ff',
  acceptance: '#1677ff',
}

export const NODE_STATUS_COLORS = {
  completed: '#52c41a',  // Green
  in_progress: '#1677ff', // Blue
  pending: '#d9d9d9',    // Gray
  blocked: '#ff4d4f',    // Red
  overdue: '#ff4d4f',    // Red
}
