import React from 'react'
import { render, screen } from '@testing-library/react'
import PermissionGuard from '../PermissionGuard'

describe('PermissionGuard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('renders children when role matches', () => {
    localStorage.setItem('feishu_user', JSON.stringify({ role: 'admin' }))
    render(
      <PermissionGuard>
        <div>Protected content</div>
      </PermissionGuard>
    )
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  test('returns null when role does not match', () => {
    localStorage.setItem('feishu_user', JSON.stringify({ role: 'member' }))
    const { container } = render(
      <PermissionGuard>
        <div>Protected content</div>
      </PermissionGuard>
    )
    expect(container.innerHTML).toBe('')
  })

  test('defaults to requiring admin role', () => {
    localStorage.setItem('feishu_user', JSON.stringify({ role: 'member' }))
    const { container } = render(
      <PermissionGuard>
        <div>Admin only</div>
      </PermissionGuard>
    )
    expect(container.innerHTML).toBe('')
  })

  test('renders with custom requiredRole', () => {
    localStorage.setItem('feishu_user', JSON.stringify({ role: 'pm' }))
    render(
      <PermissionGuard requiredRole="pm">
        <div>PM content</div>
      </PermissionGuard>
    )
    expect(screen.getByText('PM content')).toBeInTheDocument()
  })

  test('hides content with wrong custom role', () => {
    localStorage.setItem('feishu_user', JSON.stringify({ role: 'admin' }))
    const { container } = render(
      <PermissionGuard requiredRole="pm">
        <div>PM content</div>
      </PermissionGuard>
    )
    expect(container.innerHTML).toBe('')
  })

  test('handles missing localStorage data', () => {
    const { container } = render(
      <PermissionGuard>
        <div>Content</div>
      </PermissionGuard>
    )
    expect(container.innerHTML).toBe('')
  })
})
