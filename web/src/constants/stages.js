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
  completed: '#52c41a',
  in_progress: '#1677ff',
  pending: '#d9d9d9',
  blocked: '#ff4d4f',
  overdue: '#ff4d4f',
}

export const SINGLE_SOURCE_OPTIONS = [
  { value: '否', label: '否' },
  { value: '是', label: '是' },
]

export const BUDGET_AMOUNT_OPTIONS = [
  { value: '<100万', label: '＜100万' },
  { value: '≥100万', label: '≥100万' },
]

export const PROCUREMENT_METHOD_OPTIONS = [
  { value: '框架类', label: '框架类' },
  { value: '项目类', label: '项目类' },
]

const _NODE_RULES = {
  '否|<100万|框架类': {
    requirement: 'required', supplier_dev: 'hidden', tech_exchange: 'hidden',
    sampling: 'hidden', bid_approval: 'hidden', bid_issue: 'required',
    bid_qa: 'hidden', bid_return: 'hidden', bid_open: 'hidden',
    bid_determine: 'required', bid_notify: 'hidden', contract_approval: 'required',
    production: 'hidden', shipping: 'hidden', acceptance: 'hidden',
  },
  '否|<100万|项目类': {
    requirement: 'required', supplier_dev: 'hidden', tech_exchange: 'hidden',
    sampling: 'hidden', bid_approval: 'hidden', bid_issue: 'required',
    bid_qa: 'hidden', bid_return: 'hidden', bid_open: 'hidden',
    bid_determine: 'required', bid_notify: 'hidden', contract_approval: 'required',
    production: 'required', shipping: 'required', acceptance: 'required',
  },
  '否|≥100万|框架类': {
    requirement: 'required', supplier_dev: 'required', tech_exchange: 'visible',
    sampling: 'visible', bid_approval: 'required', bid_issue: 'required',
    bid_qa: 'required', bid_return: 'required', bid_open: 'required',
    bid_determine: 'required', bid_notify: 'required', contract_approval: 'required',
    production: 'hidden', shipping: 'hidden', acceptance: 'hidden',
  },
  '否|≥100万|项目类': {
    requirement: 'required', supplier_dev: 'required', tech_exchange: 'visible',
    sampling: 'visible', bid_approval: 'required', bid_issue: 'required',
    bid_qa: 'required', bid_return: 'required', bid_open: 'required',
    bid_determine: 'required', bid_notify: 'required', contract_approval: 'required',
    production: 'required', shipping: 'required', acceptance: 'required',
  },
  '是|不区分金额|框架类': {
    requirement: 'required', supplier_dev: 'hidden', tech_exchange: 'hidden',
    sampling: 'hidden', bid_approval: 'hidden', bid_issue: 'required',
    bid_qa: 'hidden', bid_return: 'hidden', bid_open: 'hidden',
    bid_determine: 'required', bid_notify: 'hidden', contract_approval: 'required',
    production: 'hidden', shipping: 'hidden', acceptance: 'hidden',
  },
  '是|不区分金额|项目类': {
    requirement: 'required', supplier_dev: 'hidden', tech_exchange: 'hidden',
    sampling: 'hidden', bid_approval: 'hidden', bid_issue: 'required',
    bid_qa: 'hidden', bid_return: 'hidden', bid_open: 'hidden',
    bid_determine: 'required', bid_notify: 'hidden', contract_approval: 'required',
    production: 'required', shipping: 'required', acceptance: 'required',
  },
}

export function getNodeDisplayRule(isSingleSource, budgetAmount, procurementMethod, stageKey) {
  const budget = isSingleSource === '是' ? '不区分金额' : budgetAmount
  const key = `${isSingleSource}|${budget}|${procurementMethod}`
  const rule = _NODE_RULES[key]
  if (!rule) return 'visible'
  return rule[stageKey] || 'visible'
}

export function getVisibleStages(isSingleSource, budgetAmount, procurementMethod) {
  return STAGE_KEYS.filter(sk => {
    const rule = getNodeDisplayRule(isSingleSource, budgetAmount, procurementMethod, sk)
    return rule === 'required' || rule === 'visible'
  })
}

export function getRequiredStages(isSingleSource, budgetAmount, procurementMethod) {
  return STAGE_KEYS.filter(sk => {
    return getNodeDisplayRule(isSingleSource, budgetAmount, procurementMethod, sk) === 'required'
  })
}
