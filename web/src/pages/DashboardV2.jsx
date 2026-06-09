import React, { useState, useEffect } from 'react'
import { Row, Col, Card, Spin } from 'antd'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { getStats } from '../api'

const BLUE = '#4472C4'
const COLORS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478']

const StatCard = ({ title, value, color }) => (
  <Card style={{ borderRadius: 8 }}>
    <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 8 }}>{title}</div>
    <div style={{ fontSize: 36, fontWeight: 700, color: color || '#1f1f1f', lineHeight: 1 }}>{value}</div>
  </Card>
)

const CustomBarLabel = ({ x, y, width, value }) => {
  if (!value) return null
  return (
    <text x={x + width / 2} y={y - 6} fill="#333" textAnchor="middle" fontSize={12} fontWeight={600}>
      {value}
    </text>
  )
}

export default function DashboardV2() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getStats()
      .then(res => setStats(res.data?.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading && !stats) return <div style={{ textAlign: 'center', paddingTop: 100 }}><Spin size="large" /></div>
  if (!stats) return null

  const { basic, buStats, ownerStats, taskTypeStats } = stats

  // BU bar chart data (doing > 0 only)
  const buBarData = Object.entries(buStats)
    .filter(([, d]) => d.doing > 0)
    .map(([bu, d]) => ({ name: bu, count: d.doing }))
    .sort((a, b) => b.count - a.count)

  // Owner bar chart data
  const ownerBarData = Object.entries(ownerStats)
    .map(([owner, d]) => ({ name: owner, count: d.doing + d.yearCount }))
    .sort((a, b) => b.count - a.count)

  // BU pie chart data (year amount)
  const buPieData = Object.entries(buStats)
    .filter(([, d]) => d.yearAmount > 0)
    .map(([bu, d]) => ({ name: bu, value: d.yearAmount }))
    .sort((a, b) => b.value - a.value)

  // Task type pie chart data
  const taskTypePieData = Object.entries(taskTypeStats || {})
    .map(([type, count]) => ({ name: type, value: count }))
    .sort((a, b) => b.value - a.value)

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>项目看板</h1>
      </div>

      {/* Stat Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <StatCard title={`${new Date().getFullYear()}累计项目数量`} value={basic.yearTotal} color="#1f1f1f" />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard title="进行中项目数量" value={basic.doing} color="#1f1f1f" />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard title="已定标项目数量" value={basic.bidDetermined} color="#1f1f1f" />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard title="100万元以上项目数量" value={basic.over100w} color="#1f1f1f" />
        </Col>
      </Row>

      {/* BU Bar Chart */}
      {buBarData.length > 0 && (
        <Card style={{ marginBottom: 16, borderRadius: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>各BU执行中项目</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={buBarData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill={BLUE} radius={[4, 4, 0, 0]} label={<CustomBarLabel />} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Owner Bar Chart */}
      {ownerBarData.length > 0 && (
        <Card style={{ marginBottom: 16, borderRadius: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>各采购员负责的项目数量</div>
          <ResponsiveContainer width="100%" height={Math.max(240, ownerBarData.length * 36)}>
            <BarChart data={ownerBarData} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill={BLUE} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 12, fontWeight: 600 }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* BU Budget Pie Chart + Task Type Pie Chart */}
      <Row gutter={16}>
        {buPieData.length > 0 && (
          <Col xs={24} md={14}>
            <Card style={{ borderRadius: 8, height: '100%' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>年度采购金额</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 16 }}>
                <ResponsiveContainer width={240} height={240}>
                  <PieChart>
                    <Pie
                      data={buPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                      labelLine
                    >
                      {buPieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `${v.toLocaleString()}万`} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {buPieData.map((d, i) => (
                    <div key={d.name} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                      {d.name}: {d.value.toLocaleString()}万 ({buPieData.length > 0 ? ((d.value / buPieData.reduce((s, x) => s + x.value, 0)) * 100).toFixed(1) : 0}%)
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Col>
        )}
        {taskTypePieData.length > 0 && (
          <Col xs={24} md={10}>
            <Card style={{ borderRadius: 8, height: '100%' }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>任务类型</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 16 }}>
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={taskTypePieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                      labelLine
                    >
                      {taskTypePieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {taskTypePieData.map((d, i) => (
                    <div key={d.name} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                      {d.name}: {d.value}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  )
}
