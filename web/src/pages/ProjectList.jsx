import React, { useState, useEffect } from 'react'
import { Table, Button, Tag, Modal, Form, Input, Select, InputNumber, Popconfirm, Space, message } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getProjects, createProject, deleteProject, getUsers } from '../api'
import { STAGE_MAP } from '../constants/stages'

export default function ProjectList() {
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterDept, setFilterDept] = useState(null)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const res = await getProjects()
      setProjects(res.data?.data || [])
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
    if (filterDept && p.fields?.department !== filterDept) return false
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

  const handleDelete = async (id) => {
    await deleteProject(id)
    message.success('项目已删除')
    fetchProjects()
  }

  const userOptions = users.map(u => ({
    value: u.fields?.name || u.fields?.feishu_open_id,
    label: u.fields?.name || '未知用户',
  }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>项目列表</h1>
        <Space>
          <Input.Search placeholder="搜索项目名称" style={{ width: 200 }} allowClear onChange={e => setSearchText(e.target.value)} />
          <Select placeholder="部门筛选" allowClear style={{ width: 120 }} onChange={setFilterDept}
            options={[{ value: 'FBU', label: 'FBU' }, { value: 'LBU', label: 'LBU' }, { value: 'ABU', label: 'ABU' }]} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建项目</Button>
        </Space>
      </div>
      <Table
        loading={loading}
        dataSource={filtered}
        rowKey="record_id"
        onRow={(record) => ({ onClick: () => navigate(`/projects/${record.record_id}`) })}
        columns={[
          { title: '项目名称', dataIndex: ['fields', 'name'] },
          { title: '编号', dataIndex: ['fields', 'no'] },
          { title: '品类', dataIndex: ['fields', 'category'], render: v => <Tag>{v}</Tag> },
          { title: '所属部门', dataIndex: ['fields', 'department'] },
          { title: '预算(万)', dataIndex: ['fields', 'budget'] },
          { title: '负责人', dataIndex: ['fields', 'owner'] },
          { title: '当前阶段', dataIndex: ['fields', 'current_stage'], render: v => STAGE_MAP[v] || v },
          { title: '状态', dataIndex: ['fields', 'status'], render: v => <Tag color={v === '异常' ? 'red' : 'blue'}>{v}</Tag> },
          {
            title: '操作', render: (_, record) => (
              <Popconfirm title="确认删除该项目？" onConfirm={(e) => { e.stopPropagation(); handleDelete(record.record_id) }} onCancel={e => e.stopPropagation()}>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()}>删除</Button>
              </Popconfirm>
            )
          },
        ]}
      />
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
          <Form.Item name="budget" label="预算(万元)" rules={[{ required: true, message: '请输入预算' }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="请输入数字" />
          </Form.Item>
          <Form.Item name="taskType" label="任务类型" rules={[{ required: true, message: '请选择任务类型' }]}>
            <Select placeholder="请选择" options={[{ value: '框架招标' }, { value: '单一来源' }, { value: '单次采购' }]} />
          </Form.Item>
          <Form.Item name="planStart" label="计划开始" rules={[{ required: true, message: '请选择计划开始日期' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="planEnd" label="计划结束" rules={[{ required: true, message: '请选择计划结束日期' }]}>
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
