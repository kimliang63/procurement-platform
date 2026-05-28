import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { Button, Card, Result } from 'antd'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ProjectList from './pages/ProjectList'
import ProjectDetail from './pages/ProjectDetail'
import IssueTracker from './pages/IssueTracker'

function AuthCallback() {
  const [status, setStatus] = useState('处理中...')
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const user = params.get('user')
    const error = params.get('error')

    if (error) {
      setStatus('登录失败: ' + decodeURIComponent(error))
      return
    }

    if (token) {
      localStorage.setItem('feishu_token', token)
      localStorage.setItem('feishu_user', user)
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
    window.location.href = '/api/auth/feishu'
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
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="issues" element={<IssueTracker />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
