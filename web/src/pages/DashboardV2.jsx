import React, { useState, useEffect } from 'react'
import { Spin } from 'antd'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { getStats } from '../api'

const COLORS = ['#2563eb', '#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899']

const chartConfig = {
  count: { label: '项目数', color: '#2563eb' },
  value: { label: '金额(万)', color: '#7c3aed' },
  budget: { label: '预算(万)', color: '#06b6d4' },
}

function StatCard({ title, value, icon }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          {icon && <div className="text-muted-foreground/50 text-3xl">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardV2() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const fetchData = () => {
    setLoading(true)
    setError(false)
    getStats()
      .then(res => setStats(res.data?.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  if (loading && !stats) return <div className="flex justify-center items-center min-h-[400px]"><Spin size="large" /></div>
  if (error && !stats) return (
    <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
      <p className="text-muted-foreground">加载数据失败，请检查网络连接后重试</p>
      <button onClick={fetchData} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">重试</button>
    </div>
  )
  if (!stats) return null

  const { basic = {}, buStats = {}, ownerStats = {}, taskTypeStats = {}, procurementStats = {}, budgetRanges = {} } = stats

  // Chart data transformations
  const buBarData = Object.entries(buStats)
    .filter(([, d]) => d.doing > 0)
    .map(([bu, d]) => ({ name: bu, count: d.doing }))
    .sort((a, b) => b.count - a.count)

  const ownerBarData = Object.entries(ownerStats)
    .map(([owner, d]) => ({ name: owner, count: d.doing + d.yearCount }))
    .sort((a, b) => b.count - a.count)

  const buPieData = Object.entries(buStats)
    .filter(([, d]) => d.yearAmount > 0)
    .map(([bu, d]) => ({ name: bu, value: d.yearAmount }))
    .sort((a, b) => b.value - a.value)

  const taskTypePieData = Object.entries(taskTypeStats)
    .map(([type, count]) => ({ name: type, value: count }))
    .sort((a, b) => b.value - a.value)

  const procurementPieData = Object.entries(procurementStats)
    .map(([method, d]) => ({ name: method, value: d.count }))
    .sort((a, b) => b.value - a.value)

  const budgetBarData = Object.entries(budgetRanges)
    .map(([range, count]) => ({ name: range, count }))

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">项目看板</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title={`${new Date().getFullYear()}累计项目`} value={basic.yearTotal} />
        <StatCard title="进行中" value={basic.doing} />
        <StatCard title="已完成" value={basic.completed} />
        <StatCard title="已定标" value={basic.bidDetermined} />
        <StatCard title="100万以上" value={basic.over100w} />
      </div>

      {/* Row 1: Procurement Method + Budget Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {procurementPieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">采购方式分布</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <PieChart>
                  <RechartsTooltip content={<ChartTooltipContent />} />
                  <Pie data={procurementPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {procurementPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
        {budgetBarData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">预算分布</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <BarChart data={budgetBarData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* BU Bar Chart */}
      {buBarData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">各BU执行中项目</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[240px]">
              <BarChart data={buBarData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Owner Bar Chart */}
      {ownerBarData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">各采购员负责的项目数量</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[240px]">
              <BarChart data={ownerBarData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                <RechartsTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Row 3: BU Amount Pie + Task Type Pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {buPieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">年度采购金额</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <PieChart>
                  <RechartsTooltip content={<ChartTooltipContent formatter={(v) => `${v.toLocaleString()}万`} />} />
                  <Pie data={buPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {buPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
        {taskTypePieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">任务类型</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <PieChart>
                  <RechartsTooltip content={<ChartTooltipContent />} />
                  <Pie data={taskTypePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {taskTypePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
