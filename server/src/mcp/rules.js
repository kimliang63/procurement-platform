// 三维节点规则矩阵: isSingleSource × budgetAmount × procurementMethod
// 值: 'required' | 'visible' | 'hidden'
// 来源: 飞书表格「采购项目节点关系」

const NODE_RULES = {
  // === 否 + <100万 ===
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
  // === 否 + ≥100万 ===
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
  // === 是（单一来源） ===
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

function getNodeRule(isSingleSource, budgetAmount, procurementMethod, stageKey) {
  const budget = isSingleSource === '是' ? '不区分金额' : budgetAmount
  const key = `${isSingleSource}|${budget}|${procurementMethod}`
  const rule = NODE_RULES[key]
  if (!rule) return 'visible'
  return rule[stageKey] || 'visible'
}

function getVisibleNodes(isSingleSource, budgetAmount, procurementMethod) {
  const keys = [
    'requirement', 'supplier_dev', 'tech_exchange', 'sampling',
    'bid_approval', 'bid_issue', 'bid_qa', 'bid_return', 'bid_open',
    'bid_determine', 'bid_notify', 'contract_approval', 'production',
    'shipping', 'acceptance',
  ]
  return keys.filter(sk => {
    const rule = getNodeRule(isSingleSource, budgetAmount, procurementMethod, sk)
    return rule === 'required' || rule === 'visible'
  })
}

function getRequiredNodes(isSingleSource, budgetAmount, procurementMethod) {
  const keys = [
    'requirement', 'supplier_dev', 'tech_exchange', 'sampling',
    'bid_approval', 'bid_issue', 'bid_qa', 'bid_return', 'bid_open',
    'bid_determine', 'bid_notify', 'contract_approval', 'production',
    'shipping', 'acceptance',
  ]
  return keys.filter(sk => {
    return getNodeRule(isSingleSource, budgetAmount, procurementMethod, sk) === 'required'
  })
}

// 兼容旧接口
function isNodeMandatory(isSingleSource, budgetAmount, procurementMethod, stageKey) {
  return getNodeRule(isSingleSource, budgetAmount, procurementMethod, stageKey) === 'required'
}

function getNodeValidation(isSingleSource, budgetAmount, procurementMethod, stageKey, nodeData) {
  if (!nodeData || typeof nodeData !== 'object') {
    return { valid: false, message: '节点数据无效' }
  }
  const rule = getNodeRule(isSingleSource, budgetAmount, procurementMethod, stageKey)
  if (rule === 'required' && !nodeData.actual_date) {
    return { valid: false, message: `节点"${stageKey}"为必填项，需要填写实际完成日期` }
  }
  return { valid: true }
}

module.exports = { getNodeRule, getVisibleNodes, getRequiredNodes, isNodeMandatory, getNodeValidation, NODE_RULES }
