import React, { useState, useEffect } from 'react'
import { Button, Tag, Modal, Form, Input, Select, InputNumber, Popconfirm, Space, message, InputNumber as InputNum } from 'antd'
import { PlusOutlined, DeleteOutlined, CheckCircleFilled } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getProjects, createProject, deleteProject, getUsers, getBatchNodes, getIssues } from '../api'
import { STAGE_MAP, STAGE_KEYS, NODE_STATUS_COLORS } from '../constants/stages'

const STATUS_COLORS = { '进行中': 'blue', '项目完成': 'green', '项目暂停': 'orange', '项目取消': 'red' }

function formatShortDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function isDelayed(node) {
  const f = node?.fields || {}
  if (!f.plan_end || f.actual_date) return false
  return new Date() > new Date(f.plan_end)
}

function ProjectCard({ project, nodes, issueCount, onDelete }) {
  const navigate = useNavigate()
  const f = project.fields || {}
  const completedCount = nodes.filter(n => n.fields?.actual_date).length
  const total = nodes.length || 1
  const progress = Math.round((completedCount / total) * 100)

  // Find current node (in_progress or first pending after last completed)
  const currentNodeIdx = (() => {
    const inProgress = nodes.findIndex(n => n.fields?.status === 'in_progress')
    if (inProgress >= 0) return inProgress
    const lastCompleted = (() => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].fields?.actual_date) return i
      }
      return -1
    })()
    return lastCompleted + 1 < nodes.length ? lastCompleted + 1 : nodes.length - 1
  })()

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>
          <span style={styles.projectName}>{f.name}</span>
          <span style={styles.projectNo}>{f.no}</span>
        </div>
        <div style={styles.cardMeta}>
          <span style={styles.metaText}>负责人: {f.owner}</span>
          <span style={styles.metaText}>预算: {f.budget}万</span>
          <Tag color={STATUS_COLORS[f.status] || 'blue'} style={{ margin: 0 }}>{f.status || '进行中'}</Tag>
          {issueCount > 0 && <Tag color="red" style={{ margin: 0 }}>{issueCount}个问题</Tag>}
          <Popconfirm title="确认删除该项目？" onConfirm={(e) => { e.stopPropagation(); onDelete(project.record_id) }} onCancel={e => e.stopPropagation()}>
            <DeleteOutlined style={{ color: '#999', cursor: 'pointer', marginLeft: 4 }} onClick={e => e.stopPropagation()} />
          </Popconfirm>
        </div>
      </div>

      {/* Timeline */}
      <div style={styles.timelineWrap}>
        <div style={styles.timeline}>
          {STAGE_KEYS.map((key, idx) => {
            const node = nodes.find(n => n.fields?.stage_key === key)
            const status = node?.fields?.actual_date ? 'completed' : idx === currentNodeIdx ? 'in_progress' : 'pending'
            const delayed = isDelayed(node)
            const label = STAGE_MAP[key]
            const planDate = formatShortDate(node?.fields?.plan_start || node?.fields?.plan_end)
            const actualDate = formatShortDate(node?.fields?.actual_date)

            return (
              <div key={key} style={styles.nodeCol}>
                {/* Circle */}
                <div style={styles.nodeCircleWrap}>
                  {idx > 0 && <div style={{
                    ...styles.line,
                    background: status === 'completed' || (idx <= currentNodeIdx && nodes[idx - 1]?.fields?.actual_date)
                      ? NODE_STATUS_COLORS.completed : '#e8e8e8',
                  }} />}
                  <div style={{
                    ...styles.circle,
                    background: status === 'completed' ? NODE_STATUS_COLORS.completed
                      : status === 'in_progress' ? NODE_STATUS_COLORS.in_progress
                      : '#fff',
                    borderColor: status === 'completed' ? NODE_STATUS_COLORS.completed
                      : status === 'in_progress' ? NODE_STATUS_COLORS.in_progress
                      : '#d9d9d9',
                    color: status === 'pending' ? '#999' : '#fff',
                  }}>
                    {status === 'completed'
                      ? <CheckCircleFilled style={{ fontSize: 16, color: '#fff' }} />
                      : <span style={{ fontSize: 11, fontWeight: 600 }}>{idx + 1}</span>
                    }
                  </div>
                </div>
                {/* Label */}
                <div style={styles.nodeLabel}>{label}</div>
                {/* Dates */}
                <div style={styles.nodeDates}>
                  {planDate && <div style={{ color: '#666', fontSize: 10 }}>计划: {planDate}</div>}
                  {delayed && !actualDate && <div style={{ color: '#ff4d4f', fontSize: 10 }}>延: {planDate}</div>}
                  {actualDate && <div style={{ color: '#52c41a', fontSize: 10 }}>完成: {actualDate}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div style={styles.progressWrap}>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
        <span style={styles.progressText}>{progress}%</span>
      </div>
    </div>
  )
}

export default function ProjectList() {
  const [projects, setProjects] = useState([])
  const [nodesMap, setNodesMap] = useState({})
  const [issueCountMap, setIssueCountMap] = useState({})
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterDept, setFilterDept] = useState(null)
  const [form] = Form.useForm()

  const fetchData = async () => {
    setLoading(true)
    try {
      const [pRes, uRes, iRes] = await Promise.all([getProjects(), getUsers(), getIssues()])
      const projects = pRes.data?.data || []
      setProjects(projects)
      setUsers(uRes.data?.data || [])

      // Count issues per project
      const issues = iRes.data?.data || []
      const countMap = {}
      issues.forEach(i => {
        const pid = i.fields?.project_id
        if (pid) countMap[pid] = (countMap[pid] || 0) + 1
      })
      setIssueCountMap(countMap)

      // Batch fetch nodes
      if (projects.length > 0) {
        const ids = projects.map(p => p.record_id)
        const nRes = await getBatchNodes(ids)
        setNodesMap(nRes.data?.data || {})
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      await createProject(values)
      message.success('项目创建成功')
      setModalOpen(false)
      form.resetFields()
      fetchData()
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message
      if (msg) message.error(msg)
    }
  }

  const handleDelete = async (id) => {
    await deleteProject(id)
    message.success('项目已删除')
    fetchData()
  }

  const userOptions = users.map(u => ({
    value: u.fields?.name || u.fields?.feishu_open_id,
    label: u.fields?.name || '未知用户',
  }))

  const filtered = projects.filter(p => {
    if (searchText && !p.fields?.name?.toLowerCase().includes(searchText.toLowerCase())) return false
    if (filterDept && p.fields?.department !== filterDept) return false
    return true
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>项目列表</h1>
        <Space>
          <Input.Search placeholder="搜索项目名称" style={{ width: 200 }} allowClear onChange={e => setSearchText(e.target.value)} />
          <Select placeholder="部门筛选" allowClear style={{ width: 120 }} onChange={setFilterDept}
            options={[{ value: 'FBU', label: 'FBU' }, { value: 'LBU', label: 'LBU' }, { value: 'ABU', label: 'ABU' }]} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建项目</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {filtered.map(p => (
          <div key={p.record_id} onClick={() => navigate(`/projects/${p.record_id}`)} style={{ cursor: 'pointer' }}>
            <ProjectCard
              project={p}
              nodes={nodesMap[p.record_id] || []}
              issueCount={issueCountMap[p.record_id] || 0}
              onDelete={handleDelete}
            />
          </div>
        ))}
        {filtered.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无项目</div>
        )}
      </div>

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
            <Select placeholder="请选择" options={[{ value: '框架招标', label: '框架招标' }, { value: '单一来源', label: '单一来源' }, { value: '单次采购<100万', label: '单次采购＜100万' }, { value: '单次采购≥100万', label: '单次采购≥100万' }]} />
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

const styles = {
  card: {
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #f0f0f0',
    padding: '16px 20px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  projectName: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  projectNo: {
    fontSize: 12,
    color: '#999',
    background: '#f5f5f5',
    padding: '2px 8px',
    borderRadius: 4,
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    color: '#666',
  },
  metaText: {
    whiteSpace: 'nowrap',
  },
  timelineWrap: {
    overflowX: 'auto',
    padding: '8px 0',
  },
  timeline: {
    display: 'flex',
    alignItems: 'flex-start',
    minWidth: 'max-content',
  },
  nodeCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: '1 0 auto',
    width: 72,
    position: 'relative',
  },
  nodeCircleWrap: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    height: 32,
  },
  line: {
    position: 'absolute',
    right: '50%',
    width: 72,
    height: 2,
    top: '50%',
    transform: 'translateY(-50%)',
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    flexShrink: 0,
  },
  nodeLabel: {
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 1.3,
    maxWidth: 72,
  },
  nodeDates: {
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 1.4,
  },
  progressWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    background: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #1677ff, #52c41a)',
    borderRadius: 4,
    transition: 'width 0.3s',
  },
  progressText: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1677ff',
    minWidth: 40,
    textAlign: 'right',
  },
}
