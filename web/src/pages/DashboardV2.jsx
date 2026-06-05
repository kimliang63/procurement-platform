import React, { useState, useEffect } from 'react'
import { Row, Col, Card, Table, Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getStats, getUsers } from '../api'

export default function DashboardV2() {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    Promise.all([getStats(), getUsers()])
      .then(([sRes, uRes]) => {
        setStats(sRes.data?.data)
        setUsers(uRes.data?.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!stats) return null

  const { basic, buStats, ownerStats } = stats

  // Basic stat cards
  const statCards = [
    { title: '项目总数', value: basic.total, color: '#8c8c8c' },
    { title: '进行中', value: basic.doing, color: '#1677ff' },
    { title: '已完成', value: basic.completed, color: '#52c41a' },
    { title: '已定标', value: basic.bidDetermined, color: '#722ed1' },
    { title: '100万以上', value: basic.over100w, color: '#fa541c' },
  ]

  // BU table data
  const buData = Object.entries(buStats).map(([bu, data]) => ({
    key: bu,
    bu,
    ...data,
  })).filter(d => d.doing > 0 || d.yearCount > 0)

  // Owner table data
  const ownerData = Object.entries(ownerStats).map(([owner, data]) => ({
    key: owner,
    owner,
    ...data,
  }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>项目看板</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/projects/new')}>
          创建项目
        </Button>
      </div>

      {/* Basic Stats */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {statCards.map((s, i) => (
          <Col xs={12} sm={8} md={4} key={i}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 6 }}>{s.title}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        {/* BU Stats */}
        <Col span={14}>
          <Card title="按 BU 统计">
            <Table
              dataSource={buData}
              pagination={false}
              columns={[
                { title: 'BU', dataIndex: 'bu' },
                { title: '进行中', dataIndex: 'doing' },
                { title: '本年累计', dataIndex: 'yearCount' },
                { title: '年度金额(万)', dataIndex: 'yearAmount', render: v => v.toLocaleString() },
                { title: '占比', dataIndex: 'percentage', render: v => `${v}%` },
              ]}
            />
          </Card>
        </Col>

        {/* Owner Stats */}
        <Col span={10}>
          <Card title="按负责人统计">
            <Table
              dataSource={ownerData}
              pagination={false}
              columns={[
                { title: '负责人', dataIndex: 'owner' },
                { title: '进行中', dataIndex: 'doing' },
                { title: '本年累计', dataIndex: 'yearCount' },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
