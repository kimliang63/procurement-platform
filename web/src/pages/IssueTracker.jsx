import React, { useState, useEffect } from 'react'
import { Table, Button, Tag, Space, Modal, Form, Input, Select, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getIssues, createIssue, updateIssue, getProjects } from '../api'

const STAGE_OPTIONS = [
  { value: 'requirement', label: '需求确认' },
  { value: 'supplier_dev', label: '供应商开发' },
  { value: 'tech_exchange', label: '技术交流' },
  { value: 'bid_approval', label: '招标审批' },
  { value: 'bid_issue', label: '发标' },
  { value: 'bid_qa', label: '招标答疑' },
  { value: 'bid_return', label: '供应商回标' },
  { value: 'bid_open', label: '开标' },
  { value: 'bid_determine', label: '定标' },
  { value: 'bid_notify', label: '中标通知' },
  { value: 'contract', label: '合同签订' },
  { value: 'production', label: '生产' },
  { value: 'shipping', label: '海运' },
]

export default function IssueTracker() {
  const [issues, setIssues] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    const [iRes, pRes] = await Promise.all([getIssues(), getProjects()])
    setIssues(iRes.data?.data || [])
    setProjects(pRes.data?.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async () => {
    const values = await form.validateFields()
    await createIssue(values)
    message.success('问题创建成功')
    setModalOpen(false)
    form.resetFields()
    fetchData()
  }

  const handleStatusChange = async (id, status) => {
    await updateIssue(id, { status })
    message.success('状态已更新')
    fetchData()
  }

  const priorityColor = { '高': 'red', '中': 'orange', '低': 'default' }
  const statusColor = { open: 'red', resolved: 'orange', closed: 'green' }
  const statusText = { open: '待处理', resolved: '处理中', closed: '已解决' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>问题追踪</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建问题</Button>
      </div>
      <Table
        loading={loading}
        dataSource={issues}
        rowKey="record_id"
        columns={[
          { title: '项目', dataIndex: ['fields', 'project_id'] },
          { title: '阶段', dataIndex: ['fields', 'stage_key'] },
          { title: '描述', dataIndex: ['fields', 'description'] },
          { title: '责任人', dataIndex: ['fields', 'assignee'] },
          { title: '优先级', dataIndex: ['fields', 'priority'], render: v => <Tag color={priorityColor[v]}>{v}</Tag> },
          { title: '状态', dataIndex: ['fields', 'status'], render: v => <Tag color={statusColor[v]}>{statusText[v]}</Tag> },
          {
            title: '操作', render: (_, record) => (
              <Space>
                {record.fields?.status === 'open' && (
                  <Button size="small" onClick={() => handleStatusChange(record.record_id, 'resolved')}>标记解决</Button>
                )}
              </Space>
            )
          },
        ]}
      />
      <Modal title="创建问题" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="project_id" label="关联项目" rules={[{ required: true }]}>
            <Select options={projects.map(p => ({ value: p.record_id, label: p.fields?.name }))} />
          </Form.Item>
          <Form.Item name="stage_key" label="关联阶段" rules={[{ required: true }]}>
            <Select options={STAGE_OPTIONS} />
          </Form.Item>
          <Form.Item name="description" label="问题描述" rules={[{ required: true }]}>
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="assignee" label="责任人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select options={[{ value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
