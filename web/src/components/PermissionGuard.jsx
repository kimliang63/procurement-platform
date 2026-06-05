import React from 'react'

export default function PermissionGuard({ children, requiredRole = 'admin' }) {
  const user = JSON.parse(localStorage.getItem('feishu_user') || '{}')
  if (user.role !== requiredRole) {
    return null
  }
  return children
}
