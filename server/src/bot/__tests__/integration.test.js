/**
 * 集成测试：mock understandIntent，测试 handleMessage 端到端行为
 */

// Mock 外部依赖
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

const { handleMessage, handleCardAction, normalizeBudget, validateDates, clearProcessingActions } = require('../index')
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
  // 默认返回带 projectId 的 session，避免 name lookup
  getSession.mockReturnValue({ currentProjectId: 'rec_proj', history: [], pendingAction: null })
  // 默认 callTool：list_projects 返回空（无重名），其他返回成功
  callTool.mockImplementation((tool) => {
    if (tool === 'list_projects') return Promise.resolve([])
    return Promise.resolve({ record_id: 'rec_1', fields: { name: '测试', no: 'CG-001' } })
  })
})

// ============================================================
// 1. 项目创建 — 发起创建
// ============================================================
describe('项目创建 — 发起创建', () => {
  test('标准用语："创建一个新项目" → 追问缺少信息', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: {},
      message: '好的，请问项目名称是什么？',
    })

    const result = await handleMessage(makeEvent('创建一个新项目'))
    expect(result.text).toBeDefined()
    expect(result.text).toContain('项目名称')
  })

  test('口语："帮我建个项目" → 追问缺少信息', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: {},
      message: '好的，请问项目名称是什么？',
    })

    const result = await handleMessage(makeEvent('帮我建个项目'))
    expect(result.text).toBeDefined()
  })

  test('口语："搞个项目" → 追问缺少信息', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: {},
      message: '好的，请问项目名称是什么？',
    })

    const result = await handleMessage(makeEvent('搞个项目'))
    expect(result.text).toBeDefined()
  })

  test('口语："我要开一个新的采购项目" → 追问缺少信息', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: {},
      message: '好的，请问项目名称是什么？',
    })

    const result = await handleMessage(makeEvent('我要开一个新的采购项目'))
    expect(result.text).toBeDefined()
  })

  test('口语："添加一个项目" → 追问缺少信息', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: {},
      message: '好的，请问项目名称是什么？',
    })

    const result = await handleMessage(makeEvent('添加一个项目'))
    expect(result.text).toBeDefined()
  })

  test('部分信息："创建项目ABC" → 只追问缺的字段', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { name: '项目ABC' },
      message: '好的，请问采购品类是什么？',
    })
    callTool.mockResolvedValue([]) // list_projects 返回空 = 无重名

    const result = await handleMessage(makeEvent('创建项目ABC'))
    expect(result.text).toContain('采购品类')
  })

  test('重名校验：名称已存在 → 提示换名称', async () => {
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

  test('更多信息："创建项目ABC，品类设备" → 追问剩余字段', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { name: '项目ABC', category: '设备' },
      message: '好的，请问所属部门是哪个？',
    })
    callTool.mockResolvedValue([]) // 无重名

    const result = await handleMessage(makeEvent('创建项目ABC，品类设备'))
    expect(result.text).toContain('所属部门')
  })

  test('信息完整 → 发送确认卡片', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { name: '测试项目', category: '设备', owner: '张三', department: 'FBU', budget: 100, planStart: '2026-01-01', planEnd: '2026-12-31' },
      message: '请确认以下信息',
    })

    const result = await handleMessage(makeEvent('创建项目ABC，品类设备，部门FBU，预算100万，1月到12月'))
    expect(result.card).toBeDefined()
    expect(result.card.header.title.content).toContain('确认')
  })

  test('全部信息一次性输入 → 发送确认卡片', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { name: '测试项目', category: '设备', owner: '张三', department: 'FBU', budget: 200, planStart: '2026-03-01', planEnd: '2026-12-31' },
      message: '请确认',
    })

    const result = await handleMessage(makeEvent('创建一个设备采购项目，叫测试项目，FBU部门，预算200万，明年全年'))
    expect(result.card).toBeDefined()
  })
})

// ============================================================
// 2. 项目创建 — 字段补充
// ============================================================
describe('项目创建 — 字段补充', () => {
  test('补充品类："设备" → category=设备', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { category: '设备' },
      message: '品类已记录，请问所属部门是哪个？',
    })

    const result = await handleMessage(makeEvent('设备'))
    expect(result.text).toContain('品类已记录')
    expect(result.text).toContain('所属部门')
  })

  test('补充品类："采购品类是材料" → category=材料', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { category: '材料' },
      message: '好的，品类是材料。请问所属部门？',
    })

    const result = await handleMessage(makeEvent('采购品类是材料'))
    expect(result.text).toContain('材料')
  })

  test('补充部门："FBU" → department=FBU', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { department: 'FBU' },
      message: '部门已记录，请问预算是多少？',
    })

    const result = await handleMessage(makeEvent('FBU'))
    expect(result.text).toContain('预算')
  })

  test('补充部门："所属部门是LBU" → department=LBU', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { department: 'LBU' },
      message: '好的，部门是LBU。请问预算是多少？',
    })

    const result = await handleMessage(makeEvent('所属部门是LBU'))
    expect(result.text).toContain('预算')
  })

  test('补充预算："预算80万" → budget=80', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { budget: '80万' },
      message: '预算80万已记录，请问计划开始日期？',
    })

    const result = await handleMessage(makeEvent('预算80万'))
    expect(result.text).toContain('计划开始日期')
  })

  test('补充预算："预算800000" → budget=80（元→万元转换）', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { budget: 800000 },
      message: '预算已记录',
    })

    const result = await handleMessage(makeEvent('预算800000'))
    expect(result.text).toBeDefined()
  })

  test('补充预算："1.5万" → budget=1.5', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { budget: '1.5万' },
      message: '预算1.5万已记录',
    })

    const result = await handleMessage(makeEvent('1.5万'))
    expect(result.text).toContain('1.5万')
  })

  test('补充预算："200w" → budget=200', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { budget: '200w' },
      message: '预算200万已记录',
    })

    const result = await handleMessage(makeEvent('200w'))
    expect(result.text).toContain('200万')
  })

  test('补充日期："开始2026-01-01，结束2026-12-31" → 日期填入', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { planStart: '2026-01-01', planEnd: '2026-12-31' },
      message: '日期已记录，请问负责人是谁？',
    })

    const result = await handleMessage(makeEvent('开始2026-01-01，结束2026-12-31'))
    expect(result.text).toContain('负责人')
  })

  test('补充日期斜杠格式："开始日期2026/03/01" → 日期填入', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { planStart: '2026-03-01' },
      message: '开始日期已记录',
    })

    const result = await handleMessage(makeEvent('开始日期2026/03/01'))
    expect(result.text).toBeDefined()
  })

  test('补充负责人："负责人是我" → owner=当前用户', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { owner: '梁景悦' },
      message: '信息已完整，请确认',
    })

    const result = await handleMessage(makeEvent('负责人是我'))
    expect(result.text).toContain('确认')
  })

  test('短文本"我" → owner=当前用户（创建流程中）', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { owner: '我' },
      message: '好的，请确认以下信息',
    })

    const result = await handleMessage(makeEvent('我'))
    expect(result.text).toBeDefined()
  })

  test('补充负责人："负责人是梁景悦" → owner=梁景悦', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { owner: '梁景悦' },
      message: '负责人已记录',
    })

    const result = await handleMessage(makeEvent('负责人是梁景悦'))
    expect(result.text).toBeDefined()
  })

  test('补充负责人："张三负责" → owner=张三', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { owner: '张三' },
      message: '负责人已记录',
    })

    const result = await handleMessage(makeEvent('张三负责'))
    expect(result.text).toBeDefined()
  })
})

// ============================================================
// 3. 项目创建 — 日期校验
// ============================================================
describe('项目创建 — 日期校验', () => {
  test('结束早于开始 → 报错', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_project',
      params: { name: '测试', category: '设备', department: 'FBU', budget: 100, planStart: '2026-12-31', planEnd: '2026-01-01' },
      message: '请确认',
    })

    const result = await handleMessage(makeEvent('开始2026-12-31，结束2026-01-01'))
    expect(result.text).toBe('计划结束日期不能早于开始日期')
  })

  test('同一天 → 允许通过', async () => {
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
// 4. 项目创建 — 确认与取消
// ============================================================
describe('项目创建 — 确认与取消', () => {
  const fullParams = { name: '测试', category: '设备', owner: '张三', department: 'FBU', budget: 100, planStart: '2026-01-01', planEnd: '2026-12-31' }

  test('"确认" → 弹确认卡片', async () => {
    understandIntent.mockResolvedValue({ intent: 'create_project', params: { ...fullParams }, message: '确认创建' })
    const result = await handleMessage(makeEvent('确认'))
    expect(result.card).toBeDefined()
    expect(callTool).not.toHaveBeenCalled()
  })

  test('"确定" → 弹确认卡片', async () => {
    understandIntent.mockResolvedValue({ intent: 'create_project', params: { ...fullParams }, message: '确认' })
    const result = await handleMessage(makeEvent('确定'))
    expect(result.card).toBeDefined()
    expect(callTool).not.toHaveBeenCalled()
  })

  test('"好的" → 弹确认卡片', async () => {
    understandIntent.mockResolvedValue({ intent: 'create_project', params: { ...fullParams }, message: '确认' })
    const result = await handleMessage(makeEvent('好的'))
    expect(result.card).toBeDefined()
    expect(callTool).not.toHaveBeenCalled()
  })

  test('"可以" → 弹确认卡片', async () => {
    understandIntent.mockResolvedValue({ intent: 'create_project', params: { ...fullParams }, message: '确认' })
    const result = await handleMessage(makeEvent('可以'))
    expect(result.card).toBeDefined()
  })

  test('"是的" → 弹确认卡片', async () => {
    understandIntent.mockResolvedValue({ intent: 'create_project', params: { ...fullParams }, message: '确认' })
    const result = await handleMessage(makeEvent('是的'))
    expect(result.card).toBeDefined()
  })

  test('"是" → 弹确认卡片（≤2字符）', async () => {
    understandIntent.mockResolvedValue({ intent: 'create_project', params: { ...fullParams }, message: '确认' })
    const result = await handleMessage(makeEvent('是'))
    expect(result.card).toBeDefined()
  })

  test('"好" → 弹确认卡片（≤2字符）', async () => {
    understandIntent.mockResolvedValue({ intent: 'create_project', params: { ...fullParams }, message: '确认' })
    const result = await handleMessage(makeEvent('好'))
    expect(result.card).toBeDefined()
  })

  test('"没问题" → 弹确认卡片', async () => {
    understandIntent.mockResolvedValue({ intent: 'create_project', params: { ...fullParams }, message: '确认' })
    const result = await handleMessage(makeEvent('没问题'))
    expect(result.card).toBeDefined()
  })

  test('"是一个好项目" → 弹确认卡片（>2字符）', async () => {
    understandIntent.mockResolvedValue({ intent: 'create_project', params: { ...fullParams }, message: '请确认' })
    const result = await handleMessage(makeEvent('是一个好项目'))
    expect(result.card).toBeDefined()
    expect(callTool).not.toHaveBeenCalled()
  })

  test('"可以吧" → 弹确认卡片（>2字符）', async () => {
    understandIntent.mockResolvedValue({ intent: 'create_project', params: { ...fullParams }, message: '请确认' })
    const result = await handleMessage(makeEvent('可以吧'))
    expect(result.card).toBeDefined()
    expect(callTool).not.toHaveBeenCalled()
  })

  test('"取消" → 取消创建', async () => {
    understandIntent.mockResolvedValue({
      intent: null,
      params: {},
      message: '已取消操作',
    })

    const result = await handleMessage(makeEvent('取消'))
    expect(result.text).toContain('已取消')
  })

  test('"不要" → 取消创建', async () => {
    understandIntent.mockResolvedValue({
      intent: null,
      params: {},
      message: '已取消操作',
    })

    const result = await handleMessage(makeEvent('不要'))
    expect(result.text).toContain('已取消')
  })

  test('"算了" → 取消创建', async () => {
    understandIntent.mockResolvedValue({
      intent: null,
      params: {},
      message: '已取消操作',
    })

    const result = await handleMessage(makeEvent('算了'))
    expect(result.text).toContain('已取消')
  })

  test('"不做了" → 取消创建', async () => {
    understandIntent.mockResolvedValue({
      intent: null,
      params: {},
      message: '已取消操作',
    })

    const result = await handleMessage(makeEvent('不做了'))
    expect(result.text).toContain('已取消')
  })

  test('"否" → 取消创建（≤2字符）', async () => {
    understandIntent.mockResolvedValue({
      intent: null,
      params: {},
      message: '已取消操作',
    })

    const result = await handleMessage(makeEvent('否'))
    expect(result.text).toContain('已取消')
  })
})

// ============================================================
// 5. 项目查询
// ============================================================
describe('项目查询', () => {
  test('"查看项目" → 列出所有项目', async () => {
    understandIntent.mockResolvedValue({
      intent: 'list_projects',
      params: {},
      message: '正在查询',
    })
    callTool.mockResolvedValue([
      { record_id: 'r1', fields: { name: '项目A', current_stage: 'requirement', status: '正常' } },
      { record_id: 'r2', fields: { name: '项目B', current_stage: 'bid_determine', status: '异常' } },
    ])

    const result = await handleMessage(makeEvent('查看项目'))
    expect(result.text).toContain('共 2 个项目')
    expect(result.text).toContain('项目A')
    expect(result.text).toContain('项目B')
  })

  test('"有哪些项目" → 列出所有项目', async () => {
    understandIntent.mockResolvedValue({
      intent: 'list_projects',
      params: {},
      message: '正在查询',
    })
    callTool.mockResolvedValue([
      { record_id: 'r1', fields: { name: '项目A', current_stage: 'requirement', status: '正常' } },
    ])

    const result = await handleMessage(makeEvent('有哪些项目'))
    expect(result.text).toContain('共 1 个项目')
  })

  test('空列表 → "没有找到匹配的项目"', async () => {
    understandIntent.mockResolvedValue({
      intent: 'list_projects',
      params: {},
      message: '正在查询',
    })
    callTool.mockResolvedValue([])

    const result = await handleMessage(makeEvent('有哪些项目'))
    expect(result.text).toContain('没有找到匹配的项目')
  })

  test('"查看XX项目" → 显示项目详情', async () => {
    understandIntent.mockResolvedValue({
      intent: 'get_project',
      params: { name: '项目A' },
      message: '正在查询',
    })
    callTool.mockResolvedValue({
      record_id: 'r1',
      fields: { name: '项目A', no: 'CG-001', owner: '张三', department: 'FBU', category: '设备', budget: 100, plan_start: '2026-01-01', plan_end: '2026-12-31', current_stage: 'requirement', status: '正常' },
    })

    const result = await handleMessage(makeEvent('查看项目A'))
    expect(result.text).toContain('项目A')
    expect(result.text).toContain('CG-001')
    expect(result.text).toContain('张三')
    expect(result.text).toContain('需求确认')
  })

  test('异常项目 → 显示⚠️标记', async () => {
    understandIntent.mockResolvedValue({
      intent: 'get_project',
      params: { name: '项目B' },
      message: '正在查询',
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
// 6. 节点查询
// ============================================================
describe('节点查询', () => {
  test('"查看项目节点" → 列出节点状态', async () => {
    understandIntent.mockResolvedValue({
      intent: 'list_project_nodes',
      params: { name: '项目A' },
      message: '正在查询',
    })
    callTool.mockResolvedValue([
      { fields: { stage_key: 'requirement', status: 'completed', actual_date: '2026-01-15' } },
      { fields: { stage_key: 'supplier_dev', status: 'in_progress' } },
      { fields: { stage_key: 'tech_exchange', status: 'pending' } },
    ])

    const result = await handleMessage(makeEvent('查看项目节点'))
    expect(result.text).toContain('需求确认')
    expect(result.text).toContain('供应商开发')
    expect(result.text).toContain('技术交流')
    expect(result.text).toContain('当前进行中')
  })

  test('空节点列表 → "没有找到项目节点"', async () => {
    understandIntent.mockResolvedValue({
      intent: 'list_project_nodes',
      params: { name: '项目A' },
      message: '正在查询',
    })
    callTool.mockResolvedValue([])

    const result = await handleMessage(makeEvent('查看项目节点'))
    expect(result.text).toContain('没有找到项目节点')
  })
})

// ============================================================
// 7. 节点操作 — 标记完成
// ============================================================
describe('节点操作 — 标记完成', () => {
  test('"把定标标记为完成" → 标记完成+显示下一阶段', async () => {
    understandIntent.mockResolvedValue({
      intent: 'advance_node',
      params: { name: '项目A', stageKey: 'bid_determine', status: 'completed' },
      message: '确认完成',
    })
    callTool.mockResolvedValue({})

    const result = await handleMessage(makeEvent('把定标标记为完成'))
    expect(callTool).toHaveBeenCalledWith('advance_node', expect.objectContaining({ stageKey: 'bid_determine' }))
    expect(result.text).toContain('定标')
    expect(result.text).toContain('已完成')
  })

  test('"定标完成了" → 标记完成', async () => {
    understandIntent.mockResolvedValue({
      intent: 'advance_node',
      params: { name: '项目A', stageKey: 'bid_determine', status: 'completed' },
      message: '确认完成',
    })
    callTool.mockResolvedValue({})

    const result = await handleMessage(makeEvent('定标完成了'))
    expect(result.text).toContain('定标')
    expect(result.text).toContain('已完成')
  })

  test('"定标搞定了" → 标记完成', async () => {
    understandIntent.mockResolvedValue({
      intent: 'advance_node',
      params: { name: '项目A', stageKey: 'bid_determine', status: 'completed' },
      message: '确认完成',
    })
    callTool.mockResolvedValue({})

    const result = await handleMessage(makeEvent('定标搞定了'))
    expect(result.text).toContain('已完成')
  })

  test('"需求确认这个节点完成了" → 标记需求确认完成', async () => {
    understandIntent.mockResolvedValue({
      intent: 'advance_node',
      params: { name: '项目A', stageKey: 'requirement', status: 'completed' },
      message: '确认完成',
    })
    callTool.mockResolvedValue({})

    const result = await handleMessage(makeEvent('需求确认这个节点完成了'))
    expect(callTool).toHaveBeenCalledWith('advance_node', expect.objectContaining({ stageKey: 'requirement' }))
    expect(result.text).toContain('需求确认')
    expect(result.text).toContain('已完成')
  })

  test('"供应商开发OK了" → 标记供应商开发完成', async () => {
    understandIntent.mockResolvedValue({
      intent: 'advance_node',
      params: { name: '项目A', stageKey: 'supplier_dev', status: 'completed' },
      message: '确认完成',
    })
    callTool.mockResolvedValue({})

    const result = await handleMessage(makeEvent('供应商开发OK了'))
    expect(result.text).toContain('供应商开发')
    expect(result.text).toContain('已完成')
  })

  test('节点没有 plan_date → 提示需要日期', async () => {
    const err = new Error('需求确认还没有计划完成日期，无法标记完成')
    err.code = 'NEED_PLAN_DATE'
    understandIntent.mockResolvedValue({
      intent: 'advance_node',
      params: { name: '项目A', stageKey: 'requirement', status: 'completed' },
      message: '确认完成',
    })
    callTool.mockRejectedValue(err)

    const result = await handleMessage(makeEvent('需求确认完成了'))
    expect(result.text).toContain('还没有计划完成日期')
  })
})

// ============================================================
// 8. 节点操作 — 标记异常
// ============================================================
describe('节点操作 — 标记异常', () => {
  test('"定标有问题" → 标记定标异常', async () => {
    understandIntent.mockResolvedValue({
      intent: 'mark_node_abnormal',
      params: { name: '项目A', stageKey: 'bid_determine', reason: '定标有问题' },
      message: '标记异常',
    })
    callTool.mockResolvedValue({})

    const result = await handleMessage(makeEvent('定标有问题'))
    expect(callTool).toHaveBeenCalledWith('mark_node_abnormal', expect.objectContaining({ stageKey: 'bid_determine' }))
    expect(result.text).toContain('定标')
    expect(result.text).toContain('异常')
  })

  test('"这个节点出问题了" → 标记当前节点异常', async () => {
    understandIntent.mockResolvedValue({
      intent: 'mark_node_abnormal',
      params: { name: '项目A', stageKey: 'requirement', reason: '用户标记异常' },
      message: '标记异常',
    })
    callTool.mockResolvedValue({})

    const result = await handleMessage(makeEvent('这个节点出问题了'))
    expect(result.text).toContain('异常')
  })

  test('"需求确认异常" → 标记需求确认异常', async () => {
    understandIntent.mockResolvedValue({
      intent: 'mark_node_abnormal',
      params: { name: '项目A', stageKey: 'requirement', reason: '需求确认异常' },
      message: '标记异常',
    })
    callTool.mockResolvedValue({})

    const result = await handleMessage(makeEvent('需求确认异常'))
    expect(result.text).toContain('需求确认')
    expect(result.text).toContain('异常')
  })
})

// ============================================================
// 9. 卡片按钮操作
// ============================================================
describe('卡片按钮操作', () => {
  test('确认创建项目 → 调用 create_project', async () => {
    const mockData = { record_id: 'rec_123', fields: { name: '测试', no: 'CG-2026-001' } }
    callTool.mockResolvedValue(mockData)

    const action = {
      action: 'confirm_project',
      params: { name: '测试', category: '设备', owner: '张三', department: 'FBU', budget: 100, planStart: '2026-01-01', planEnd: '2026-12-31' },
    }

    const result = await handleCardAction(action, 'oc_test_chat')
    expect(callTool).toHaveBeenCalledWith('create_project', action.params)
    expect(client.im.message.create).toHaveBeenCalled()
    expect(result.success).toBe(true)
  })

  test('取消创建 → 不调用 create_project', async () => {
    const action = { action: 'cancel_project', params: { name: '测试' } }
    const result = await handleCardAction(action, 'oc_test_chat')
    expect(callTool).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
  })

  test('确认节点完成 → 调用 advance_node', async () => {
    callTool.mockResolvedValue({})
    const action = { action: 'confirm_node', project_id: 'rec_proj', stage_key: 'requirement' }
    const result = await handleCardAction(action, 'oc_test_chat')
    expect(callTool).toHaveBeenCalledWith('advance_node', { projectId: 'rec_proj', stageKey: 'requirement', status: 'completed' })
    expect(result.success).toBe(true)
  })

  test('标记异常 → 调用 mark_node_abnormal', async () => {
    callTool.mockResolvedValue({})
    const action = { action: 'mark_abnormal', project_id: 'rec_proj', stage_key: 'supplier_dev' }
    const result = await handleCardAction(action, 'oc_test_chat')
    expect(callTool).toHaveBeenCalledWith('mark_node_abnormal', { projectId: 'rec_proj', stageKey: 'supplier_dev', reason: '用户标记异常' })
    expect(result.success).toBe(true)
  })
})

// ============================================================
// 10. 防重复操作
// ============================================================
describe('防重复操作', () => {
  test('重复点击 → 返回 toast', async () => {
    const action = {
      action: 'confirm_project',
      params: { name: '测试重复', category: '设备', owner: '张三' },
    }

    // Make first call hang on callTool so processingActions retains the key
    let resolveFirst
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      return new Promise(r => { resolveFirst = r })
    })
    const firstCall = handleCardAction(action, 'oc_test_chat')
    // Wait for sendProcessedCard to finish and callTool to be called
    await new Promise(r => setTimeout(r, 50))

    // Second call should be blocked by processingActions
    const result = await handleCardAction(action, 'oc_test_chat')
    expect(result.toast).toBeDefined()
    expect(result.toast.content).toContain('正在处理')

    // Resolve the first call to let it complete
    resolveFirst({ record_id: 'rec_1', fields: { name: '测试重复' } })
    await firstCall
  })

  test('并发创建只执行一次', async () => {
    let resolveFirst
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      return new Promise(r => { resolveFirst = r })
    })
    const action = {
      action: 'confirm_project',
      params: { name: '并发测试', category: '设备', owner: '张三' },
    }

    const firstCall = handleCardAction(action, 'oc_test_chat')
    await new Promise(r => setTimeout(r, 50))
    const secondCall = handleCardAction(action, 'oc_test_chat')

    resolveFirst({ record_id: 'rec_1', fields: { name: '并发测试' } })
    const [r1, r2] = await Promise.all([firstCall, secondCall])

    expect(callTool).toHaveBeenCalledWith('create_project', expect.any(Object))
    expect(r2.toast).toBeDefined()
  })
})

// ============================================================
// 11. 异常处理
// ============================================================
describe('异常处理', () => {
  test('创建项目失败 → 返回错误', async () => {
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      return Promise.reject(new Error('创建失败'))
    })
    const action = {
      action: 'confirm_project',
      params: { name: '失败项目', category: '设备', owner: '张三' },
    }
    const result = await handleCardAction(action, 'oc_test_chat')
    expect(result.success).toBe(false)
    expect(result.error).toContain('创建失败')
  })

  test('重名项目 → 返回错误', async () => {
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([{ record_id: 'r1', fields: { name: '重复项目', no: 'CG-001' } }])
      return Promise.resolve({})
    })
    const action = {
      action: 'confirm_project',
      params: { name: '重复项目', category: '设备', owner: '张三' },
    }
    const result = await handleCardAction(action, 'oc_test_chat')
    expect(result.success).toBe(false)
    expect(result.error).toBe('duplicate_name')
    expect(client.im.message.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ content: expect.stringContaining('已存在') }) })
    )
  })

  test('节点操作失败 → 返回错误', async () => {
    callTool.mockRejectedValue(new Error('缺少 projectId 参数'))
    const action = { action: 'confirm_node', project_id: '', stage_key: 'requirement' }
    const result = await handleCardAction(action, 'oc_test_chat')
    expect(result.success).toBe(false)
  })

  test('LLM 返回无意图 → 默认引导提示', async () => {
    understandIntent.mockResolvedValue({
      intent: null,
      params: {},
      message: null,
    })

    const result = await handleMessage(makeEvent('随便说说'))
    expect(result.text).toContain('抱歉')
  })

  test('LLM 返回纯文本回复 → 直接展示', async () => {
    understandIntent.mockResolvedValue({
      intent: null,
      params: {},
      message: '采购协同平台支持设备、材料、服务等品类',
    })

    const result = await handleMessage(makeEvent('支持哪些品类'))
    expect(result.text).toBe('采购协同平台支持设备、材料、服务等品类')
  })
})

// ============================================================
// 12. 辅助函数单元测试
// ============================================================
describe('normalizeBudget', () => {
  test('"80万" → 80', () => expect(normalizeBudget('80万')).toBe(80))
  test('"1.5万" → 1.5', () => expect(normalizeBudget('1.5万')).toBe(1.5))
  test('"200" → 200', () => expect(normalizeBudget('200')).toBe(200))
  test('800000 → 80', () => expect(normalizeBudget(800000)).toBe(80))
  test('500000 → 50', () => expect(normalizeBudget(500000)).toBe(50))
  test('null → null', () => expect(normalizeBudget(null)).toBeNull())
})

describe('validateDates', () => {
  test('正常日期 → null', () => expect(validateDates({ planStart: '2026-01-01', planEnd: '2026-12-31' })).toBeNull())
  test('结束早于开始 → 报错', () => {
    expect(validateDates({ planStart: '2026-12-31', planEnd: '2026-01-01' })).toBe('计划结束日期不能早于开始日期')
  })
  test('无日期 → null', () => expect(validateDates({})).toBeNull())
})
