import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import DashboardV2 from '../DashboardV2'

vi.mock('../../api', () => ({
  getStats: vi.fn(),
  getUsers: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

const { getStats } = await import('../../api')

const mockStats = {
  data: {
    data: {
      basic: { total: 10, doing: 5, completed: 3, bidDetermined: 2, over100w: 1, yearTotal: 8 },
      buStats: {
        FBU: { doing: 2, yearCount: 3, yearAmount: 500, percentage: 40 },
        LBU: { doing: 3, yearCount: 2, yearAmount: 300, percentage: 24 },
      },
      ownerStats: {
        '张三': { doing: 2, yearCount: 3 },
        '李四': { doing: 3, yearCount: 2 },
      },
      taskTypeStats: { '框架招标': 3, '单一来源': 2 },
    },
  },
}

describe('DashboardV2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStats.mockResolvedValue(mockStats)
  })

  test('renders stat cards after loading', async () => {
    render(<DashboardV2 />)
    await waitFor(() => {
      expect(screen.getByText(/累计项目数量/)).toBeInTheDocument()
    })
    expect(screen.getByText('进行中项目数量')).toBeInTheDocument()
    expect(screen.getByText('已定标项目数量')).toBeInTheDocument()
    expect(screen.getByText('100万元以上项目数量')).toBeInTheDocument()
  })

  test('renders BU bar chart', async () => {
    render(<DashboardV2 />)
    await waitFor(() => {
      expect(screen.getByText('各BU执行中项目')).toBeInTheDocument()
    })
  })

  test('renders owner bar chart', async () => {
    render(<DashboardV2 />)
    await waitFor(() => {
      expect(screen.getByText('各采购员负责的项目数量')).toBeInTheDocument()
    })
  })

  test('renders page title', async () => {
    render(<DashboardV2 />)
    await waitFor(() => {
      expect(screen.getByText('项目看板')).toBeInTheDocument()
    })
  })

  test('shows spinner while loading', () => {
    getStats.mockReturnValue(new Promise(() => {}))
    const { container } = render(<DashboardV2 />)
    expect(container.querySelector('.ant-spin')).toBeTruthy()
  })
})
