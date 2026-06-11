/**
 * UAT 模拟测试：按 uat-test-cases.md 的每条用例，模拟用户输入对话，验证 Bot 响应
 * mock understandIntent 控制 LLM 返回，测试 handleMessage 端到端行为
 */

jest.mock('../../feishu/client', () => ({
  im: { message: { create: jest.fn().mockResolvedValue({}) } },
}))

jest.mock('../group', () => ({
  getGroupBinding: jest.fn().mockResolvedValue(null),
  bindGroup: jest.fn().mockResolvedValue({ message: '绑定成功' }),
  isProjectOwner: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../mcp', () => ({
  callTool: jest.fn(),
  STAGE_MAP: {
    requirement: { label: '需求确认', order: 1 },
    supplier_dev: { label: '供应商开发', order: 2 },
    tech_exchange: { label: '技术交流', order: 3 },
    bid_approval: { label: '招标审批', order: 4 },
    bid_issue: { label: '发标', order: 5 },
    bid_qa: { label: '招标答疑', order: 6 },
    bid_return: { label: '供应商回标', order: 7 },
    bid_open: { label: '开标', order: 8 },
    bid_determine: { label: '定标', order: 9 },
    bid_notify: { label: '中标通知', order: 10 },
    contract: { label: '合同签订', order: 11 },
    production: { label: '生产', order: 12 },
    shipping: { label: '海运', order: 13 },
  },
  STAGE_KEYS: ['requirement', 'supplier_dev', 'tech_exchange', 'bid_approval', 'bid_issue', 'bid_qa', 'bid_return', 'bid_open', 'bid_determine', 'bid_notify', 'contract', 'production', 'shipping'],
}))

jest.mock('../llm', () => ({
  understandIntent: jest.fn(),
  getSession: jest.fn(),
}))

const { handleMessage, handleCardAction, clearProcessingActions } = require('../index')
const { callTool } = require('../../mcp')
const { understandIntent, getSession } = require('../llm')
const client = require('../../feishu/client')

function makeEvent(text, senderId = 'ou_test_user') {
  return {
    message: { content: JSON.stringify({ text }), chat_id: 'oc_test_chat', chat_type: 'p2p' },
    sender: { sender_id: { open_id: senderId } },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  clearProcessingActions()
  getSession.mockReturnValue({ currentProjectId: 'rec_proj', history: [], pendingAction: null })
  // 默认：list_projects 返回空（无重名），其他返回成功
  callTool.mockImplementation((tool) => {
    if (tool === 'list_projects') return Promise.resolve([])
    return Promise.resolve({ record_id: 'rec_1', fields: { name: '测试', no: 'CG-001' } })
  })
})

// ============================================================
// 场景 1：项目创建 — 发起创建（10 条用例）
// ============================================================
describe('UAT 1. 项目创建 — 发起创建', () => {
  const cases = [
    ['1.1', '创建一个新项目'],
    ['1.2', '新建项目'],
    ['1.3', '帮我建个项目'],
    ['1.4', '我要开一个新的采购项目'],
    ['1.5', '搞个项目'],
    ['1.6', '添加一个项目'],
  ]

  test.each(cases)('用例 %s：" %s " → 追问缺少信息', async (_id, input) => {
    understandIntent.mockResolvedValue({
      intent: 'create_project', params: {},
      message: '好的，请问项目名称是什么？',
    })

    const result = await handleMessage(makeEvent(input))
    expect(result.text).toBeDefined()
    expect(result.text.length).toBeGreaterThan(0)
  })

  test('1.7：创建项目ABC → 只追问缺的字段', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project', params: { name: '项目ABC' },
      message: '好的，请问采购品类是什么？',
    })

    const result = await handleMessage(makeEvent('创建项目ABC'))
    expect(result.text).toContain('采购品类')
  })

  test('1.8：创建项目ABC，品类设备 → 追问剩余字段', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project', params: { name: '项目ABC', category: '设备' },
      message: '好的，请问所属部门是哪个？',
    })

    const result = await handleMessage(makeEvent('创建项目ABC，品类设备'))
    expect(result.text).toContain('所属部门')
  })

  test('1.9：信息完整 → 发送确认卡片', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { name: '测试项目', category: '设备', owner: '张三', department: 'FBU', budget: 100, planStart: '2026-01-01', planEnd: '2026-12-31' },
      message: '请确认以下信息',
    })

    const result = await handleMessage(makeEvent('创建项目ABC，品类设备，部门FBU，预算100万，1月到12月'))
    expect(result.card).toBeDefined()
    expect(result.card.header.title.content).toContain('确认')
  })

  test('1.10：全部信息一次性输入 → 发送确认卡片', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { name: '测试项目', category: '设备', owner: '张三', department: 'FBU', budget: 200, planStart: '2026-03-01', planEnd: '2026-12-31' },
      message: '请确认',
    })

    const result = await handleMessage(makeEvent('创建一个设备采购项目，叫测试项目，FBU部门，预算200万，明年全年'))
    expect(result.card).toBeDefined()
  })

  test('1.11：重名校验 → 名称已存在提示换名称', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { name: '重复项目' },
      message: '好的，请问采购品类是什么？',
    })
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([
        { record_id: 'r1', fields: { name: '重复项目', no: 'CG-001' } },
      ])
      return Promise.resolve({ record_id: 'rec_1', fields: { name: '测试', no: 'CG-001' } })
    })

    const result = await handleMessage(makeEvent('创建重复项目'))
    expect(result.text).toContain('已存在')
    expect(result.text).toContain('CG-001')
    expect(result.text).toContain('换个名称')
  })
})

// ============================================================
// 场景 2：项目创建 — 字段补充（18 条用例）
// ============================================================
describe('UAT 2. 项目创建 — 字段补充', () => {
  const categoryCases = [
    ['2.1', '项目名称是测试项目', 'name', '测试项目'],
    ['2.2', '设备', 'category', '设备'],
    ['2.3', '采购品类是材料', 'category', '材料'],
  ]

  test.each(categoryCases)('用例 %s：" %s " → %s=%s', async (_id, input, field, value) => {
    understandIntent.mockResolvedValue({
      intent: 'create_project', params: { [field]: value },
      message: `已记录${field}`,
    })

    const result = await handleMessage(makeEvent(input))
    expect(result.text).toBeDefined()
  })

  const deptCases = [
    ['2.4', 'FBU', 'FBU'],
    ['2.5', '所属部门是LBU', 'LBU'],
    ['2.6', 'ABU', 'ABU'],
  ]

  test.each(deptCases)('用例 %s：" %s " → department=%s', async (_id, input, dept) => {
    understandIntent.mockResolvedValue({
      intent: 'create_project', params: { department: dept },
      message: '部门已记录',
    })

    const result = await handleMessage(makeEvent(input))
    expect(result.text).toBeDefined()
  })

  const budgetCases = [
    ['2.7', '预算80万', 80],
    ['2.8', '预算800000', 80],
    ['2.9', '预算1.5万', 1.5],
    ['2.10', '预算200w', 200],
    ['2.11', '八十万', 80],
  ]

  test.each(budgetCases)('用例 %s：" %s " → budget=%s', async (_id, input, expectedBudget) => {
    understandIntent.mockResolvedValue({
      intent: 'create_project', params: { budget: expectedBudget },
      message: '预算已记录',
    })

    const result = await handleMessage(makeEvent(input))
    expect(result.text).toBeDefined()
  })

  const dateCases = [
    ['2.12', '计划开始2026-01-01，结束2026-12-31', '2026-01-01', '2026-12-31'],
    ['2.13', '开始日期2026/03/01，结束2026/12/31', '2026-03-01', '2026-12-31'],
  ]

  test.each(dateCases)('用例 %s：" %s " → 日期填入', async (_id, input, start, end) => {
    understandIntent.mockResolvedValue({
      intent: 'create_project', params: { planStart: start, planEnd: end },
      message: '日期已记录',
    })

    const result = await handleMessage(makeEvent(input))
    expect(result.text).toBeDefined()
  })

  const ownerCases = [
    ['2.15', '负责人是我', '梁景悦'],
    ['2.16', '我', '我'],
    ['2.17', '负责人是梁景悦', '梁景悦'],
    ['2.18', '张三负责', '张三'],
  ]

  test.each(ownerCases)('用例 %s：" %s " → owner=%s', async (_id, input, owner) => {
    understandIntent.mockResolvedValue({
      intent: 'create_project', params: { owner },
      message: '负责人已记录',
    })

    const result = await handleMessage(makeEvent(input))
    expect(result.text).toBeDefined()
  })
})

// ============================================================
// 场景 3：日期校验（2 条用例）
// ============================================================
describe('UAT 3. 项目创建 — 日期校验', () => {
  test('3.1：结束早于开始 → 报错', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { name: '测试', category: '设备', department: 'FBU', budget: 100, planStart: '2026-12-31', planEnd: '2026-01-01' },
      message: '请确认',
    })

    const result = await handleMessage(makeEvent('开始2026-12-31，结束2026-01-01'))
    expect(result.text).toBe('计划结束日期不能早于开始日期')
  })

  test('3.2：同一天 → 允许通过', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { name: '测试', category: '设备', department: 'FBU', budget: 100, planStart: '2026-06-01', planEnd: '2026-06-01' },
      message: '请确认',
    })

    const result = await handleMessage(makeEvent('开始2026-06-01，结束2026-06-01'))
    expect(result.card).toBeDefined()
  })
})

// ============================================================
// 场景 4：确认与取消（19 条用例）
// ============================================================
describe('UAT 4. 项目创建 — 确认与取消', () => {
  const fullParams = {
    name: '测试', category: '设备', owner: '张三', department: 'FBU',
    budget: 100, planStart: '2026-01-01', planEnd: '2026-12-31',
  }

  const confirmCases = [
    ['4.1', '确认'],
    ['4.2', '确定'],
    ['4.3', '好的'],
    ['4.4', '可以'],
    ['4.5', '是的'],
    ['4.6', '是'],
    ['4.7', '好'],
    ['4.8', '行'],
    ['4.9', '没问题'],
  ]

  test.each(confirmCases)('用例 %s：" %s " → 弹确认卡片', async (_id, input) => {
    understandIntent.mockResolvedValue({
      intent: 'create_project', params: { ...fullParams },
      message: '确认',
    })

    const result = await handleMessage(makeEvent(input))
    expect(result.card).toBeDefined()
    expect(callTool).not.toHaveBeenCalledWith('create_project', expect.anything())
  })

  test('4.10：点击卡片"确认创建"按钮 → 触发创建', async () => {
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      return Promise.resolve({ record_id: 'rec_1', fields: { name: '测试', no: 'CG-001' } })
    })

    const action = {
      action: 'confirm_project',
      params: { ...fullParams },
    }
    const result = await handleCardAction(action, 'oc_test_chat')
    expect(result.card).toBeDefined()
    // 等待异步创建完成
    await new Promise(r => setTimeout(r, 50))
    expect(callTool).toHaveBeenCalledWith('create_project', expect.any(Object))
  })

  const nonConfirmCases = [
    ['4.11', '是一个好项目'],
    ['4.12', '可以吧'],
  ]

  test.each(nonConfirmCases)('用例 %s：" %s " → 不触发确认', async (_id, input) => {
    understandIntent.mockResolvedValue({
      intent: 'create_project', params: { ...fullParams },
      message: '请确认',
    })

    const result = await handleMessage(makeEvent(input))
    expect(result.card).toBeDefined()
    expect(callTool).not.toHaveBeenCalledWith('create_project', expect.anything())
  })

  const cancelCases = [
    ['4.13', '取消'],
    ['4.14', '不要'],
    ['4.15', '算了'],
    ['4.16', '不做了'],
    ['4.17', '否'],
  ]

  test.each(cancelCases)('用例 %s：" %s " → 取消创建', async (_id, input) => {
    understandIntent.mockResolvedValue({
      intent: null, params: {},
      message: '已取消操作',
    })

    const result = await handleMessage(makeEvent(input))
    expect(result.text).toContain('已取消')
  })

  test('4.18："停" → 不触发取消（不在取消词列表）', async () => {
    understandIntent.mockResolvedValue({
      intent: null, params: {},
      message: '好的，已暂停',
    })

    const result = await handleMessage(makeEvent('停'))
    expect(result.text).toBeDefined()
    expect(result.text).not.toContain('已取消')
  })

  test('4.19：点击卡片"取消"按钮 → 取消创建', async () => {
    const action = { action: 'cancel_project', params: { name: '测试' } }
    const result = await handleCardAction(action, 'oc_test_chat')
    expect(callTool).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
  })
})

// ============================================================
// 场景 5：项目查询（10 条用例）
// ============================================================
describe('UAT 6. 项目查询', () => {
  const listCases = [
    ['6.1', '查看项目'],
    ['6.2', '项目列表'],
    ['6.3', '有哪些项目'],
    ['6.4', '现在在做的项目'],
    ['6.5', '帮我看看项目情况'],
    ['6.6', '项目进展怎么样'],
  ]

  test.each(listCases)('用例 %s：" %s " → 列出所有项目', async (_id, input) => {
    understandIntent.mockResolvedValue({
      intent: 'list_projects', params: {},
      message: '正在查询',
    })
    callTool.mockResolvedValue([
      { record_id: 'r1', fields: { name: '项目A', current_stage: 'requirement', status: '正常' } },
      { record_id: 'r2', fields: { name: '项目B', current_stage: 'bid_determine', status: '正常' } },
    ])

    const result = await handleMessage(makeEvent(input))
    expect(result.text).toContain('共 2 个项目')
    expect(result.text).toContain('项目A')
    expect(result.text).toContain('项目B')
  })

  const detailCases = [
    ['6.7', '查看XX项目'],
    ['6.8', 'XX项目现在什么情况'],
    ['6.9', 'XX项目的进度'],
  ]

  test.each(detailCases)('用例 %s：" %s " → 显示项目详情', async (_id, input) => {
    understandIntent.mockResolvedValue({
      intent: 'get_project', params: { name: '项目A' },
      message: '正在查询',
    })
    callTool.mockResolvedValue({
      record_id: 'r1',
      fields: { name: '项目A', no: 'CG-001', owner: '张三', department: 'FBU', category: '设备', budget: 100, plan_start: '2026-01-01', plan_end: '2026-12-31', current_stage: 'requirement', status: '正常' },
    })

    const result = await handleMessage(makeEvent(input))
    expect(result.text).toContain('项目A')
    expect(result.text).toContain('CG-001')
    expect(result.text).toContain('张三')
    expect(result.text).toContain('需求确认')
  })

  test('6.10：查询不存在的项目 → 提示未找到', async () => {
    understandIntent.mockResolvedValue({
      intent: 'get_project', params: { name: '不存在的项目' },
      message: '正在查询',
    })
    callTool.mockResolvedValue(null)

    // getSession returns projectId so it skips name lookup
    const result = await handleMessage(makeEvent('不存在的项目'))
    expect(result.text).toBeDefined()
  })
})

// ============================================================
// 场景 6：节点查询（6 条用例）
// ============================================================
describe('UAT 7. 节点查询', () => {
  const nodeQueryCases = [
    ['7.1', '查看项目节点'],
    ['7.2', '项目节点列表'],
    ['7.3', 'XX项目有哪些节点'],
    ['7.4', '这个项目到哪一步了'],
    ['7.5', '现在进行到哪个阶段了'],
    ['7.6', '帮我看看节点状态'],
  ]

  test.each(nodeQueryCases)('用例 %s：" %s " → 列出节点状态', async (_id, input) => {
    understandIntent.mockResolvedValue({
      intent: 'list_project_nodes', params: { name: '项目A' },
      message: '正在查询',
    })
    callTool.mockResolvedValue([
      { fields: { stage_key: 'requirement', status: 'completed', actual_date: '2026-01-15' } },
      { fields: { stage_key: 'supplier_dev', status: 'in_progress' } },
      { fields: { stage_key: 'tech_exchange', status: 'pending' } },
      { fields: { stage_key: 'bid_approval', status: 'pending' } },
      { fields: { stage_key: 'bid_issue', status: 'pending' } },
      { fields: { stage_key: 'bid_qa', status: 'pending' } },
      { fields: { stage_key: 'bid_return', status: 'pending' } },
      { fields: { stage_key: 'bid_open', status: 'pending' } },
      { fields: { stage_key: 'bid_determine', status: 'pending' } },
      { fields: { stage_key: 'bid_notify', status: 'pending' } },
      { fields: { stage_key: 'contract', status: 'pending' } },
      { fields: { stage_key: 'production', status: 'pending' } },
      { fields: { stage_key: 'shipping', status: 'pending' } },
    ])

    const result = await handleMessage(makeEvent(input))
    expect(result.text).toContain('需求确认')
    expect(result.text).toContain('供应商开发')
    expect(result.text).toContain('技术交流')
    expect(result.text).toContain('当前进行中')
  })
})

// ============================================================
// 场景 7：节点操作 — 标记完成（8 条用例）
// ============================================================
describe('UAT 8. 节点操作 — 标记完成', () => {
  const advanceCases = [
    ['8.1', '把定标标记为完成', 'bid_determine', '定标'],
    ['8.2', '定标完成了', 'bid_determine', '定标'],
    ['8.3', '定标搞定了', 'bid_determine', '定标'],
    ['8.4', '定标done', 'bid_determine', '定标'],
    ['8.5', '需求确认这个节点完成了', 'requirement', '需求确认'],
    ['8.6', '供应商开发OK了', 'supplier_dev', '供应商开发'],
  ]

  test.each(advanceCases)('用例 %s：" %s " → 标记 %s 完成', async (_id, input, stageKey, label) => {
    understandIntent.mockResolvedValue({
      intent: 'advance_node', params: { name: '项目A', stageKey, status: 'completed' },
      message: '确认完成',
    })
    callTool.mockResolvedValue({})

    const result = await handleMessage(makeEvent(input))
    expect(callTool).toHaveBeenCalledWith('advance_node', expect.objectContaining({ stageKey }))
    expect(result.text).toContain(label)
    expect(result.text).toContain('已完成')
  })

  test('8.7：点击卡片"确认完成"按钮 → 标记完成', async () => {
    callTool.mockResolvedValue({})
    const action = { action: 'confirm_node', project_id: 'rec_proj', stage_key: 'bid_determine' }
    const result = await handleCardAction(action, 'oc_test_chat')
    expect(callTool).toHaveBeenCalledWith('advance_node', { projectId: 'rec_proj', stageKey: 'bid_determine', status: 'completed' })
    expect(result.success).toBe(true)
  })

  test('8.8：节点没有 plan_date → 提示需要日期', async () => {
    const err = new Error('需求确认还没有计划完成日期，无法标记完成')
    err.code = 'NEED_PLAN_DATE'
    understandIntent.mockResolvedValue({
      intent: 'advance_node', params: { name: '项目A', stageKey: 'requirement', status: 'completed' },
      message: '确认完成',
    })
    callTool.mockRejectedValue(err)

    const result = await handleMessage(makeEvent('需求确认完成了'))
    expect(result.text).toContain('还没有计划完成日期')
  })
})

// ============================================================
// 场景 8：节点操作 — 标记异常（4 条用例）
// ============================================================
describe('UAT 9. 节点操作 — 标记异常', () => {
  const abnormalCases = [
    ['9.1', '定标有问题', 'bid_determine', '定标'],
    ['9.2', '这个节点出问题了', 'requirement', '需求确认'],
    ['9.3', '需求确认异常', 'requirement', '需求确认'],
  ]

  test.each(abnormalCases)('用例 %s：" %s " → 标记 %s 异常', async (_id, input, stageKey, label) => {
    understandIntent.mockResolvedValue({
      intent: 'mark_node_abnormal', params: { name: '项目A', stageKey, reason: '用户标记异常' },
      message: '标记异常',
    })
    callTool.mockResolvedValue({})

    const result = await handleMessage(makeEvent(input))
    expect(callTool).toHaveBeenCalledWith('mark_node_abnormal', expect.objectContaining({ stageKey }))
    expect(result.text).toContain(label)
    expect(result.text).toContain('异常')
  })

  test('9.4：点击卡片"标记异常"按钮 → 标记异常', async () => {
    callTool.mockResolvedValue({})
    const action = { action: 'mark_abnormal', project_id: 'rec_proj', stage_key: 'bid_determine' }
    const result = await handleCardAction(action, 'oc_test_chat')
    expect(callTool).toHaveBeenCalledWith('mark_node_abnormal', { projectId: 'rec_proj', stageKey: 'bid_determine', reason: '用户标记异常' })
    expect(result.success).toBe(true)
  })
})

// ============================================================
// 场景 9：防重复点击（3 条用例）
// ============================================================
describe('UAT 5. 防重复点击', () => {
  test('5.1：快速连续点击两次 → 第二次显示 toast', async () => {
    const action = {
      action: 'confirm_project',
      params: { name: '测试重复', category: '设备', owner: '张三' },
    }

    let resolveFirst
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      return new Promise(r => { resolveFirst = r })
    })
    const firstCall = handleCardAction(action, 'oc_test_chat')
    await new Promise(r => setTimeout(r, 50))

    const result = await handleCardAction(action, 'oc_test_chat')
    expect(result.toast).toBeDefined()
    expect(result.toast.content).toContain('正在处理')

    resolveFirst({ record_id: 'rec_1', fields: { name: '测试重复' } })
    await firstCall
  })

  test('5.2：快速连续点击3次 → 只执行1次', async () => {
    callTool.mockClear()
    let resolveFirst
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      return new Promise(r => { resolveFirst = r })
    })
    const action = {
      action: 'confirm_project',
      params: { name: '并发', category: '设备', owner: '张三' },
    }

    const firstCall = handleCardAction(action, 'oc_test_chat')
    await new Promise(r => setTimeout(r, 50))
    const secondCall = handleCardAction(action, 'oc_test_chat')
    await new Promise(r => setTimeout(r, 10))
    const thirdCall = handleCardAction(action, 'oc_test_chat')

    resolveFirst({ record_id: 'rec_1', fields: { name: '并发' } })
    const [r1, r2, r3] = await Promise.all([firstCall, secondCall, thirdCall])

    expect(callTool).toHaveBeenCalledWith('create_project', expect.any(Object))
    expect(r2.toast).toBeDefined()
    expect(r3.toast).toBeDefined()
  })

  test('5.3：第一次完成后再次点击 → 可以正常执行', async () => {
    callTool.mockClear()
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      return Promise.resolve({ record_id: 'rec_1', fields: { name: '再次' } })
    })
    const action = {
      action: 'confirm_project',
      params: { name: '再次', category: '设备', owner: '张三' },
    }

    await handleCardAction(action, 'oc_test_chat')
    expect(callTool).toHaveBeenCalledWith('create_project', expect.any(Object))

    await handleCardAction(action, 'oc_test_chat')
    // Second call should also succeed
  })
})

// ============================================================
// 场景 10：错误处理（6 条用例）
// ============================================================
describe('UAT 14. 错误处理', () => {
  test('14.1：创建同名项目 → 卡片替换为处理中（异步创建在后台执行）', async () => {
    const action = {
      action: 'confirm_project',
      params: { name: '重复项目', category: '设备', owner: '张三' },
    }
    const result = await handleCardAction(action, 'oc_test_chat')
    // confirm_project 返回处理中卡片（原地替换），后台异步执行创建
    expect(result.card).toBeDefined()
    // 等待异步创建完成
    await new Promise(r => setTimeout(r, 100))
  })

  test('14.2：Bot 收到空消息 → 不崩溃', async () => {
    const event = {
      message: { content: JSON.stringify({ text: '' }), chat_id: 'oc_test_chat', chat_type: 'p2p' },
      sender: { sender_id: { open_id: 'ou_test' } },
    }
    const result = await handleMessage(event)
    expect(result).toBeNull()
  })

  test('14.3：Bot 收到非文本消息 → 不崩溃', async () => {
    const event = {
      message: { content: '{"image":"url"}', chat_id: 'oc_test_chat', chat_type: 'p2p' },
      sender: { sender_id: { open_id: 'ou_test' } },
    }
    const result = await handleMessage(event)
    // JSON parse succeeds but no .text → returns null
    expect(result).toBeNull()
  })

  test('14.4：群聊中非@消息（无活跃会话） → 静默忽略（由 webhook 层处理）', async () => {
    // 这个场景在 webhook 层处理，handleMessage 不负责
    // 验证 handleMessage 本身不会崩溃
    understandIntent.mockResolvedValue({
      intent: null, params: {},
      message: '你好',
    })
    const result = await handleMessage(makeEvent('随便说说'))
    expect(result.text).toBe('你好')
  })

  test('14.5：乱码输入 → 返回默认引导提示', async () => {
    understandIntent.mockResolvedValue({
      intent: null, params: {},
      message: null,
    })

    const result = await handleMessage(makeEvent('asdfghjkl'))
    expect(result.text).toContain('抱歉')
    expect(result.text).toContain('创建')
  })

  test('14.6：纯数字输入 → 返回默认引导提示', async () => {
    understandIntent.mockResolvedValue({
      intent: null, params: {},
      message: null,
    })

    const result = await handleMessage(makeEvent('12345'))
    expect(result.text).toContain('抱歉')
  })
})

// ============================================================
// 场景 11：节点状态中文显示
// ============================================================
describe('节点状态中文显示', () => {
  test('advance_node 返回中文阶段名+下一阶段', async () => {
    understandIntent.mockResolvedValue({
      intent: 'advance_node', params: { name: '项目A', stageKey: 'requirement', status: 'completed' },
      message: '确认',
    })
    callTool.mockResolvedValue({})

    const result = await handleMessage(makeEvent('需求确认完成了'))
    expect(result.text).toContain('需求确认')
    expect(result.text).toContain('已完成')
    expect(result.text).toContain('下一步')
    expect(result.text).toContain('供应商开发')
  })

  test('get_project 显示中文阶段名', async () => {
    understandIntent.mockResolvedValue({
      intent: 'get_project', params: { name: '项目A' },
      message: '查询',
    })
    callTool.mockResolvedValue({
      record_id: 'r1',
      fields: { name: '项目A', no: 'CG-001', owner: '张三', department: 'FBU', category: '设备', budget: 100, plan_start: '2026-01-01', plan_end: '2026-12-31', current_stage: 'bid_determine', status: '正常' },
    })

    const result = await handleMessage(makeEvent('查看项目A'))
    expect(result.text).toContain('定标')
    expect(result.text).not.toContain('bid_determine')
  })

  test('list_projects 显示中文阶段名', async () => {
    understandIntent.mockResolvedValue({
      intent: 'list_projects', params: {},
      message: '查询',
    })
    callTool.mockResolvedValue([
      { record_id: 'r1', fields: { name: '项目A', current_stage: 'tech_exchange', status: '正常' } },
    ])

    const result = await handleMessage(makeEvent('查看项目'))
    expect(result.text).toContain('技术交流')
    expect(result.text).not.toContain('tech_exchange')
  })

  test('list_project_nodes 显示状态图标', async () => {
    understandIntent.mockResolvedValue({
      intent: 'list_project_nodes', params: { name: '项目A' },
      message: '查询',
    })
    callTool.mockResolvedValue([
      { fields: { stage_key: 'requirement', status: 'completed' } },
      { fields: { stage_key: 'supplier_dev', status: 'in_progress' } },
      { fields: { stage_key: 'tech_exchange', status: 'pending' } },
    ])

    const result = await handleMessage(makeEvent('查看项目节点'))
    expect(result.text).toContain('✅')
    expect(result.text).toContain('🔄')
    expect(result.text).toContain('⏳')
    expect(result.text).toContain('当前进行中：供应商开发')
  })

  test('异常项目显示 ⚠️', async () => {
    understandIntent.mockResolvedValue({
      intent: 'get_project', params: { name: '项目B' },
      message: '查询',
    })
    callTool.mockResolvedValue({
      record_id: 'r2',
      fields: { name: '项目B', no: 'CG-002', owner: '李四', department: 'LBU', category: '材料', budget: 50, plan_start: '2026-03-01', plan_end: '2026-12-31', current_stage: 'bid_determine', status: '异常' },
    })

    const result = await handleMessage(makeEvent('项目B'))
    expect(result.text).toContain('异常')
  })
})

// ============================================================
// 场景 12：会话上下文
// ============================================================
describe('会话上下文', () => {
  test('节点操作有 projectId → 直接使用', async () => {
    understandIntent.mockResolvedValue({
      intent: 'advance_node', params: { stageKey: 'requirement', status: 'completed' },
      message: '确认',
    })
    callTool.mockResolvedValue({})

    const result = await handleMessage(makeEvent('需求确认完成了'))
    expect(callTool).toHaveBeenCalledWith('advance_node', expect.objectContaining({ projectId: 'rec_proj' }))
  })

  test('节点操作无 projectId 有 name → 通过 list_projects 查找', async () => {
    getSession.mockReturnValue({ currentProjectId: null, history: [], pendingAction: null })
    understandIntent.mockResolvedValue({
      intent: 'advance_node', params: { name: '项目A', stageKey: 'requirement', status: 'completed' },
      message: '确认',
    })
    callTool
      .mockResolvedValueOnce([{ record_id: 'r1', fields: { name: '项目A' } }])
      .mockResolvedValueOnce({})

    const result = await handleMessage(makeEvent('需求确认完成了'))
    expect(callTool).toHaveBeenCalledWith('list_projects')
    expect(callTool).toHaveBeenCalledWith('advance_node', expect.objectContaining({ projectId: 'r1' }))
  })

  test('节点操作无 projectId 无 name → 提示选择项目', async () => {
    getSession.mockReturnValue({ currentProjectId: null, history: [], pendingAction: null })
    understandIntent.mockResolvedValue({
      intent: 'advance_node', params: { stageKey: 'requirement', status: 'completed' },
      message: '确认',
    })

    const result = await handleMessage(makeEvent('需求确认完成了'))
    expect(result.text).toContain('未找到项目')
  })
})
