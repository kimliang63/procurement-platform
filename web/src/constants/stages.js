export const STAGE_MAP = {
  requirement: '需求确认', supplier_dev: '供应商开发', tech_exchange: '技术交流',
  bid_approval: '招标审批', bid_issue: '发标', bid_qa: '招标答疑',
  bid_return: '供应商回标', bid_open: '开标', bid_determine: '定标',
  bid_notify: '中标通知', contract: '合同签订', production: '生产', shipping: '海运',
}

export const STAGE_KEYS = Object.keys(STAGE_MAP)

export const STAGE_OPTIONS = Object.entries(STAGE_MAP).map(([k, v]) => ({ value: k, label: v }))

export const STAGE_COLORS = {
  requirement: '#1677ff', supplier_dev: '#13c2c2', tech_exchange: '#2f54eb',
  bid_approval: '#722ed1', bid_issue: '#eb2f96', bid_qa: '#fa541c',
  bid_return: '#fa8c16', bid_open: '#fadb14', bid_determine: '#a0d911',
  bid_notify: '#52c41a', contract: '#1890ff', production: '#595959', shipping: '#8c8c8c',
}
