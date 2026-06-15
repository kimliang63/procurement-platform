import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, Avatar, Dropdown, Space, Tag } from 'antd'
import { DashboardOutlined, ProjectOutlined, WarningOutlined, UserOutlined, LogoutOutlined, TeamOutlined } from '@ant-design/icons'

const { Sider, Content, Header } = AntLayout

const roleLabels = {
  admin: '管理员',
  pm: '项目负责人',
}

const roleColors = {
  admin: 'red',
  pm: 'blue',
}

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('feishu_user')
    if (saved) {
      try { setUser(JSON.parse(saved)) } catch {}
    }
    // 从后端拉最新角色
    const token = localStorage.getItem('feishu_token')
    if (token) {
      const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || ''
      fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setUser(prev => {
              const updated = { ...prev, role: data.data.role, name: data.data.name || prev?.name }
              localStorage.setItem('feishu_user', JSON.stringify(updated))
              return updated
            })
          }
        })
        .catch(() => {})
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('feishu_token')
    localStorage.removeItem('feishu_user')
    navigate('/login')
  }

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '项目总览' },
    { key: '/projects', icon: <ProjectOutlined />, label: '项目列表' },
    { key: '/issues', icon: <WarningOutlined />, label: '问题追踪' },
    { key: '/admin', icon: <TeamOutlined />, label: '用户管理', hidden: user?.role !== 'admin' },
  ].filter(item => !item.hidden)

  const userMenu = {
    items: [
      { key: 'role', label: `角色: ${roleLabels[user?.role] || '成员'}`, disabled: true },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
    ],
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={220} style={{ position: 'fixed', height: '100vh', left: 0, top: 0, bottom: 0, zIndex: 20 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>采购协同平台</div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout style={{ marginLeft: 220 }}>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 10 }}>
          <Dropdown menu={userMenu}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} src={user?.avatar} />
              <span>{user?.name || '未登录'}</span>
              <Tag color={roleColors[user?.role]}>{roleLabels[user?.role] || '成员'}</Tag>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
