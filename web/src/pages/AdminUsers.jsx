import React, { useState, useEffect } from 'react'
import { Card, Table, Tag, Select, message, Space } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

const API_BASE = import.meta.env.VITE_API_BASE || ''

const roleLabels = {
  admin: '管理员',
  pm: '项目经理',
  member: '成员',
}

const roleColors = {
  admin: 'red',
  pm: 'blue',
  member: 'green',
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('feishu_token')
      const res = await fetch(`${API_BASE}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setUsers(data.data || [])
    } catch (e) {
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleRoleChange = async (record, newRole) => {
    try {
      const token = localStorage.getItem('feishu_token')
      const res = await fetch(`${API_BASE}/api/auth/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ record_id: record.record_id, role: newRole }),
      })
      const data = await res.json()
      if (data.success) {
        message.success('角色更新成功')
        fetchUsers()
      } else {
        message.error(data.error || '更新失败')
      }
    } catch (e) {
      message.error('更新失败')
    }
  }

  const columns = [
    {
      title: '姓名',
      dataIndex: ['fields', 'name'],
      key: 'name',
    },
    {
      title: '飞书 ID',
      dataIndex: ['fields', 'feishu_open_id'],
      key: 'feishu_open_id',
      ellipsis: true,
    },
    {
      title: '角色',
      dataIndex: ['fields', 'role'],
      key: 'role',
      render: (role, record) => (
        <Select
          value={role || 'member'}
          onChange={(val) => handleRoleChange(record, val)}
          style={{ width: 120 }}
          options={[
            { value: 'admin', label: '管理员' },
            { value: 'pm', label: '项目经理' },
            { value: 'member', label: '成员' },
          ]}
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_time',
      key: 'created_time',
      render: (t) => t ? new Date(t * 1000).toLocaleString('zh-CN') : '-',
    },
  ]

  return (
    <Card
      title="用户管理"
      extra={<ReloadOutlined onClick={fetchUsers} style={{ cursor: 'pointer' }} />}
    >
      <Table
        dataSource={users}
        columns={columns}
        rowKey="record_id"
        loading={loading}
        pagination={false}
      />
    </Card>
  )
}
