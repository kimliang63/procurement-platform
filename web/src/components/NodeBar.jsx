import React from 'react'
import { Tooltip } from 'antd'
import { STAGE_KEYS, STAGE_MAP as STAGE_LABELS, STAGE_COLORS } from '../constants/stages'

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
