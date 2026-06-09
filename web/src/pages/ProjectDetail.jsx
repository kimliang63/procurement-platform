import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Table, Tag, Button, Space, Modal, Form, Input, Select, Popconfirm, InputNumber, message, Tabs, Tooltip } from 'antd'
import { ArrowLeftOutlined, EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { getProject, getProjectNodes, updateNode, advanceNode, getIssues, createIssue, updateIssue, updateProject, deleteProject, getUsers } from '../api'
import PermissionGuard from '../components/PermissionGuard'
import { STAGE_MAP, NODE_STATUS_COLORS, STAGE_KEYS } from '../constants/stages'

const ISSUE_STATUS_MAP = {
  open: { color: 'orange', text: '待处理' },
  in_progress: { color: 'blue', text: '处理中' },
  closed: { color: 'green', text: '已关闭' },
}

const PROJECT_STATUS_COLORS = {
  '进行中': 'blue',
  '项目完成': 'green',
  '项目暂停': 'orange',
  '项目取消': 'red',
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [nodes, setNodes] = useState([])
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editNode, setEditNode] = useState(null)
  const [issueModal, setIssueModal] = useState(false)
  const [issueNode, setIssueNode] = useState(null)
  const [users, setUsers] = useState([])
  const [projectModal, setProjectModal] = useState(false)
  const [form] = Form.useForm()
  const [issueForm] = Form.useForm()
  const [projectForm] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [pRes, nRes, iRes, uRes] = await Promise.all([
        getProject(id), getProjectNodes(id), getIssues({ projectId: id }), getUsers()
      ])
      setProject(pRes.data?.data)
      setNodes(nRes.data?.data || [])
      setIssues(iRes.data?.data || [])
      setUsers(uRes.data?.data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleEdit = (record) => {
    setEditNode(record)
    form.setFieldsValue({
      plan_start: record.fields?.plan_start || '',
      plan_end: record.fields?.plan_end || '',
      actual_date: record.fields?.actual_date || '',
      status: record.fields?.status || 'pending',
      note: record.fields?.note || '',
    })
    setEditModal(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const updateFields = {
        plan_start: values.plan_start || '',
        plan_end: values.plan_end || '',
        actual_date: values.actual_date || '',
        note: values.note || '',
      }
      // 填了实际日期时自动推进节点
      if (values.actual_date && editNode.fields?.status !== 'completed') {
        await advanceNode(id, editNode.fields?.stage_key, values.actual_date)
      }
      await updateNode(id, editNode.fields?.stage_key, updateFields)
      message.success('保存成功')
      setEditModal(false)
      fetchData()
    } catch (e) {
      if (e?.response?.data?.error) message.error(e.response.data.error)
    }
  }

  const handleCreateIssue = (record) => {
    setIssueNode(record)
    issueForm.resetFields()
    setIssueModal(true)
  }

  const handleSaveIssue = async () => {
    try {
      const values = await issueForm.validateFields()
      await createIssue({
        projectId: id,
        stageKey: issueNode.fields?.stage_key,
        ...values,
      })
      message.success('问题已创建')
      setIssueModal(false)
      fetchData()
    } catch (e) {
      if (e?.response?.data?.error) message.error(e.response.data.error)
    }
  }

  const handleUpdateIssue = async (record, status) => {
    try {
      await updateIssue(record.record_id, { status })
      message.success('问题状态已更新')
      fetchData()
    } catch (e) {
      if (e?.response?.data?.error) message.error(e.response.data.error)
    }
  }

  const handleEditProject = () => {
    const f = project?.fields
    projectForm.setFieldsValue({
      name: f?.name,
      category: f?.category,
      department: f?.department,
      owner: f?.owner,
      budget: f?.budget,
      task_type: f?.task_type,
      plan_start: f?.plan_start,
      plan_end: f?.plan_end,
      remark: f?.remark,
    })
    setProjectModal(true)
  }

  const handleSaveProject = async () => {
    try {
      const values = await projectForm.validateFields()
      const payload = {
        name: values.name,
        category: values.category,
        department: values.department,
        owner: values.owner,
        budget: values.budget,
        taskType: values.task_type,
        planStart: values.plan_start,
        planEnd: values.plan_end,
        remark: values.remark,
      }
      await updateProject(id, payload)
      message.success('项目已更新')
      setProjectModal(false)
      fetchData()
    } catch (e) {
      if (e?.response?.data?.error) message.error(e.response.data.error)
    }
  }

  const handleDeleteProject = async () => {
    try {
      await deleteProject(id)
      message.success('项目已删除')
      navigate('/projects')
    } catch (e) {
      if (e?.response?.data?.error) message.error(e.response.data.error)
    }
  }

  const getNodeIssues = (stageKey) => issues.filter(i => i.fields?.stage_key === stageKey)

  if (!project) return null
  const f = project.fields

  const nodeColumns = [
    { title: '阶段', dataIndex: ['fields', 'stage_key'], render: v => STAGE_MAP[v] || v },
    {
      title: '状态', dataIndex: ['fields', 'status'],
      render: v => {
        const map = { completed: { color: 'green', text: '已完成' }, in_progress: { color: 'orange', text: '进行中' }, pending: { color: 'default', text: '待开始' }, blocked: { color: 'red', text: '异常' }, overdue: { color: 'red', text: '逾期' } }
        const cfg = map[v] || map.pending
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      }
    },
    { title: '计划开始', dataIndex: ['fields', 'plan_start'], render: v => v || '-' },
    { title: '计划结束', dataIndex: ['fields', 'plan_end'], render: v => v || '-' },
    { title: '实际完成', dataIndex: ['fields', 'actual_date'], render: v => v || '-' },
    {
      title: '问题数', key: 'issues',
      render: (_, record) => {
        const count = getNodeIssues(record.fields?.stage_key).length
        return count > 0 ? <Tag color="red">{count}个问题</Tag> : '-'
      }
    },
    {
      title: '操作', render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" icon={<PlusOutlined />} onClick={() => handleCreateIssue(record)}>创建问题</Button>
        </Space>
      )
    },
  ]

  const issueColumns = [
    { title: '阶段', dataIndex: ['fields', 'stage_key'], render: v => STAGE_MAP[v] || v },
    { title: '问题描述', dataIndex: ['fields', 'description'], ellipsis: true },
    { title: '负责人', dataIndex: ['fields', 'assignee'] },
    { title: '优先级', dataIndex: ['fields', 'priority'], render: v => <Tag>{v}</Tag> },
    {
      title: '状态', dataIndex: ['fields', 'status'],
      render: (v, record) => (
        <Select
          value={v}
          size="small"
          style={{ width: 100 }}
          onChange={(val) => handleUpdateIssue(record, val)}
          options={Object.entries(ISSUE_STATUS_MAP).map(([k, info]) => ({ value: k, label: info.text }))}
        />
      )
    },
  ]

  const userOptions = users.map(u => ({ value: u.fields?.name, label: u.fields?.name || '未知用户' }))

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>返回</Button>
      <Card
        title={`${f?.name} · ${f?.no}`}
        loading={loading}
        extra={
          <Space>
            <Button icon={<EditOutlined />} onClick={handleEditProject}>编辑项目</Button>
            <PermissionGuard requiredRole="admin">
              <Popconfirm title="确认删除该项目？所有节点和问题将一并删除" onConfirm={handleDeleteProject}>
                <Button danger icon={<DeleteOutlined />}>删除项目</Button>
              </Popconfirm>
            </PermissionGuard>
          </Space>
        }
      >
        <Descriptions column={3}>
          <Descriptions.Item label="负责人">{f?.owner}</Descriptions.Item>
          <Descriptions.Item label="采购金额">{f?.budget}万</Descriptions.Item>
          <Descriptions.Item label="任务类型">{f?.task_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="所属部门">{f?.department}</Descriptions.Item>
          <Descriptions.Item label="品类">{f?.category}</Descriptions.Item>
          <Descriptions.Item label="计划周期">{f?.plan_start} ~ {f?.plan_end}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }} loading={loading}>
        <Tabs items={[
          {
            key: 'nodes',
            label: '节点进度',
            children: (
              <>
                {/* Timeline bar showing all 15 stages */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {STAGE_KEYS.map(stageKey => {
                      const node = nodes.find(n => n.fields?.stage_key === stageKey)
                      const status = node?.fields?.status || 'pending'
                      return (
                        <Tooltip key={stageKey} title={`${STAGE_MAP[stageKey]}: ${status === 'completed' ? '已完成' : status === 'in_progress' ? '进行中' : status === 'blocked' ? '异常' : '待开始'}`}>
                          <div
                            style={{
                              flex: 1,
                              height: 12,
                              borderRadius: 6,
                              background: NODE_STATUS_COLORS[status] || NODE_STATUS_COLORS.pending,
                              cursor: 'pointer',
                            }}
                            onClick={() => node && handleEdit(node)}
                          />
                        </Tooltip>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#999' }}>
                    <span>{STAGE_MAP[STAGE_KEYS[0]]}</span>
                    <span>{STAGE_MAP[STAGE_KEYS[STAGE_KEYS.length - 1]]}</span>
                  </div>
                </div>
                <Table dataSource={nodes} rowKey="record_id" pagination={false} columns={nodeColumns} />
              </>
            )
          },
          {
            key: 'issues',
            label: `问题列表 (${issues.length})`,
            children: (
              <Table dataSource={issues} rowKey="record_id" pagination={false} columns={issueColumns} />
            )
          },
        ]} />
      </Card>

      <Modal title={`编辑节点 - ${STAGE_MAP[editNode?.fields?.stage_key] || editNode?.fields?.stage_key}`} open={editModal} onOk={handleSave} onCancel={() => setEditModal(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="status" label="节点状态">
            <Select options={[
              { value: 'pending', label: '待开始' },
              { value: 'in_progress', label: '进行中' },
              { value: 'completed', label: '已完成' },
              { value: 'blocked', label: '异常' },
            ]} />
          </Form.Item>
          <Form.Item name="plan_start" label="计划开始日期">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="plan_end" label="计划结束日期">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="actual_date" label="实际完成日期">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`创建问题 - ${STAGE_MAP[issueNode?.fields?.stage_key] || issueNode?.fields?.stage_key}`} open={issueModal} onOk={handleSaveIssue} onCancel={() => setIssueModal(false)}>
        <Form form={issueForm} layout="vertical">
          <Form.Item name="description" label="问题描述" rules={[{ required: true, message: '请输入问题描述' }]}>
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="assignee" label="负责人" rules={[{ required: true, message: '请选择负责人' }]}>
            <Select placeholder="请选择" showSearch filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} options={userOptions} />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="中">
            <Select options={[{ value: '高', label: '高' }, { value: '中', label: '中' }, { value: '低', label: '低' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="编辑项目" open={projectModal} onOk={handleSaveProject} onCancel={() => setProjectModal(false)} width={640}>
        <Form form={projectForm} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="采购品类" rules={[{ required: true, message: '请选择采购品类' }]}>
            <Select options={[{ value: '设备' }, { value: '材料' }, { value: '服务' }, { value: '其他' }]} />
          </Form.Item>
          <Form.Item name="department" label="所属部门" rules={[{ required: true, message: '请选择所属部门' }]}>
            <Select options={[{ value: 'FBU' }, { value: 'LBU' }, { value: 'ABU' }]} />
          </Form.Item>
          <Form.Item name="owner" label="负责人" rules={[{ required: true, message: '请选择负责人' }]}>
            <Select showSearch filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} options={userOptions} />
          </Form.Item>
          <Form.Item name="budget" label="预算(万元)" rules={[{ required: true, message: '请输入预算' }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="task_type" label="任务类型">
            <Select options={[{ value: '框架招标' }, { value: '单一来源' }, { value: '单次采购' }]} />
          </Form.Item>
          <Form.Item name="plan_start" label="计划开始" rules={[{ required: true, message: '请选择日期' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="plan_end" label="计划结束" rules={[{ required: true, message: '请选择日期' }]}>
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
