import React, { useState, useEffect } from 'react'
import { Card, Input, Select, Space, Tag, Button, Modal, Form, InputNumber, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getProjects, createProject, getUsers, getBatchNodes } from '../api'
import { STAGE_MAP, STAGE_KEYS, NODE_STATUS_COLORS } from '../constants/stages'

export default function ProjectTimeline() {
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [projectNodes, setProjectNodes] = useState({})
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterOwner, setFilterOwner] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const res = await getProjects()
      const list = res.data?.data || []
      setProjects(list)
      // Batch fetch all nodes in one request
      if (list.length > 0) {
        const ids = list.map(p => p.record_id)
        const nRes = await getBatchNodes(ids)
        setProjectNodes(nRes.data?.data || {})
      }
    } catch {}
    setLoading(false)
  }

  const fetchUsers = async () => {
    try {
      const res = await getUsers()
      setUsers(res.data?.data || [])
    } catch {}
  }

  useEffect(() => {
    fetchProjects()
    fetchUsers()
  }, [])

  const filtered = projects.filter(p => {
    if (searchText && !p.fields?.name?.toLowerCase().includes(searchText.toLowerCase())) return false
    if (filterOwner && p.fields?.owner !== filterOwner) return false
    return true
  })

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      await createProject(values)
      message.success('项目创建成功')
      setModalOpen(false)
      form.resetFields()
      fetchProjects()
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message
      if (msg) message.error(msg)
    }
  }

  const userOptions = users.map(u => ({
    value: u.fields?.name || u.fields?.feishu_open_id,
    label: u.fields?.name || '未知用户',
  }))

  const statusColors = {
    '进行中': 'blue',
    '项目完成': 'green',
    '项目暂停': 'orange',
    '项目取消': 'red',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>项目列表</h1>
        <Space>
          <Input.Search placeholder="搜索项目名称" style={{ width: 200 }} allowClear onChange={e => setSearchText(e.target.value)} />
          <Select placeholder="按负责人" allowClear style={{ width: 160 }} onChange={setFilterOwner} options={userOptions} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建项目</Button>
        </Space>
      </div>

      {filtered.map(project => (
        <Card
          key={project.record_id}
          style={{ marginBottom: 12, cursor: 'pointer' }}
          onClick={() => navigate(`/projects/${project.record_id}`)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{project.fields?.name}</span>
              <span style={{ marginLeft: 8, color: '#8c8c8c' }}>{project.fields?.no}</span>
            </div>
            <Space>
              <span>{project.fields?.owner}</span>
              <Tag color={statusColors[project.fields?.status] || 'default'}>{project.fields?.status}</Tag>
            </Space>
          </div>
          {/* Timeline bar */}
          <div style={{ display: 'flex', gap: 2 }}>
            {STAGE_KEYS.map(key => {
              const nodes = projectNodes[project.record_id] || []
              const node = nodes.find(n => n.fields?.stage_key === key)
              const status = node?.fields?.status || 'pending'
              return (
                <div
                  key={key}
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    background: NODE_STATUS_COLORS[status] || NODE_STATUS_COLORS.pending,
                    opacity: status === 'pending' ? 0.3 : 1,
                  }}
                  title={`${STAGE_MAP[key]}: ${status}`}
                />
              )
            })}
          </div>
        </Card>
      ))}

      <Modal title="创建项目" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="如：XX设备采购" />
          </Form.Item>
          <Form.Item name="category" label="采购品类" rules={[{ required: true, message: '请选择采购品类' }]}>
            <Select placeholder="请选择" options={[{ value: '设备' }, { value: '材料' }, { value: '服务' }, { value: '其他' }]} />
          </Form.Item>
          <Form.Item name="department" label="所属部门" rules={[{ required: true, message: '请选择所属部门' }]}>
            <Select placeholder="请选择" options={[{ value: 'FBU' }, { value: 'LBU' }, { value: 'ABU' }]} />
          </Form.Item>
          <Form.Item name="owner" label="负责人" rules={[{ required: true, message: '请选择负责人' }]}>
            <Select placeholder="请选择" showSearch filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} options={userOptions} />
          </Form.Item>
          <Form.Item name="budget" label="采购金额(万元)" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="taskType" label="任务类型" rules={[{ required: true, message: '请选择任务类型' }]}>
            <Select placeholder="请选择" options={[
              { value: '框架招标', label: '框架招标' },
              { value: '单一来源', label: '单一来源' },
              { value: '单次采购', label: '单次采购' },
            ]} />
          </Form.Item>
          <Form.Item name="planStart" label="计划开始" rules={[{ required: true, message: '请选择日期' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="planEnd" label="计划结束" rules={[{ required: true, message: '请选择日期' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
