import React from 'react'
import { Tooltip } from 'antd'

const STAGE_KEYS = [
  'requirement', 'supplier_dev', 'tech_exchange', 'bid_approval',
  'bid_issue', 'bid_qa', 'bid_return', 'bid_open',
  'bid_determine', 'bid_notify', 'contract', 'production', 'shipping',
]

const STAGE_LABELS = {
  requirement: '需求确认', supplier_dev: '供应商开发', tech_exchange: '技术交流',
  bid_approval: '招标审批', bid_issue: '发标', bid_qa: '招标答疑',
  bid_return: '供应商回标', bid_open: '开标', bid_determine: '定标',
  bid_notify: '中标通知', contract: '合同签订', production: '生产', shipping: '海运',
}

const STAGE_COLORS = {
  requirement: '#1677ff', supplier_dev: '#13c2c2', tech_exchange: '#2f54eb',
  bid_approval: '#722ed1', bid_issue: '#eb2f96', bid_qa: '#fa541c',
  bid_return: '#fa8c16', bid_open: '#fadb14', bid_determine: '#a0d911',
  bid_notify: '#52c41a', contract: '#1890ff', production: '#595959', shipping: '#8c8c8c',
}

export default function NodeBar({ currentStage, completed = 0, total = 13 }) {
  const currentOrder = STAGE_KEYS.indexOf(currentStage) + 1

  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {STAGE_KEYS.map((key, i) => {
        const order = i + 1
        const isCompleted = order < currentOrder
        const isCurrent = order === currentOrder
        return (
          <Tooltip key={key} title={STAGE_LABELS[key]}>
            <div style={{
              flex: 1, height: 4, borderRadius: 2,
              background: isCompleted ? '#52c41a' : isCurrent ? STAGE_COLORS[key] : '#e8e8e8',
              opacity: isCompleted || isCurrent ? 1 : 0.3,
            }} />
          </Tooltip>
        )
      })}
      <span style={{ fontSize: 10, color: '#8c8c8c', marginLeft: 4 }}>{completed}/{total}</span>
    </div>
  )
}
