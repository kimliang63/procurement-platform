// 快速规则: 单次<100万 / 单一来源
const FAST_RULE_MANDATORY = ['requirement', 'bid_issue', 'bid_determine', 'contract_approval']

// 招标规则: 单次≥100万 / 框架招标
const BIDDING_RULE_MANDATORY = [
  'requirement', 'supplier_dev', 'tech_exchange',
  'bid_approval', 'bid_issue', 'bid_qa',
  'bid_return', 'bid_open', 'bid_determine',
  'bid_notify', 'contract_approval', 'sampling',
]

const TASK_TYPE_RULES = {
  '单次采购<100万': 'fast',
  '单次采购≥100万': 'bidding',
  '单一来源': 'fast',
  '框架招标': 'bidding',
}

function getMandatoryNodes(taskType) {
  const rule = TASK_TYPE_RULES[taskType] || 'bidding'
  return rule === 'fast' ? FAST_RULE_MANDATORY : BIDDING_RULE_MANDATORY
}

function isNodeMandatory(taskType, stageKey) {
  const mandatory = getMandatoryNodes(taskType)
  return mandatory.includes(stageKey)
}

function getNodeValidation(taskType, stageKey, nodeData) {
  const mandatory = getMandatoryNodes(taskType)
  const isMandatory = mandatory.includes(stageKey)

  if (isMandatory) {
    // Mandatory nodes require actual_date
    if (!nodeData.actual_date) {
      return { valid: false, message: `节点"${stageKey}"为必填项，需要填写实际完成日期` }
    }
  }

  // Optional nodes: can be left empty
  return { valid: true }
}

module.exports = { getMandatoryNodes, isNodeMandatory, getNodeValidation, TASK_TYPE_RULES, FAST_RULE_MANDATORY, BIDDING_RULE_MANDATORY }
