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

const { getStats, getUsers } = await import('../../api')

const mockStats = {
  data: {
    data: {
      basic: { total: 10, doing: 5, completed: 3, bidDetermined: 2, over100w: 1 },
      buStats: {
        FBU: { doing: 2, yearCount: 3, yearAmount: 500, percentage: 40 },
        LBU: { doing: 3, yearCount: 2, yearAmount: 300, percentage: 24 },
        HQU: { doing: 0, yearCount: 0, yearAmount: 0, percentage: 0 },
      },
      ownerStats: {
        '张三': { doing: 2, yearCount: 3 },
        '李四': { doing: 3, yearCount: 2 },
      },
    },
  },
}

const mockUsers = {
  data: { data: [{ fields: { name: '张三' } }, { fields: { name: '李四' } }] },
}

describe('DashboardV2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStats.mockResolvedValue(mockStats)
    getUsers.mockResolvedValue(mockUsers)
  })

  test('renders stat cards after loading', async () => {
    render(<DashboardV2 />)
    await waitFor(() => {
      expect(screen.getByText('项目总数')).toBeInTheDocument()
    })
    // '进行中' appears in stat card + table headers
    expect(screen.getAllByText('进行中').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('10').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('已完成').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('已定标').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('100万以上')).toBeInTheDocument()
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
  })

  test('renders BU stats table', async () => {
    render(<DashboardV2 />)
    await waitFor(() => {
      expect(screen.getByText('按 BU 统计')).toBeInTheDocument()
    })
    expect(screen.getByText('FBU')).toBeInTheDocument()
    expect(screen.getByText('LBU')).toBeInTheDocument()
    // HQU filtered out (doing=0, yearCount=0)
    expect(screen.queryByText('HQU')).not.toBeInTheDocument()
  })

  test('renders owner stats table', async () => {
    render(<DashboardV2 />)
    await waitFor(() => {
      expect(screen.getByText('按负责人统计')).toBeInTheDocument()
    })
    expect(screen.getByText('张三')).toBeInTheDocument()
    expect(screen.getByText('李四')).toBeInTheDocument()
  })

  test('renders page title and create button', async () => {
    render(<DashboardV2 />)
    await waitFor(() => {
      expect(screen.getByText('项目看板')).toBeInTheDocument()
    })
    expect(screen.getByText('创建项目')).toBeInTheDocument()
  })

  test('returns null while loading', () => {
    getStats.mockReturnValue(new Promise(() => {})) // never resolves
    const { container } = render(<DashboardV2 />)
    expect(container.innerHTML).toBe('')
  })
})
