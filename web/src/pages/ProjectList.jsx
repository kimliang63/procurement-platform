import React, { useState, useEffect } from 'react'
import { Table, Button, Tag, Modal, Form, Input, Select, InputNumber, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getProjects, createProject } from '../api'

export default function ProjectList() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const fetchProjects = async () => {
    setLoading(true)
    const res = await getProjects()
    setProjects(res.data?.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchProjects() }, [])

  const handleCreate = async () => {
    const values = await form.validateFields()
    await createProject(values)
    message.success('项目创建成功')
    setModalOpen(false)
    form.resetFields()
    fetchProjects()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>项目列表</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建项目</Button>
      </div>
      <Table
        loading={loading}
        dataSource={projects}
        rowKey="record_id"
        onRow={(record) => ({ onClick: () => navigate(`/projects/${record.record_id}`) })}
        columns={[
          { title: '项目名称', dataIndex: ['fields', 'name'] },
          { title: '编号', dataIndex: ['fields', 'no'] },
          { title: '品类', dataIndex: ['fields', 'category'], render: v => <Tag>{v}</Tag> },
          { title: '预算(万)', dataIndex: ['fields', 'budget'] },
          { title: '负责人', dataIndex: ['fields', 'owner'] },
          { title: '当前阶段', dataIndex: ['fields', 'current_stage'] },
          { title: '状态', dataIndex: ['fields', 'status'], render: v => <Tag color={v === '异常' ? 'red' : 'blue'}>{v}</Tag> },
        ]}
      />
      <Modal title="创建项目" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
            <Input placeholder="如：XX设备采购" />
          </Form.Item>
          <Form.Item name="category" label="采购品类" rules={[{ required: true }]}>
            <Select options={[{ value: '设备' }, { value: '材料' }, { value: '服务' }, { value: '其他' }]} />
          </Form.Item>
          <Form.Item name="owner" label="负责人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="budget" label="预算(万元)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="planStart" label="计划开始">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="planEnd" label="计划结束">
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
