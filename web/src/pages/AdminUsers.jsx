import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Select, Tag, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { getUsers, updateUserRole } from '../api'

const ROLE_OPTIONS = [
  { value: 'admin', label: '管理员' },
  { value: 'pm', label: '项目负责人' },
]

const ROLE_COLORS = { admin: 'red', pm: 'blue' }
const ROLE_LABELS = { admin: '管理员', pm: '项目负责人' }

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getUsers()
      setUsers(res.data?.data || [])
    } catch (e) {
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleRoleChange = async (record, newRole) => {
    try {
      const res = await updateUserRole(record.record_id, newRole)
      if (res.data?.success) {
        message.success('角色更新成功')
        fetchUsers()
      } else {
        message.error(res.data?.error || '更新失败')
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
      title: '角色',
      dataIndex: ['fields', 'role'],
      key: 'role',
      render: (role, record) => (
        <Select
          value={role || 'pm'}
          onChange={(val) => handleRoleChange(record, val)}
          style={{ width: 140 }}
          options={ROLE_OPTIONS}
        />
      ),
    },
    {
      title: '飞书 ID',
      dataIndex: ['fields', 'feishu_open_id'],
      key: 'feishu_open_id',
      ellipsis: true,
      render: v => <span style={{ color: '#999', fontSize: 12 }}>{v}</span>,
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
