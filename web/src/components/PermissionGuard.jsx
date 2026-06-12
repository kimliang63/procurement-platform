import React, { useMemo } from 'react'

export default function PermissionGuard({ children, requiredRole = 'admin' }) {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('feishu_user') || '{}')
    } catch {
      return {}
    }
  }, [])
  if (user.role !== requiredRole) {
    return null
  }
  return children
}
