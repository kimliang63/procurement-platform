import React, { useState, useEffect, useCallback } from 'react'
import { Card, Table, Select, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { getUsers, updateUserRole } from '../api'

const roleLabels = {
  admin: '管理员',
  pm: '项目经理',
  member: '成员',
}

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
          options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))}
        />
      ),
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
