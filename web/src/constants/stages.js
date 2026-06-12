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

export const NODE_STATUS_COLORS = {
  completed: '#52c41a',  // Green
  in_progress: '#1677ff', // Blue
  pending: '#d9d9d9',    // Gray
  blocked: '#ff4d4f',    // Red
  overdue: '#ff4d4f',    // Red
}

// 任务类型选项（框架招标隐藏，后续补充）
export const TASK_TYPE_OPTIONS = [
  { value: '单次采购<100万', label: '单次采购＜100万' },
  { value: '单次采购≥100万', label: '单次采购≥100万' },
  { value: '单一来源', label: '单一来源' },
]

// 采购方式选项
export const PROCUREMENT_METHOD_OPTIONS = [
  { value: '框架类', label: '框架类' },
  { value: '项目类', label: '项目类' },
]

// 节点规则矩阵（与后端 rules.js 同步）
// 值: 'required' | 'visible' | 'hidden'
const _NODE_RULES = {
  '单次采购<100万|框架类': {
    requirement: 'required', supplier_dev: 'hidden', tech_exchange: 'hidden',
    sampling: 'hidden', bid_approval: 'hidden', bid_issue: 'required',
    bid_qa: 'hidden', bid_return: 'hidden', bid_open: 'hidden',
    bid_determine: 'required', bid_notify: 'hidden', contract_approval: 'required',
    production: 'hidden', shipping: 'hidden', acceptance: 'visible',
  },
  '单次采购<100万|项目类': {
    requirement: 'required', supplier_dev: 'hidden', tech_exchange: 'hidden',
    sampling: 'hidden', bid_approval: 'hidden', bid_issue: 'required',
    bid_qa: 'hidden', bid_return: 'hidden', bid_open: 'hidden',
    bid_determine: 'required', bid_notify: 'hidden', contract_approval: 'required',
    production: 'required', shipping: 'required', acceptance: 'visible',
  },
  '单次采购≥100万|框架类': {
    requirement: 'required', supplier_dev: 'required', tech_exchange: 'required',
    sampling: 'required', bid_approval: 'required', bid_issue: 'required',
    bid_qa: 'required', bid_return: 'required', bid_open: 'required',
    bid_determine: 'required', bid_notify: 'required', contract_approval: 'required',
    production: 'hidden', shipping: 'hidden', acceptance: 'visible',
  },
  '单次采购≥100万|项目类': {
    requirement: 'required', supplier_dev: 'required', tech_exchange: 'required',
    sampling: 'required', bid_approval: 'required', bid_issue: 'required',
    bid_qa: 'required', bid_return: 'required', bid_open: 'required',
    bid_determine: 'required', bid_notify: 'required', contract_approval: 'required',
    production: 'required', shipping: 'required', acceptance: 'visible',
  },
  '单一来源|框架类': {
    requirement: 'required', supplier_dev: 'hidden', tech_exchange: 'hidden',
    sampling: 'hidden', bid_approval: 'hidden', bid_issue: 'required',
    bid_qa: 'hidden', bid_return: 'hidden', bid_open: 'hidden',
    bid_determine: 'required', bid_notify: 'hidden', contract_approval: 'required',
    production: 'hidden', shipping: 'hidden', acceptance: 'visible',
  },
  '单一来源|项目类': {
    requirement: 'required', supplier_dev: 'hidden', tech_exchange: 'hidden',
    sampling: 'hidden', bid_approval: 'hidden', bid_issue: 'required',
    bid_qa: 'hidden', bid_return: 'hidden', bid_open: 'hidden',
    bid_determine: 'required', bid_notify: 'hidden', contract_approval: 'required',
    production: 'required', shipping: 'required', acceptance: 'visible',
  },
}

export function getNodeDisplayRule(taskType, procurementMethod, stageKey) {
  const key = `${taskType}|${procurementMethod}`
  const rule = _NODE_RULES[key]
  if (!rule) return 'visible'
  return rule[stageKey] || 'visible'
}

export function getVisibleStages(taskType, procurementMethod) {
  return STAGE_KEYS.filter(sk => {
    const rule = getNodeDisplayRule(taskType, procurementMethod, sk)
    return rule === 'required' || rule === 'visible'
  })
}

export function getRequiredStages(taskType, procurementMethod) {
  return STAGE_KEYS.filter(sk => {
    return getNodeDisplayRule(taskType, procurementMethod, sk) === 'required'
  })
}
