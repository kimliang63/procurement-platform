import React, { useState, useEffect } from 'react'
import { Table, Button, Tag, Space, Modal, Form, Input, Select, Popconfirm, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { getIssues, createIssue, updateIssue, deleteIssue, getProjects, getUsers } from '../api'

const STAGE_MAP = {
  requirement: '需求确认', supplier_dev: '供应商开发', tech_exchange: '技术交流',
  bid_approval: '招标审批', bid_issue: '发标', bid_qa: '招标答疑',
  bid_return: '供应商回标', bid_open: '开标', bid_determine: '定标',
  bid_notify: '中标通知', contract: '合同签订', production: '生产', shipping: '海运',
}
const STAGE_OPTIONS = Object.entries(STAGE_MAP).map(([k, v]) => ({ value: k, label: v }))

export default function IssueTracker() {
  const [issues, setIssues] = useState([])
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [filterStatus, setFilterStatus] = useState(null)
  const [filterPriority, setFilterPriority] = useState(null)
  const [form] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    const [iRes, pRes, uRes] = await Promise.all([getIssues(), getProjects(), getUsers()])
    setIssues(iRes.data?.data || [])
    setProjects(pRes.data?.data || [])
    setUsers(uRes.data?.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const filtered = issues.filter(i => {
    if (filterStatus && i.fields?.status !== filterStatus) return false
    if (filterPriority && i.fields?.priority !== filterPriority) return false
    return true
  })

  const getProjectName = (id) => projects.find(p => p.record_id === id)?.fields?.name || id

  const handleCreate = async () => {
    const values = await form.validateFields()
    if (editItem) {
      await updateIssue(editItem.record_id, values)
      message.success('问题已更新')
    } else {
      await createIssue(values)
      message.success('问题已创建')
    }
    setModalOpen(false)
    setEditItem(null)
    form.resetFields()
    fetchData()
  }

  const handleEdit = (record) => {
    setEditItem(record)
    form.setFieldsValue({
      project_id: record.fields?.project_id,
      stage_key: record.fields?.stage_key,
      description: record.fields?.description,
      assignee: record.fields?.assignee,
      priority: record.fields?.priority,
      status: record.fields?.status,
    })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    await deleteIssue(id)
    message.success('问题已删除')
    fetchData()
  }

  const handleStatusChange = async (id, status) => {
    await updateIssue(id, { status })
    message.success('状态已更新')
    fetchData()
  }

  const priorityColor = { '高': 'red', '中': 'orange', '低': 'default' }
  const statusMap = { open: { color: 'red', text: '待处理' }, in_progress: { color: 'blue', text: '处理中' }, closed: { color: 'green', text: '已关闭' } }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>问题追踪</h1>
        <Space>
          <Select placeholder="状态筛选" allowClear style={{ width: 120 }} onChange={setFilterStatus}
            options={[{ value: 'open', label: '待处理' }, { value: 'in_progress', label: '处理中' }, { value: 'closed', label: '已关闭' }]} />
          <Select placeholder="优先级筛选" allowClear style={{ width: 120 }} onChange={setFilterPriority}
            options={[{ value: '高', label: '高' }, { value: '中', label: '中' }, { value: '低', label: '低' }]} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditItem(null); form.resetFields(); setModalOpen(true) }}>创建问题</Button>
        </Space>
      </div>
      <Table
        loading={loading}
        dataSource={filtered}
        rowKey="record_id"
        columns={[
          { title: '项目', dataIndex: ['fields', 'project_id'], render: v => getProjectName(v) },
          { title: '阶段', dataIndex: ['fields', 'stage_key'], render: v => STAGE_MAP[v] || v },
          { title: '描述', dataIndex: ['fields', 'description'], ellipsis: true },
          { title: '责任人', dataIndex: ['fields', 'assignee'] },
          { title: '优先级', dataIndex: ['fields', 'priority'], render: v => <Tag color={priorityColor[v]}>{v}</Tag> },
          {
            title: '状态', dataIndex: ['fields', 'status'],
            render: (v, record) => (
              <Select value={v} size="small" style={{ width: 100 }}
                onChange={(val) => handleStatusChange(record.record_id, val)}
                options={Object.entries(statusMap).map(([k, info]) => ({ value: k, label: info.text }))} />
            )
          },
          {
            title: '操作', render: (_, record) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
                <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.record_id)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </Space>
            )
          },
        ]}
      />
      <Modal title={editItem ? '编辑问题' : '创建问题'} open={modalOpen} onOk={handleCreate} onCancel={() => { setModalOpen(false); setEditItem(null) }}>
        <Form form={form} layout="vertical">
          <Form.Item name="project_id" label="关联项目" rules={[{ required: true, message: '请选择项目' }]}>
            <Select showSearch filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={projects.map(p => ({ value: p.record_id, label: p.fields?.name }))} />
          </Form.Item>
          <Form.Item name="stage_key" label="关联阶段" rules={[{ required: true, message: '请选择阶段' }]}>
            <Select options={STAGE_OPTIONS} />
          </Form.Item>
          <Form.Item name="description" label="问题描述" rules={[{ required: true, message: '请输入问题描述' }]}>
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="assignee" label="责任人" rules={[{ required: true, message: '请选择责任人' }]}>
            <Select showSearch filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={users.map(u => ({ value: u.fields?.name, label: u.fields?.name }))} />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="中">
            <Select options={[{ value: '高', label: '高' }, { value: '中', label: '中' }, { value: '低', label: '低' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
