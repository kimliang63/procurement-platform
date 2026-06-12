/**
 * 全场景测试：覆盖 Bot 所有操作场景 + 交叉对话
 * mock understandIntent，测试 handleMessage 端到端行为
 */

// Mock 外部依赖
jest.mock('../../feishu/client', () => ({
  im: { message: { create: jest.fn().mockResolvedValue({}) } },
}))

jest.mock('../group', () => ({
  getGroupBinding: jest.fn().mockResolvedValue(null),
  bindGroup: jest.fn().mockResolvedValue({ message: '绑定成功', project: { record_id: 'rec_proj', fields: { name: '测试项目' } } }),
  unbindGroup: jest.fn().mockResolvedValue({ success: true, projectName: '测试项目' }),
  isProjectOwner: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../mcp', () => ({
  callTool: jest.fn(),
  STAGE_MAP: {
    requirement: { label: '需求确认', order: 1 },
    supplier_dev: { label: '供应商开发', order: 2 },
    tech_exchange: { label: '技术交流', order: 3 },
    sampling: { label: '打样', order: 4 },
    bid_approval: { label: '招标方案审批', order: 5 },
    bid_issue: { label: '发标', order: 6 },
    bid_qa: { label: '答疑', order: 7 },
    bid_return: { label: '供应商回标', order: 8 },
    bid_open: { label: '开标', order: 9 },
    bid_determine: { label: '定标', order: 10 },
    bid_notify: { label: '中标/未中标通知', order: 11 },
    contract_approval: { label: '合同审批', order: 12 },
    production: { label: '生产', order: 13 },
    shipping: { label: '运输', order: 14 },
    acceptance: { label: '验收', order: 15 },
  },
  STAGE_KEYS: ['requirement', 'supplier_dev', 'tech_exchange', 'sampling', 'bid_approval', 'bid_issue', 'bid_qa', 'bid_return', 'bid_open', 'bid_determine', 'bid_notify', 'contract_approval', 'production', 'shipping', 'acceptance'],
}))

jest.mock('../llm', () => ({
  understandIntent: jest.fn(),
  getSession: jest.fn(),
}))

jest.mock('../weekly', () => ({
  generateAdminWeeklyReport: jest.fn().mockResolvedValue({ header: { title: { content: '管理周报' } } }),
  generateGroupWeeklyReport: jest.fn().mockResolvedValue({ header: { title: { content: '项目周报' } } }),
}))

jest.mock('../../feishu/bitable', () => ({
  listRecords: jest.fn().mockResolvedValue([
    { record_id: 'u1', fields: { feishu_open_id: 'ou_test_user', name: '测试用户' } },
  ]),
}))

const { handleMessage, handleCardAction, clearProcessingActions } = require('../index')
const { callTool } = require('../../mcp')
const { understandIntent, getSession } = require('../llm')
const { bindGroup, unbindGroup, getGroupBinding } = require('../group')
const { generateAdminWeeklyReport, generateGroupWeeklyReport } = require('../weekly')
const client = require('../../feishu/client')

function makeEvent(text, senderId = 'ou_test_user', chatId = 'oc_test_chat', chatType = 'p2p') {
  return {
    message: { content: JSON.stringify({ text }), chat_id: chatId, chat_type: chatType },
    sender: { sender_id: { open_id: senderId } },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  clearProcessingActions()
  understandIntent.mockReset()
  getSession.mockReset()
  getSession.mockReturnValue({ currentProjectId: 'rec_proj', history: [], pendingAction: null })
  callTool.mockReset()
  callTool.mockImplementation((tool) => {
    if (tool === 'list_projects') return Promise.resolve([])
    if (tool === 'list_groups') return Promise.resolve([])
    return Promise.resolve({ record_id: 'rec_1', fields: { name: '测试', no: 'CG-001' } })
  })
})

// ============================================================
// 1. 更新项目
// ============================================================
describe('更新项目', () => {
  test('更新项目名称', async () => {
    understandIntent.mockResolvedValue({
      intent: 'update_project',
      params: { projectId: 'rec_proj', name: '新名称' },
      message: '已更新项目名称',
    })

    const result = await handleMessage(makeEvent('把项目名称改成新名称'))
    expect(callTool).toHaveBeenCalledWith('update_project', expect.objectContaining({ name: '新名称' }))
    expect(result.text).toContain('已更新项目名称')
  })

  test('更新项目预算', async () => {
    understandIntent.mockResolvedValue({
      intent: 'update_project',
      params: { projectId: 'rec_proj', budget: 200 },
      message: '已更新预算',
    })

    const result = await handleMessage(makeEvent('预算改为200万'))
    expect(callTool).toHaveBeenCalledWith('update_project', expect.objectContaining({ budget: 200 }))
    expect(result.text).toBeDefined()
  })

  test('更新项目状态', async () => {
    understandIntent.mockResolvedValue({
      intent: 'update_project',
      params: { projectId: 'rec_proj', status: '项目暂停' },
      message: '已暂停项目',
    })

    const result = await handleMessage(makeEvent('把项目暂停'))
    expect(callTool).toHaveBeenCalledWith('update_project', expect.objectContaining({ status: '项目暂停' }))
    expect(result.text).toBeDefined()
  })

  test('更新项目 — 无 projectId 但有 name → 自动查找', async () => {
    // 覆盖 session，不带 currentProjectId，触发 name lookup 路径
    getSession.mockReturnValue({ currentProjectId: null, history: [], pendingAction: null })
    understandIntent.mockResolvedValue({
      intent: 'update_project',
      params: { name: '测试项目', budget: 150 },
      message: '已更新',
    })
    callTool.mockImplementation((tool, params) => {
      if (tool === 'list_projects') return Promise.resolve([
        { record_id: 'rec_lookup', fields: { name: '测试项目' } },
      ])
      return Promise.resolve({ record_id: 'rec_lookup', fields: { name: '测试项目' } })
    })

    const result = await handleMessage(makeEvent('测试项目预算改为150万'))
    expect(callTool).toHaveBeenCalledWith('update_project', expect.objectContaining({ projectId: 'rec_lookup', budget: 150 }))
  })

  test('更新项目 — 找不到项目 → 提示', async () => {
    getSession.mockReturnValue({ currentProjectId: null, history: [], pendingAction: null })
    understandIntent.mockResolvedValue({
      intent: 'update_project',
      params: { name: '不存在的项目' },
      message: '更新',
    })
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      return Promise.resolve({})
    })

    const result = await handleMessage(makeEvent('不存在的项目预算改为100'))
    expect(result.text).toContain('未找到项目')
  })
})

// ============================================================
// 2. 更新节点时间（支持批量）
// ============================================================
describe('更新节点时间', () => {
  test('更新单个节点计划日期', async () => {
    understandIntent.mockResolvedValue({
      intent: 'update_node',
      params: { projectId: 'rec_proj', stageKey: 'requirement', plan_start: '2026-07-01', plan_end: '2026-07-15' },
      message: '已更新',
    })

    const result = await handleMessage(makeEvent('需求确认计划日期改为7月1号到7月15号'))
    expect(callTool).toHaveBeenCalledWith('update_node', expect.objectContaining({
      projectId: 'rec_proj',
      stageKey: 'requirement',
      plan_start: '2026-07-01',
      plan_end: '2026-07-15',
    }))
    expect(result.text).toContain('已更新')
    expect(result.text).toContain('需求确认')
  })

  test('更新节点实际完成日期', async () => {
    understandIntent.mockResolvedValue({
      intent: 'update_node',
      params: { projectId: 'rec_proj', stageKey: 'bid_determine', actual_date: '2026-06-10' },
      message: '已更新',
    })

    const result = await handleMessage(makeEvent('定标实际完成日期是6月10号'))
    expect(callTool).toHaveBeenCalledWith('update_node', expect.objectContaining({
      stageKey: 'bid_determine',
      actual_date: '2026-06-10',
    }))
    expect(result.text).toContain('已更新')
    expect(result.text).toContain('定标')
  })

  test('更新节点备注', async () => {
    understandIntent.mockResolvedValue({
      intent: 'update_node',
      params: { projectId: 'rec_proj', stageKey: 'supplier_dev', note: '供应商已确认' },
      message: '已更新',
    })

    const result = await handleMessage(makeEvent('供应商开发备注：供应商已确认'))
    expect(callTool).toHaveBeenCalledWith('update_node', expect.objectContaining({
      stageKey: 'supplier_dev',
      note: '供应商已确认',
    }))
    expect(result.text).toContain('已更新')
  })

  test('批量更新：先更新需求确认，再更新供应商开发', async () => {
    // 第一次：更新需求确认
    understandIntent.mockResolvedValueOnce({
      intent: 'update_node',
      params: { projectId: 'rec_proj', stageKey: 'requirement', plan_end: '2026-07-01' },
      message: '已更新需求确认',
    })
    const r1 = await handleMessage(makeEvent('需求确认截止日期改为7月1号'))
    expect(r1.text).toContain('已更新')
    expect(r1.text).toContain('需求确认')

    // 第二次：更新供应商开发
    understandIntent.mockResolvedValueOnce({
      intent: 'update_node',
      params: { projectId: 'rec_proj', stageKey: 'supplier_dev', plan_start: '2026-07-02', plan_end: '2026-07-20' },
      message: '已更新供应商开发',
    })
    const r2 = await handleMessage(makeEvent('供应商开发开始7月2号，结束7月20号'))
    expect(r2.text).toContain('已更新')
    expect(r2.text).toContain('供应商开发')
  })

  test('更新节点 — 无 projectId → 按名称查找', async () => {
    getSession.mockReturnValue({ currentProjectId: null, history: [], pendingAction: null })
    understandIntent.mockResolvedValue({
      intent: 'update_node',
      params: { name: '测试项目', stageKey: 'requirement', plan_end: '2026-08-01' },
      message: '已更新',
    })
    callTool.mockImplementation((tool, params) => {
      if (tool === 'list_projects') return Promise.resolve([
        { record_id: 'rec_lookup', fields: { name: '测试项目' } },
      ])
      return Promise.resolve({})
    })

    const result = await handleMessage(makeEvent('测试项目的需求确认截止日期改为8月1号'))
    expect(callTool).toHaveBeenCalledWith('update_node', expect.objectContaining({
      projectId: 'rec_lookup',
      stageKey: 'requirement',
    }))
  })

  test('更新节点 — 无 projectId 且找不到项目 → 提示', async () => {
    getSession.mockReturnValue({ currentProjectId: null, history: [], pendingAction: null })
    understandIntent.mockResolvedValue({
      intent: 'update_node',
      params: { name: '不存在的项目', stageKey: 'requirement' },
      message: '更新',
    })
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      return Promise.resolve({})
    })

    const result = await handleMessage(makeEvent('不存在的项目需求确认日期改了'))
    expect(result.text).toContain('未找到项目')
  })
})

// ============================================================
// 3. 创建问题
// ============================================================
describe('创建问题', () => {
  test('标准创建问题', async () => {
    understandIntent.mockResolvedValue({
      intent: 'create_issue',
      params: { projectId: 'rec_proj', stageKey: 'bid_determine', description: '定标价格有争议', assignee: '张三', priority: '高' },
      message: '问题已创建',
    })
    callTool.mockResolvedValue({ record_id: 'issue_1', fields: { title: '定标价格有争议' } })

    const result = await handleMessage(makeEvent('定标价格有争议，需要张三跟进'))
    expect(callTool).toHaveBeenCalledWith('create_issue', expect.objectContaining({
      projectId: 'rec_proj',
      stageKey: 'bid_determine',
      description: '定标价格有争议',
    }))
    expect(result.text).toBeDefined()
  })

  test('创建问题 — 无 projectId 但有 name → 自动查找', async () => {
    getSession.mockReturnValue({ currentProjectId: null, history: [], pendingAction: null })
    understandIntent.mockResolvedValue({
      intent: 'create_issue',
      params: { name: '测试项目', stageKey: 'requirement', description: '需求不明确' },
      message: '问题已创建',
    })
    callTool.mockImplementation((tool, params) => {
      if (tool === 'list_projects') return Promise.resolve([
        { record_id: 'rec_lookup', fields: { name: '测试项目' } },
      ])
      return Promise.resolve({ record_id: 'issue_1' })
    })

    const result = await handleMessage(makeEvent('测试项目的需求不明确'))
    expect(callTool).toHaveBeenCalledWith('create_issue', expect.objectContaining({
      projectId: 'rec_lookup',
    }))
  })
})

// ============================================================
// 4. 更新问题
// ============================================================
describe('更新问题', () => {
  test('更新问题状态为已关闭', async () => {
    understandIntent.mockResolvedValue({
      intent: 'update_issue',
      params: { issueId: 'issue_1', status: 'closed' },
      message: '问题已关闭',
    })
    callTool.mockResolvedValue({ record_id: 'issue_1', fields: { status: 'closed' } })

    const result = await handleMessage(makeEvent('把问题关闭'))
    expect(callTool).toHaveBeenCalledWith('update_issue', expect.objectContaining({ status: 'closed' }))
    expect(result.text).toBeDefined()
  })

  test('更新问题优先级', async () => {
    understandIntent.mockResolvedValue({
      intent: 'update_issue',
      params: { issueId: 'issue_1', priority: '低' },
      message: '优先级已更新',
    })

    const result = await handleMessage(makeEvent('把问题优先级改为低'))
    expect(callTool).toHaveBeenCalledWith('update_issue', expect.objectContaining({ priority: '低' }))
  })
})

// ============================================================
// 5. 查询问题列表
// ============================================================
describe('查询问题', () => {
  test('"查看问题" → 列出问题', async () => {
    understandIntent.mockResolvedValue({
      intent: 'list_issues',
      params: {},
      message: '正在查询',
    })
    callTool.mockResolvedValue([
      { record_id: 'i1', fields: { title: '定标争议', status: 'open', priority: '高', stage_key: 'bid_determine' } },
      { record_id: 'i2', fields: { title: '需求变更', status: 'closed', priority: '中', stage_key: 'requirement' } },
    ])

    const result = await handleMessage(makeEvent('查看问题'))
    expect(result.text).toBeDefined()
  })

  test('空问题列表', async () => {
    understandIntent.mockResolvedValue({
      intent: 'list_issues',
      params: {},
      message: '正在查询',
    })
    callTool.mockResolvedValue([])

    const result = await handleMessage(makeEvent('有哪些问题'))
    expect(result.text).toBeDefined()
  })
})

// ============================================================
// 6. 周报
// ============================================================
describe('周报', () => {
  test('"周报" 在群聊中 → 生成群周报', async () => {
    const result = await handleMessage(makeEvent('周报', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(generateGroupWeeklyReport).toHaveBeenCalledWith('oc_test_chat')
  })

  test('"周报" 无 chatId → 提示去群聊', async () => {
    const result = await handleMessage({ message: { content: JSON.stringify({ text: '周报' }), chat_type: 'p2p' }, sender: { sender_id: { open_id: 'ou_test_user' } } })
    expect(result.text).toContain('请在群聊中使用')
  })

  test('"管理周报" → 生成管理周报', async () => {
    const result = await handleMessage(makeEvent('管理周报'))
    expect(generateAdminWeeklyReport).toHaveBeenCalled()
    expect(result.card).toBeDefined()
  })

  test('"admin周报" → 生成管理周报', async () => {
    const result = await handleMessage(makeEvent('admin周报'))
    expect(generateAdminWeeklyReport).toHaveBeenCalled()
  })

  test('群周报未绑定项目 → 返回 null → 提示', async () => {
    generateGroupWeeklyReport.mockResolvedValueOnce(null)
    const result = await handleMessage(makeEvent('周报', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(result.text).toContain('未绑定项目')
  })

  test('"weekly" 英文关键词也触发', async () => {
    const result = await handleMessage(makeEvent('weekly', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(generateGroupWeeklyReport).toHaveBeenCalled()
  })
})

// ============================================================
// 7. 绑定/解绑群
// ============================================================
describe('绑定群', () => {
  test('"绑定 测试项目" → 绑定成功', async () => {
    const result = await handleMessage(makeEvent('绑定 测试项目', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(bindGroup).toHaveBeenCalledWith('oc_test_chat', '测试项目', 'ou_test_user')
    expect(result.text).toContain('绑定成功')
  })

  test('"绑定XX项目" 无空格 → 也能绑定', async () => {
    const result = await handleMessage(makeEvent('绑定XX项目', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(bindGroup).toHaveBeenCalled()
  })

  test('"绑定" 无项目名 → 追问', async () => {
    const result = await handleMessage(makeEvent('绑定', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(result.text).toContain('请告诉我要绑定的项目名称')
  })

  test('"绑定" 无 chatId → 不支持', async () => {
    const result = await handleMessage({ message: { content: JSON.stringify({ text: '绑定 测试项目' }), chat_type: 'p2p' }, sender: { sender_id: { open_id: 'ou_test_user' } } })
    expect(result.text).toContain('仅支持群聊使用')
  })

  test('绑定不存在的项目 → 提示未找到', async () => {
    bindGroup.mockResolvedValueOnce({ success: false, message: '未找到项目"不存在的项目"' })
    const result = await handleMessage(makeEvent('绑定 不存在的项目', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(result.text).toContain('未找到项目')
  })

  test('绑定已绑定的群 → 提示先解绑', async () => {
    bindGroup.mockResolvedValueOnce({ success: false, message: '该群已绑定其他项目，请先解绑' })
    const result = await handleMessage(makeEvent('绑定 新项目', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(result.text).toContain('已绑定')
    expect(result.text).toContain('先解绑')
  })
})

describe('解绑群', () => {
  test('"解绑" → 解绑成功', async () => {
    const result = await handleMessage(makeEvent('解绑', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(unbindGroup).toHaveBeenCalledWith('oc_test_chat')
    expect(result.text).toContain('已解绑')
  })

  test('"解绑" 无 chatId → 不支持', async () => {
    const result = await handleMessage({ message: { content: JSON.stringify({ text: '解绑' }), chat_type: 'p2p' }, sender: { sender_id: { open_id: 'ou_test_user' } } })
    expect(result.text).toContain('仅支持群聊使用')
  })

  test('"解绑" 未绑定项目 → 提示', async () => {
    unbindGroup.mockResolvedValueOnce({ success: false, message: '当前群未绑定任何项目' })
    const result = await handleMessage(makeEvent('解绑', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(result.text).toContain('未绑定')
  })
})

// ============================================================
// 8. 卡片操作 — 权限检查
// ============================================================
describe('卡片操作 — 权限', () => {
  test('非负责人确认节点 → 拒绝', async () => {
    const { isProjectOwner } = require('../group')
    isProjectOwner.mockResolvedValueOnce(false)

    const action = { action: 'confirm_node', project_id: 'rec_proj', stage_key: 'requirement' }
    const result = await handleCardAction(action, 'oc_test_chat', 'ou_other_user')
    expect(result.toast).toBeDefined()
    expect(result.toast.content).toContain('仅负责人可操作')
  })

  test('非负责人标记异常 → 拒绝', async () => {
    const { isProjectOwner } = require('../group')
    isProjectOwner.mockResolvedValueOnce(false)

    const action = { action: 'mark_abnormal', project_id: 'rec_proj', stage_key: 'requirement' }
    const result = await handleCardAction(action, 'oc_test_chat', 'ou_other_user')
    expect(result.toast).toBeDefined()
    expect(result.toast.content).toContain('仅负责人可操作')
  })

  test('负责人确认节点 → 允许', async () => {
    callTool.mockResolvedValue({})
    const action = { action: 'confirm_node', project_id: 'rec_proj', stage_key: 'requirement' }
    const result = await handleCardAction(action, 'oc_test_chat', 'ou_test_user')
    expect(result.success).toBe(true)
  })
})

// ============================================================
// 9. 卡片操作 — confirm_project 初始化节点
// ============================================================
describe('卡片操作 — confirm_project 节点初始化', () => {
  test('确认创建后调用 init_project_nodes', async () => {
    const params = { name: '新项目', category: '设备', owner: '张三', department: 'FBU', budget: 100, planStart: '2026-01-01', planEnd: '2026-12-31', isSingleSource: '否', procurementMethod: '项目类' }
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      if (tool === 'create_project') return Promise.resolve({ record_id: 'rec_new', fields: { name: '新项目', no: 'CG-2026-001' } })
      return Promise.resolve({})
    })

    const action = { action: 'confirm_project', params }
    const result = await handleCardAction(action, 'oc_test_chat', 'ou_test_user')
    expect(result.success).toBe(true)
    await new Promise(r => setTimeout(r, 150))

    // 验证 init_project_nodes 被调用
    expect(callTool).toHaveBeenCalledWith('init_project_nodes', expect.objectContaining({
      projectId: 'rec_new',
      isSingleSource: '否',
      budget: 100,
      procurementMethod: '项目类',
    }))
  })

  test('单一来源项目确认创建 → init_project_nodes 传入 isSingleSource=是', async () => {
    const params = { name: '单一来源项目', category: '设备', owner: '张三', department: 'FBU', budget: 50, planStart: '2026-01-01', planEnd: '2026-12-31', isSingleSource: '是', procurementMethod: '项目类' }
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      if (tool === 'create_project') return Promise.resolve({ record_id: 'rec_ss', fields: { name: '单一来源项目' } })
      return Promise.resolve({})
    })

    const action = { action: 'confirm_project', params }
    await handleCardAction(action, 'oc_test_chat')
    await new Promise(r => setTimeout(r, 150))

    expect(callTool).toHaveBeenCalledWith('init_project_nodes', expect.objectContaining({
      isSingleSource: '是',
      budget: 50,
      procurementMethod: '项目类',
    }))
  })
})

// ============================================================
// 10. 交叉对话场景
// ============================================================
describe('交叉对话', () => {
  test('创建项目 → 查询项目 → 绑定群', async () => {
    // Step 1: 创建项目（发起）
    understandIntent.mockResolvedValueOnce({
      intent: 'create_project',
      params: { name: '交叉测试项目', category: '设备', owner: '张三', department: 'FBU', budget: 100, planStart: '2026-01-01', planEnd: '2026-12-31', isSingleSource: '否', procurementMethod: '项目类' },
      message: '请确认',
    })
    const r1 = await handleMessage(makeEvent('创建交叉测试项目'))
    expect(r1.card).toBeDefined() // 确认卡片

    // Step 2: 查询项目
    understandIntent.mockResolvedValueOnce({
      intent: 'list_projects',
      params: {},
      message: '正在查询',
    })
    callTool.mockResolvedValueOnce([
      { record_id: 'r1', fields: { name: '交叉测试项目', current_stage: 'requirement', status: '进行中' } },
    ])
    const r2 = await handleMessage(makeEvent('查看项目'))
    expect(r2.text).toContain('交叉测试项目')

    // Step 3: 绑定群
    const r3 = await handleMessage(makeEvent('绑定 交叉测试项目', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(bindGroup).toHaveBeenCalledWith('oc_test_chat', '交叉测试项目', 'ou_test_user')
  })

  test('查询节点 → 更新节点时间 → 标记完成', async () => {
    // Step 1: 查询节点
    understandIntent.mockResolvedValueOnce({
      intent: 'list_project_nodes',
      params: { name: '测试项目' },
      message: '正在查询',
    })
    callTool.mockResolvedValueOnce([
      { fields: { stage_key: 'requirement', status: 'in_progress', plan_end: '2026-07-01' } },
      { fields: { stage_key: 'supplier_dev', status: 'pending' } },
    ])
    const r1 = await handleMessage(makeEvent('查看节点'))
    expect(r1.text).toContain('需求确认')

    // Step 2: 更新节点时间
    understandIntent.mockResolvedValueOnce({
      intent: 'update_node',
      params: { projectId: 'rec_proj', stageKey: 'requirement', plan_end: '2026-07-15' },
      message: '已更新',
    })
    const r2 = await handleMessage(makeEvent('需求确认截止日期改为7月15号'))
    expect(r2.text).toContain('已更新')

    // Step 3: 标记完成
    understandIntent.mockResolvedValueOnce({
      intent: 'advance_node',
      params: { projectId: 'rec_proj', stageKey: 'requirement', status: 'completed' },
      message: '确认完成',
    })
    callTool.mockResolvedValueOnce({})
    const r3 = await handleMessage(makeEvent('需求确认完成了'))
    expect(r3.text).toContain('需求确认')
    expect(r3.text).toContain('已完成')
  })

  test('创建问题 → 更新问题 → 查看问题列表', async () => {
    // Step 1: 创建问题
    understandIntent.mockResolvedValueOnce({
      intent: 'create_issue',
      params: { projectId: 'rec_proj', stageKey: 'bid_determine', description: '价格争议', priority: '高' },
      message: '问题已创建',
    })
    callTool.mockResolvedValueOnce({ record_id: 'issue_1' })
    const r1 = await handleMessage(makeEvent('定标价格有争议'))
    expect(r1.text).toBeDefined()

    // Step 2: 更新问题
    understandIntent.mockResolvedValueOnce({
      intent: 'update_issue',
      params: { issueId: 'issue_1', status: 'closed' },
      message: '问题已关闭',
    })
    const r2 = await handleMessage(makeEvent('把问题关闭'))
    expect(r2.text).toBeDefined()

    // Step 3: 查看问题列表
    understandIntent.mockResolvedValueOnce({
      intent: 'list_issues',
      params: {},
      message: '正在查询',
    })
    callTool.mockResolvedValueOnce([
      { record_id: 'issue_1', fields: { title: '价格争议', status: 'closed' } },
    ])
    const r3 = await handleMessage(makeEvent('查看问题'))
    expect(r3.text).toBeDefined()
  })

  test('标记异常 → 查看节点 → 更新节点日期', async () => {
    // Step 1: 标记异常
    understandIntent.mockResolvedValueOnce({
      intent: 'mark_node_abnormal',
      params: { projectId: 'rec_proj', stageKey: 'supplier_dev', reason: '供应商延迟' },
      message: '标记异常',
    })
    callTool.mockResolvedValueOnce({})
    const r1 = await handleMessage(makeEvent('供应商开发出问题了'))
    expect(r1.text).toContain('异常')

    // Step 2: 查看节点
    understandIntent.mockResolvedValueOnce({
      intent: 'list_project_nodes',
      params: {},
      message: '正在查询',
    })
    callTool.mockResolvedValueOnce([
      { fields: { stage_key: 'supplier_dev', status: 'blocked', actual_date: null } },
    ])
    const r2 = await handleMessage(makeEvent('查看节点'))
    expect(r2.text).toBeDefined()

    // Step 3: 更新节点日期
    understandIntent.mockResolvedValueOnce({
      intent: 'update_node',
      params: { projectId: 'rec_proj', stageKey: 'supplier_dev', plan_end: '2026-08-01' },
      message: '已更新',
    })
    const r3 = await handleMessage(makeEvent('供应商开发截止日期延到8月1号'))
    expect(r3.text).toContain('已更新')
  })

  test('解绑群 → 重新绑定其他项目', async () => {
    // Step 1: 解绑
    const r1 = await handleMessage(makeEvent('解绑', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(unbindGroup).toHaveBeenCalledWith('oc_test_chat')
    expect(r1.text).toContain('已解绑')

    // Step 2: 重新绑定
    const r2 = await handleMessage(makeEvent('绑定 新项目', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(bindGroup).toHaveBeenCalled()
  })

  test('管理周报 → 创建项目 → 确认创建', async () => {
    // Step 1: 管理周报
    const r1 = await handleMessage(makeEvent('管理周报'))
    expect(generateAdminWeeklyReport).toHaveBeenCalled()

    // Step 2: 创建项目
    understandIntent.mockResolvedValueOnce({
      intent: 'create_project',
      params: { name: '周报后项目', category: '材料', owner: '张三', department: 'LBU', budget: 80, planStart: '2026-07-01', planEnd: '2026-12-31', isSingleSource: '否', procurementMethod: '框架类' },
      message: '请确认',
    })
    const r2 = await handleMessage(makeEvent('创建周报后项目'))
    expect(r2.card).toBeDefined()
  })

  test('纯问答 → 创建项目 → 取消', async () => {
    // Step 1: 纯问答
    understandIntent.mockResolvedValueOnce({
      intent: null,
      params: {},
      message: '平台支持设备、材料、服务等品类',
    })
    const r1 = await handleMessage(makeEvent('支持哪些品类'))
    expect(r1.text).toContain('设备')

    // Step 2: 创建项目
    understandIntent.mockResolvedValueOnce({
      intent: 'create_project',
      params: {},
      message: '好的，请问项目名称是什么？',
    })
    const r2 = await handleMessage(makeEvent('创建一个新项目'))
    expect(r2.text).toContain('项目名称')

    // Step 3: 取消
    understandIntent.mockResolvedValueOnce({
      intent: null,
      params: {},
      message: '已取消操作',
    })
    const r3 = await handleMessage(makeEvent('取消'))
    expect(r3.text).toContain('已取消')
  })

  test('绑定群 → 发周报 → 查询项目', async () => {
    // Step 1: 绑定群（不消费 understandIntent mock）
    const r1 = await handleMessage(makeEvent('绑定 测试项目', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(r1.text).toContain('绑定成功')

    // Step 2: 发周报（不消费 understandIntent mock）
    const r2 = await handleMessage(makeEvent('周报', 'ou_test_user', 'oc_test_chat', 'group'))
    expect(generateGroupWeeklyReport).toHaveBeenCalledWith('oc_test_chat')

    // Step 3: 查询项目
    understandIntent.mockResolvedValueOnce({
      intent: 'list_projects',
      params: {},
      message: '正在查询',
    })
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([
        { record_id: 'r1', fields: { name: '测试项目', current_stage: 'requirement', status: '进行中' } },
      ])
      return Promise.resolve({})
    })
    const r3 = await handleMessage(makeEvent('查看项目'))
    expect(r3.text).toContain('测试项目')
  })
})

// ============================================================
// 11. 无消息 / 空消息
// ============================================================
describe('边界情况', () => {
  test('空文本 → 返回 null', async () => {
    const event = {
      message: { content: JSON.stringify({ text: '' }), chat_id: 'oc_test_chat' },
      sender: { sender_id: { open_id: 'ou_test_user' } },
    }
    const result = await handleMessage(event)
    expect(result).toBeNull()
  })

  test('无 content → 返回 null', async () => {
    const event = {
      message: { chat_id: 'oc_test_chat' },
      sender: { sender_id: { open_id: 'ou_test_user' } },
    }
    const result = await handleMessage(event)
    expect(result).toBeNull()
  })

  test('无效 JSON content → 返回 null', async () => {
    const event = {
      message: { content: 'not json', chat_id: 'oc_test_chat' },
      sender: { sender_id: { open_id: 'ou_test_user' } },
    }
    const result = await handleMessage(event)
    expect(result).toBeNull()
  })

  test('只带 @_user_ 前缀的消息 → 去掉前缀后处理', async () => {
    understandIntent.mockResolvedValue({
      intent: 'list_projects',
      params: {},
      message: '正在查询',
    })
    callTool.mockResolvedValue([])

    const result = await handleMessage(makeEvent('@_user_1 查看项目'))
    expect(callTool).toHaveBeenCalledWith('list_projects', expect.anything())
  })

  test('项目操作 — session 中有 currentProjectId → 自动使用', async () => {
    understandIntent.mockResolvedValue({
      intent: 'advance_node',
      params: { stageKey: 'requirement', status: 'completed' },
      message: '确认完成',
    })
    getSession.mockReturnValue({ currentProjectId: 'rec_from_session', history: [], pendingAction: null })
    callTool.mockResolvedValue({})

    const result = await handleMessage(makeEvent('需求确认完成了'))
    expect(callTool).toHaveBeenCalledWith('advance_node', expect.objectContaining({
      projectId: 'rec_from_session',
    }))
  })
})
