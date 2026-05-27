import React, { useState, useEffect } from 'react'
import { Row, Col, Card, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getProjects } from '../api'
import NodeBar from '../components/NodeBar'

export default function Dashboard() {
  const [projects, setProjects] = useState([])
  const [stats, setStats] = useState({ doing: 0, done: 0, problem: 0, total: 0 })
  const navigate = useNavigate()

  useEffect(() => {
    getProjects().then(res => {
      const list = res.data?.data || []
      setProjects(list)
      setStats({
        doing: list.filter(p => p.fields?.status === '正常').length,
        done: list.filter(p => p.fields?.status === '已完成').length,
        problem: list.filter(p => p.fields?.status === '异常').length,
        total: list.length,
      })
    })
  }, [])

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>项目总览</h1>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {[
          { title: '进行中', value: stats.doing, color: '#1677ff' },
          { title: '已完成', value: stats.done, color: '#52c41a' },
          { title: '有问题', value: stats.problem, color: '#ff4d4f' },
          { title: '总项目', value: stats.total, color: '#8c8c8c' },
        ].map((s, i) => (
          <Col span={6} key={i}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 6 }}>{s.title}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="项目列表">
        <Table
          dataSource={projects}
          rowKey="record_id"
          onRow={(record) => ({ onClick: () => navigate(`/projects/${record.record_id}`) })}
          columns={[
            { title: '项目名称', dataIndex: ['fields', 'name'] },
            { title: '品类', dataIndex: ['fields', 'category'], render: v => <Tag>{v}</Tag> },
            { title: '预算(万)', dataIndex: ['fields', 'budget'] },
            { title: '负责人', dataIndex: ['fields', 'owner'] },
            { title: '当前阶段', dataIndex: ['fields', 'current_stage'] },
            {
              title: '进度', dataIndex: 'record_id',
              render: (_, record) => <NodeBar currentStage={record.fields?.current_stage} />
            },
          ]}
        />
      </Card>
    </div>
  )
}
