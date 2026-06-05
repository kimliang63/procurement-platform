import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { Button, Card, Result } from 'antd'
import Layout from './components/Layout'
import DashboardV2 from './pages/DashboardV2'
import ProjectList from './pages/ProjectList'
import ProjectDetail from './pages/ProjectDetail'
import IssueTracker from './pages/IssueTracker'
import AdminUsers from './pages/AdminUsers'

function AuthCallback() {
  const [status, setStatus] = useState('处理中...')
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const userStr = params.get('user')
    const error = params.get('error')

    if (error) {
      setStatus('登录失败: ' + decodeURIComponent(error))
      return
    }

    if (token) {
      localStorage.setItem('feishu_token', token)
      try {
        const user = JSON.parse(decodeURIComponent(userStr))
        localStorage.setItem('feishu_user', JSON.stringify(user))
      } catch {}

      // 获取用户角色（通过 token 校验身份）
      const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || ''
      fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            const saved = localStorage.getItem('feishu_user')
            const user = saved ? JSON.parse(saved) : {}
            user.role = data.data.role || 'member'
            localStorage.setItem('feishu_user', JSON.stringify(user))
          }
        })
        .catch(() => {})

      setStatus('登录成功，跳转中...')
      setTimeout(() => navigate('/'), 1000)
    } else {
      setStatus('登录失败: 未获取到 token')
    }
  }, [navigate])

  return (
    <div style={{ padding: 100, textAlign: 'center' }}>
      <Result status={status.includes('成功') ? 'success' : 'info'} title={status} />
    </div>
  )
}

function LoginPage() {
  const handleLogin = () => {
    const base = import.meta.env.VITE_API_URL?.replace('/api', '') || ''
    window.location.href = `${base}/api/auth/feishu`
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f5f5' }}>
      <Card style={{ width: 400, textAlign: 'center' }}>
        <h1 style={{ marginBottom: 24 }}>采购协同平台</h1>
        <p style={{ color: '#8c8c8c', marginBottom: 24 }}>使用飞书账号登录</p>
        <Button type="primary" size="large" onClick={handleLogin}>
          飞书登录
        </Button>
      </Card>
    </div>
  )
}

function PrivateRoute({ children }) {
  const token = localStorage.getItem('feishu_token')
  if (!token) return <LoginPage />
  return children
}

export default function App() {
  return (
    <BrowserRouter basename="/">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<DashboardV2 />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="issues" element={<IssueTracker />} />
          <Route path="admin" element={<AdminUsers />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
