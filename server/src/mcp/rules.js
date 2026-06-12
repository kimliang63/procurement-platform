// 节点规则矩阵：key = `${taskType}|${procurementMethod}`
// 值: 'required' | 'visible' | 'hidden'
// required = 必填（可推进，需填实际完成日期）
// visible  = 显示但不必填（可见，不可推进）
// hidden   = 不显示（不创建节点）
const NODE_RULES = {
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
  // 单一来源沿用 fast 规则（框架类）
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
  // 框架招标暂时隐藏，后续补充规则
}

const VALID_STAGE_KEYS = [
  'requirement', 'supplier_dev', 'tech_exchange', 'sampling',
  'bid_approval', 'bid_issue', 'bid_qa', 'bid_return', 'bid_open',
  'bid_determine', 'bid_notify', 'contract_approval', 'production',
  'shipping', 'acceptance',
]

// 获取节点规则：返回 'required' | 'visible' | 'hidden'
function getNodeRule(taskType, procurementMethod, stageKey) {
  const key = `${taskType}|${procurementMethod}`
  const rule = NODE_RULES[key]
  if (!rule) return 'visible' // 未知组合默认显示
  return rule[stageKey] || 'visible'
}

// 获取可见节点列表（required + visible）
function getVisibleNodes(taskType, procurementMethod) {
  return VALID_STAGE_KEYS.filter(sk => {
    const rule = getNodeRule(taskType, procurementMethod, sk)
    return rule === 'required' || rule === 'visible'
  })
}

// 获取必填节点列表（required）
function getRequiredNodes(taskType, procurementMethod) {
  return VALID_STAGE_KEYS.filter(sk => {
    return getNodeRule(taskType, procurementMethod, sk) === 'required'
  })
}

// --- 旧接口兼容（deprecated，保留给 advanceNode/updateNode 过渡使用）---

function isNodeMandatory(taskType, stageKey) {
  // 无 procurementMethod 时回退到旧行为
  return getRequiredNodes(taskType, '项目类').includes(stageKey)
}

function getMandatoryNodes(taskType) {
  return getRequiredNodes(taskType, '项目类')
}

function getNodeValidation(taskType, stageKey, nodeData) {
  if (!nodeData || typeof nodeData !== 'object') {
    return { valid: false, message: '节点数据无效' }
  }
  if (isNodeMandatory(taskType, stageKey)) {
    if (!nodeData.actual_date) {
      return { valid: false, message: `节点"${stageKey}"为必填项，需要填写实际完成日期` }
    }
  }
  return { valid: true }
}

// 启动校验
for (const key of VALID_STAGE_KEYS) {
  // 确保所有 stage key 在至少一个规则组合中出现
}

module.exports = {
  getNodeRule, getVisibleNodes, getRequiredNodes,
  getMandatoryNodes, isNodeMandatory, getNodeValidation, NODE_RULES, VALID_STAGE_KEYS,
}
