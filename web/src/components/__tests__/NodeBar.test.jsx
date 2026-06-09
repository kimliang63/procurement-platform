import React from 'react'
import { render } from '@testing-library/react'
import NodeBar from '../NodeBar'
import { NODE_STATUS_COLORS } from '../../constants/stages'

// jsdom converts hex to rgb, so convert for matching
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${r}, ${g}, ${b})`
}

const RGB_COLORS = Object.fromEntries(
  Object.entries(NODE_STATUS_COLORS).map(([k, v]) => [k, hexToRgb(v)])
)

describe('NodeBar', () => {
  test('renders 15 stage segments', () => {
    const { container } = render(<NodeBar nodes={[]} />)
    const bars = container.querySelectorAll('div[style*="flex: 1"]')
    expect(bars.length).toBeGreaterThanOrEqual(15)
  })

  test('backward-compatible: stages before current are completed', () => {
    const { container } = render(<NodeBar currentStage="bid_issue" />)
    const bars = container.querySelectorAll('div[style*="flex: 1"]')
    // Stages 1-5 = completed (green, full opacity)
    for (let i = 0; i < 5; i++) {
      expect(bars[i].getAttribute('style')).toContain(RGB_COLORS.completed)
      expect(bars[i].getAttribute('style')).not.toContain('opacity: 0.3')
    }
    // Stage 6 = in_progress (blue)
    expect(bars[5].getAttribute('style')).toContain(RGB_COLORS.in_progress)
    // Stages 7-15 = pending (gray, opacity 0.3)
    for (let i = 6; i < 15; i++) {
      expect(bars[i].getAttribute('style')).toContain('opacity: 0.3')
    }
  })

  test('backward-compatible: first stage is in_progress', () => {
    const { container } = render(<NodeBar currentStage="requirement" />)
    const bars = container.querySelectorAll('div[style*="flex: 1"]')
    expect(bars[0].getAttribute('style')).toContain(RGB_COLORS.in_progress)
    for (let i = 1; i < 15; i++) {
      expect(bars[i].getAttribute('style')).toContain('opacity: 0.3')
    }
  })

  test('nodes mode: applies correct colors', () => {
    const nodes = [
      { fields: { stage_key: 'requirement', status: 'completed' } },
      { fields: { stage_key: 'supplier_dev', status: 'in_progress' } },
      { fields: { stage_key: 'tech_exchange', status: 'blocked' } },
    ]
    const { container } = render(<NodeBar nodes={nodes} />)
    const bars = container.querySelectorAll('div[style*="flex: 1"]')
    expect(bars[0].getAttribute('style')).toContain(RGB_COLORS.completed)
    expect(bars[1].getAttribute('style')).toContain(RGB_COLORS.in_progress)
    expect(bars[2].getAttribute('style')).toContain(RGB_COLORS.blocked)
    expect(bars[3].getAttribute('style')).toContain('opacity: 0.3')
  })

  test('nodes mode: missing nodes default to pending', () => {
    const nodes = [{ fields: { stage_key: 'requirement', status: 'completed' } }]
    const { container } = render(<NodeBar nodes={nodes} />)
    const bars = container.querySelectorAll('div[style*="flex: 1"]')
    expect(bars[0].getAttribute('style')).toContain(RGB_COLORS.completed)
    for (let i = 1; i < 15; i++) {
      expect(bars[i].getAttribute('style')).toContain('opacity: 0.3')
    }
  })

  test('overdue uses red color', () => {
    const nodes = [{ fields: { stage_key: 'requirement', status: 'overdue' } }]
    const { container } = render(<NodeBar nodes={nodes} />)
    const bars = container.querySelectorAll('div[style*="flex: 1"]')
    expect(bars[0].getAttribute('style')).toContain(RGB_COLORS.overdue)
  })
})
