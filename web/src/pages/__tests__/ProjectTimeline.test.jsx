import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import ProjectTimeline from '../ProjectTimeline'

vi.mock('../../api', () => ({
  getProjects: vi.fn(),
  createProject: vi.fn(),
  getUsers: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

const { getProjects, getUsers } = await import('../../api')

const mockProjects = {
  data: {
    data: [
      { record_id: 'r1', fields: { name: '项目A', no: 'CG-2026-001', owner: '张三', status: '进行中', bu: 'FBU' } },
      { record_id: 'r2', fields: { name: '项目B', no: 'CG-2026-002', owner: '李四', status: '项目完成', bu: 'LBU' } },
      { record_id: 'r3', fields: { name: '项目C', no: 'CG-2026-003', owner: '张三', status: '项目暂停', bu: 'FBU' } },
    ],
  },
}

const mockUsers = {
  data: { data: [{ fields: { name: '张三' } }, { fields: { name: '李四' } }] },
}

describe('ProjectTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getProjects.mockResolvedValue(mockProjects)
    getUsers.mockResolvedValue(mockUsers)
  })

  test('renders page title and create button', async () => {
    render(<ProjectTimeline />)
    await waitFor(() => {
      expect(screen.getByText('项目列表')).toBeInTheDocument()
    })
    expect(screen.getByText('创建项目')).toBeInTheDocument()
  })

  test('renders project cards after loading', async () => {
    render(<ProjectTimeline />)
    await waitFor(() => {
      expect(screen.getByText('项目A')).toBeInTheDocument()
    })
    expect(screen.getByText('项目B')).toBeInTheDocument()
    expect(screen.getByText('项目C')).toBeInTheDocument()
  })

  test('renders project numbers', async () => {
    render(<ProjectTimeline />)
    await waitFor(() => {
      expect(screen.getByText('CG-2026-001')).toBeInTheDocument()
    })
    expect(screen.getByText('CG-2026-002')).toBeInTheDocument()
  })

  test('renders project owners', async () => {
    render(<ProjectTimeline />)
    await waitFor(() => {
      expect(screen.getAllByText('张三').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('李四').length).toBeGreaterThanOrEqual(1)
  })

  test('renders status tags', async () => {
    render(<ProjectTimeline />)
    await waitFor(() => {
      expect(screen.getByText('进行中')).toBeInTheDocument()
    })
    expect(screen.getByText('项目完成')).toBeInTheDocument()
    expect(screen.getByText('项目暂停')).toBeInTheDocument()
  })

  test('renders search input', async () => {
    render(<ProjectTimeline />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('搜索项目名称')).toBeInTheDocument()
    })
  })

  test('renders owner filter select', async () => {
    render(<ProjectTimeline />)
    await waitFor(() => {
      expect(screen.getAllByText('按负责人').length).toBeGreaterThanOrEqual(1)
    })
  })

  test('renders timeline bar for each project (15 segments per project)', async () => {
    const { container } = render(<ProjectTimeline />)
    await waitFor(() => {
      expect(screen.getByText('项目A')).toBeInTheDocument()
    })
    // Each project card has a timeline bar with 15 segments (title attributes from STAGE_MAP)
    const timelineSegments = container.querySelectorAll('[title="需求确认"]')
    // 3 projects × 1 segment each with title="需求确认"
    expect(timelineSegments.length).toBe(3)
  })
})
