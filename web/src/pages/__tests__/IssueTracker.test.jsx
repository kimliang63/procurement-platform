import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import IssueTracker from '../IssueTracker'

vi.mock('../../api', () => ({
  getIssues: vi.fn(),
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
  deleteIssue: vi.fn(),
  getProjects: vi.fn(),
  getUsers: vi.fn(),
}))

const { getIssues, getProjects, getUsers } = await import('../../api')

const mockIssues = {
  data: {
    data: [
      { record_id: 'i1', fields: { project_id: 'r1', stage_key: 'requirement', description: '需求不明确', assignee: '张三', priority: '高', status: 'open' } },
      { record_id: 'i2', fields: { project_id: 'r1', stage_key: 'bid_issue', description: '发标延迟', assignee: '李四', priority: '中', status: 'in_progress' } },
      { record_id: 'i3', fields: { project_id: 'r2', stage_key: 'contract_approval', description: '合同审批问题', assignee: '张三', priority: '低', status: 'closed' } },
    ],
  },
}

const mockProjects = {
  data: {
    data: [
      { record_id: 'r1', fields: { name: '项目A' } },
      { record_id: 'r2', fields: { name: '项目B' } },
    ],
  },
}

const mockUsers = {
  data: { data: [{ fields: { name: '张三' } }, { fields: { name: '李四' } }] },
}

describe('IssueTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getIssues.mockResolvedValue(mockIssues)
    getProjects.mockResolvedValue(mockProjects)
    getUsers.mockResolvedValue(mockUsers)
  })

  test('renders page title and create button', async () => {
    render(<IssueTracker />)
    await waitFor(() => {
      expect(screen.getByText('问题追踪')).toBeInTheDocument()
    })
    expect(screen.getByText('创建问题')).toBeInTheDocument()
  })

  test('renders issue table after loading', async () => {
    render(<IssueTracker />)
    await waitFor(() => {
      expect(screen.getByText('需求不明确')).toBeInTheDocument()
    })
    expect(screen.getByText('发标延迟')).toBeInTheDocument()
    expect(screen.getByText('合同审批问题')).toBeInTheDocument()
  })

  test('renders issue descriptions', async () => {
    render(<IssueTracker />)
    await waitFor(() => {
      expect(screen.getByText('需求不明确')).toBeInTheDocument()
    })
  })

  test('renders assignees', async () => {
    render(<IssueTracker />)
    await waitFor(() => {
      const zhangsanElements = screen.getAllByText('张三')
      expect(zhangsanElements.length).toBeGreaterThanOrEqual(2)
    })
    expect(screen.getAllByText('李四').length).toBeGreaterThanOrEqual(1)
  })

  test('renders stage names in Chinese', async () => {
    render(<IssueTracker />)
    await waitFor(() => {
      expect(screen.getByText('需求确认')).toBeInTheDocument()
    })
    expect(screen.getByText('发标')).toBeInTheDocument()
    expect(screen.getByText('合同审批')).toBeInTheDocument()
  })

  test('renders status filter select', async () => {
    render(<IssueTracker />)
    await waitFor(() => {
      // Ant Design Select renders placeholder as a <span>, not input placeholder
      expect(screen.getAllByText('状态筛选').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('优先级筛选').length).toBeGreaterThanOrEqual(1)
  })

  test('resolves project names from project IDs', async () => {
    render(<IssueTracker />)
    await waitFor(() => {
      expect(screen.getAllByText('项目A').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('项目B').length).toBeGreaterThanOrEqual(1)
  })
})
