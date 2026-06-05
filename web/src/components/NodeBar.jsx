import React from 'react'
import { Tooltip } from 'antd'
import { STAGE_KEYS, STAGE_MAP as STAGE_LABELS, NODE_STATUS_COLORS } from '../constants/stages'

export default function NodeBar({ nodes = [], currentStage }) {
  const currentOrder = STAGE_KEYS.indexOf(currentStage) + 1
  const hasNodes = nodes.length > 0

  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {STAGE_KEYS.map((key, i) => {
        let status
        if (hasNodes) {
          const node = nodes.find(n => n.fields?.stage_key === key)
          status = node?.fields?.status || 'pending'
        } else {
          // Backward-compatible: derive status from currentStage
          const order = i + 1
          if (currentOrder > 0 && order < currentOrder) status = 'completed'
          else if (currentOrder > 0 && order === currentOrder) status = 'in_progress'
          else status = 'pending'
        }
        const color = NODE_STATUS_COLORS[status] || NODE_STATUS_COLORS.pending
        return (
          <Tooltip key={key} title={`${STAGE_LABELS[key]}: ${status}`}>
            <div style={{
              flex: 1, height: 4, borderRadius: 2,
              background: color,
              opacity: status === 'pending' ? 0.3 : 1,
            }} />
          </Tooltip>
        )
      })}
    </div>
  )
}
