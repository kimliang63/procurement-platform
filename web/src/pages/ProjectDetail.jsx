import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Table, Tag, Button, Space, message } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, WarningOutlined } from '@ant-design/icons'
import { getProject, getProjectNodes, advanceNode, markNodeAbnormal } from '../api'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const [pRes, nRes] = await Promise.all([getProject(id), getProjectNodes(id)])
    setProject(pRes.data?.data)
    setNodes(nRes.data?.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleAdvance = async (stageKey) => {
    await advanceNode(id, stageKey, 'completed')
    message.success('节点已推进')
    fetchData()
  }

  const handleAbnormal = async (stageKey) => {
    await markNodeAbnormal(id, stageKey, '手动标记异常')
    message.warning('节点已标记异常')
    fetchData()
  }

  if (!project) return null
  const f = project.fields

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>返回</Button>
      <Card title={`${f?.name} · ${f?.no}`} loading={loading}>
        <Descriptions column={3}>
          <Descriptions.Item label="负责人">{f?.owner}</Descriptions.Item>
          <Descriptions.Item label="品类">{f?.category}</Descriptions.Item>
          <Descriptions.Item label="预算">{f?.budget}万</Descriptions.Item>
          <Descriptions.Item label="计划周期">{f?.plan_start} ~ {f?.plan_end}</Descriptions.Item>
          <Descriptions.Item label="当前阶段">{f?.current_stage}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={f?.status === '异常' ? 'red' : 'blue'}>{f?.status}</Tag></Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="节点进度" style={{ marginTop: 16 }} loading={loading}>
        <Table
          dataSource={nodes}
          rowKey="record_id"
          pagination={false}
          columns={[
            { title: '阶段', dataIndex: ['fields', 'stage_label'] },
            { title: '顺序', dataIndex: ['fields', 'order'] },
            {
              title: '状态', dataIndex: ['fields', 'status'],
              render: v => {
                const map = { completed: { color: 'green', text: '已完成' }, in_progress: { color: 'orange', text: '进行中' }, pending: { color: 'default', text: '待开始' }, blocked: { color: 'red', text: '阻塞' } }
                const cfg = map[v] || map.pending
                return <Tag color={cfg.color}>{cfg.text}</Tag>
              }
            },
            { title: '负责人', dataIndex: ['fields', 'assignee'] },
            { title: '计划日期', dataIndex: ['fields', 'plan_date'] },
            { title: '实际日期', dataIndex: ['fields', 'actual_date'] },
            {
              title: '操作', render: (_, record) => (
                <Space>
                  {record.fields?.status !== 'completed' && (
                    <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleAdvance(record.fields?.stage_key)}>完成</Button>
                  )}
                  {record.fields?.status !== 'blocked' && (
                    <Button size="small" danger icon={<WarningOutlined />} onClick={() => handleAbnormal(record.fields?.stage_key)}>异常</Button>
                  )}
                </Space>
              )
            },
          ]}
        />
      </Card>
    </div>
  )
}
