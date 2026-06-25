/**
 * E2E 模拟测试：完整对话流程，覆盖所有 Bot 场景
 * mock 外部依赖，直接调用 handleMessage / handleCardAction
 * 模拟真实用户对话序列
 */

jest.mock('../../feishu/client', () => ({
  im: { message: { create: jest.fn().mockResolvedValue({}) } },
}))

jest.mock('../group', () => ({
  getGroupBinding: jest.fn().mockResolvedValue(null),
  bindGroup: jest.fn().mockResolvedValue({ success: true, message: '绑定成功', project: { record_id: 'rec_bound', fields: { name: '绑定项目' } } }),
  unbindGroup: jest.fn().mockResolvedValue({ success: true, projectName: '绑定项目' }),
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
  generateAdminWeeklyReport: jest.fn().mockResolvedValue({ header: { title: { content: '管理周报' } }, elements: [] }),
  generateGroupWeeklyReport: jest.fn().mockResolvedValue({ header: { title: { content: '项目周报' } }, elements: [] }),
  generateMyWeeklyReport: jest.fn().mockResolvedValue({ header: { title: { content: '我的周报' } }, elements: [] }),
}))

jest.mock('../../db', () => ({
  listRecords: jest.fn().mockResolvedValue([
    { record_id: 'u1', fields: { feishu_open_id: 'ou_user1', name: '张三' } },
    { record_id: 'u2', fields: { feishu_open_id: 'ou_user2', name: '李四' } },
  ]),
}))

const { handleMessage, handleCardAction, clearProcessingActions } = require('../index')
const { callTool } = require('../../mcp')
const { understandIntent, getSession } = require('../llm')
const { bindGroup, unbindGroup } = require('../group')
const { generateAdminWeeklyReport, generateGroupWeeklyReport } = require('../weekly')
const client = require('../../feishu/client')

// Helper: 构造消息事件
function msg(text, senderId = 'ou_user1', chatId = 'oc_chat1', chatType = 'group') {
  return {
    message: { content: JSON.stringify({ text }), chat_id: chatId, chat_type: chatType },
    sender: { sender_id: { open_id: senderId } },
  }
}

// Helper: 断言辅助
function expectText(result, expected) {
  expect(result.text || result.card).toBeDefined()
  const text = result.text || JSON.stringify(result.card)
  if (typeof expected === 'string') {
    expect(text).toContain(expected)
  } else {
    expected.forEach(e => expect(text).toContain(e))
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
// 流程 1：创建项目完整对话
// ============================================================
describe('E2E 1. 创建项目完整流程', () => {
  test('多轮对话收集信息 → 确认 → 创建成功', async () => {
    // Step 1: 发起创建
    understandIntent.mockResolvedValueOnce({
      intent: 'create_project', params: {},
      message: '好的，请问项目名称是什么？',
    })
    const r1 = await msg('创建一个新项目')
    expectText(await handleMessage(r1), '项目名称')

    // Step 2: 提供名称
    understandIntent.mockResolvedValueOnce({
      intent: 'create_project', params: { name: '测试E2E项目' },
      message: '品类是什么？',
    })
    const r2 = await msg('测试E2E项目')
    expectText(await handleMessage(r2), '品类')

    // Step 3: 提供品类+部门
    understandIntent.mockResolvedValueOnce({
      intent: 'create_project', params: { name: '测试E2E项目', category: '设备', department: 'FBU' },
      message: '预算多少？',
    })
    const r3 = await msg('设备，FBU部门')
    expectText(await handleMessage(r3), '预算')

    // Step 4: 提供预算+日期
    understandIntent.mockResolvedValueOnce({
      intent: 'create_project', params: { name: '测试E2E项目', category: '设备', department: 'FBU', budget: 150, planStart: '2026-07-01', planEnd: '2026-12-31', isSingleSource: '否', procurementMethod: '项目类' },
      message: '信息完整，请确认',
    })
    const r4 = await msg('预算150万，7月到12月')
    const result4 = await handleMessage(r4)
    expect(result4.card).toBeDefined() // 应弹确认卡片

    // Step 5: 卡片确认创建
    const confirmAction = {
      action: 'confirm_project',
      params: { name: '测试E2E项目', category: '设备', owner: '张三', department: 'FBU', budget: 150, planStart: '2026-07-01', planEnd: '2026-12-31', isSingleSource: '否', procurementMethod: '项目类' },
    }
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      if (tool === 'create_project') return Promise.resolve({ record_id: 'rec_new', fields: { name: '测试E2E项目', no: 'CG-2026-001' } })
      return Promise.resolve({})
    })
    const r5 = await handleCardAction(confirmAction, 'oc_chat1')
    expect(r5.success).toBe(true)
    await new Promise(r => setTimeout(r, 150))

    // 验证 create_project 和 init_project_nodes 都被调用
    expect(callTool).toHaveBeenCalledWith('create_project', expect.any(Object))
    expect(callTool).toHaveBeenCalledWith('init_project_nodes', expect.objectContaining({
      projectId: 'rec_new',
      isSingleSource: '否',
      budget: 150,
      procurementMethod: '项目类',
    }))
    // 验证发送了成功卡片
    expect(client.im.message.create).toHaveBeenCalled()
  })

  test('单一来源项目 → 确认 → 创建成功', async () => {
    understandIntent.mockResolvedValueOnce({
      intent: 'create_project',
      params: { name: '单一来源E2E', category: '服务', department: 'FBU', budget: 30, planStart: '2026-08-01', planEnd: '2026-10-01', isSingleSource: '是', procurementMethod: '框架类' },
      message: '请确认',
    })
    const r = await handleMessage(msg('创建单一来源项目，服务类，30万'))
    expect(r.card).toBeDefined()

    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      if (tool === 'create_project') return Promise.resolve({ record_id: 'rec_ss', fields: { name: '单一来源E2E' } })
      return Promise.resolve({})
    })
    const r2 = await handleCardAction({ action: 'confirm_project', params: { name: '单一来源E2E', category: '服务', owner: '张三', budget: 30, isSingleSource: '是', procurementMethod: '框架类' } }, 'oc_chat1')
    await new Promise(r => setTimeout(r, 150))
    expect(callTool).toHaveBeenCalledWith('init_project_nodes', expect.objectContaining({ isSingleSource: '是', budget: 30 }))
  })

  test('取消创建 → 操作取消', async () => {
    understandIntent.mockResolvedValueOnce({
      intent: null, params: {}, message: '已取消操作',
    })
    const r = await handleMessage(msg('取消'))
    expectText(r, '已取消')
  })
})

// ============================================================
// 流程 2：查询项目 + 节点
// ============================================================
describe('E2E 2. 查询项目和节点', () => {
  test('查看项目列表 → 显示所有项目', async () => {
    understandIntent.mockResolvedValueOnce({ intent: 'list_projects', params: {}, message: '查询中' })
    callTool.mockResolvedValueOnce([
      { record_id: 'r1', fields: { name: '项目A', current_stage: 'requirement', status: '进行中' } },
      { record_id: 'r2', fields: { name: '项目B', current_stage: 'bid_determine', status: '项目完成' } },
    ])
    const r = await handleMessage(msg('查看项目'))
    expectText(r, ['共 2 个项目', '项目A', '项目B'])
  })

  test('查看项目详情 → 显示完整信息', async () => {
    understandIntent.mockResolvedValueOnce({ intent: 'get_project', params: { name: '项目A' }, message: '查询中' })
    callTool.mockResolvedValueOnce({
      record_id: 'r1',
      fields: { name: '项目A', no: 'CG-2026-001', owner: '张三', department: 'FBU', category: '设备', budget: 100, plan_start: '2026-01-01', plan_end: '2026-12-31', current_stage: 'requirement', status: '进行中' },
    })
    const r = await handleMessage(msg('查看项目A详情'))
    expectText(r, ['项目A', 'CG-2026-001', '张三', '需求确认'])
  })

  test('查看节点列表 → 显示所有节点状态', async () => {
    understandIntent.mockResolvedValueOnce({ intent: 'list_project_nodes', params: { name: '项目A' }, message: '查询中' })
    callTool.mockResolvedValueOnce([
      { fields: { stage_key: 'requirement', status: 'completed', actual_date: '2026-01-15' } },
      { fields: { stage_key: 'supplier_dev', status: 'in_progress' } },
      { fields: { stage_key: 'tech_exchange', status: 'pending' } },
    ])
    const r = await handleMessage(msg('查看项目A的节点'))
    expectText(r, ['需求确认', '供应商开发', '技术交流'])
  })
})

// ============================================================
// 流程 3：节点操作（推进/更新/异常）
// ============================================================
describe('E2E 3. 节点操作', () => {
  test('标记节点完成 → 显示下一阶段', async () => {
    understandIntent.mockResolvedValueOnce({
      intent: 'advance_node', params: { stageKey: 'requirement', status: 'completed' }, message: '确认完成',
    })
    callTool.mockResolvedValueOnce({})
    const r = await handleMessage(msg('需求确认完成了'))
    expectText(r, ['需求确认', '已完成'])
  })

  test('更新节点日期', async () => {
    understandIntent.mockResolvedValueOnce({
      intent: 'update_node', params: { stageKey: 'bid_determine', plan_end: '2026-08-15' }, message: '已更新',
    })
    const r = await handleMessage(msg('定标截止日期改为8月15号'))
    expectText(r, '已更新')
    expect(callTool).toHaveBeenCalledWith('update_node', expect.objectContaining({ stageKey: 'bid_determine', plan_end: '2026-08-15' }))
  })

  test('标记异常', async () => {
    understandIntent.mockResolvedValueOnce({
      intent: 'mark_node_abnormal', params: { stageKey: 'supplier_dev', reason: '供应商延迟' }, message: '标记异常',
    })
    callTool.mockResolvedValueOnce({})
    const r = await handleMessage(msg('供应商开发出问题了'))
    expectText(r, ['供应商开发', '异常'])
  })

  test('连续操作：更新日期 → 标记完成', async () => {
    // Step 1: 更新日期
    understandIntent.mockResolvedValueOnce({
      intent: 'update_node', params: { stageKey: 'requirement', plan_end: '2026-07-15' }, message: '已更新',
    })
    const r1 = await handleMessage(msg('需求确认截止日期改为7月15号'))
    expectText(r1, '已更新')

    // Step 2: 标记完成
    understandIntent.mockResolvedValueOnce({
      intent: 'advance_node', params: { stageKey: 'requirement', status: 'completed' }, message: '确认完成',
    })
    callTool.mockResolvedValueOnce({})
    const r2 = await handleMessage(msg('需求确认完成了'))
    expectText(r2, ['需求确认', '已完成'])
  })
})

// ============================================================
// 流程 4：问题管理
// ============================================================
describe('E2E 4. 问题管理', () => {
  test('创建问题 → 更新问题 → 查看列表', async () => {
    // 创建
    understandIntent.mockResolvedValueOnce({
      intent: 'create_issue', params: { stageKey: 'bid_determine', description: '价格有争议', priority: '高' }, message: '问题已创建',
    })
    callTool.mockResolvedValueOnce({ record_id: 'issue_1' })
    const r1 = await handleMessage(msg('定标价格有争议'))
    expect(r1.text).toBeDefined()

    // 更新
    understandIntent.mockResolvedValueOnce({
      intent: 'update_issue', params: { issueId: 'issue_1', status: 'closed' }, message: '已关闭',
    })
    const r2 = await handleMessage(msg('把问题关闭'))
    expect(r2.text).toBeDefined()

    // 查看列表
    understandIntent.mockResolvedValueOnce({ intent: 'list_issues', params: {}, message: '查询中' })
    callTool.mockResolvedValueOnce([
      { record_id: 'issue_1', fields: { title: '价格争议', status: 'closed', priority: '高' } },
    ])
    const r3 = await handleMessage(msg('查看问题'))
    expect(r3.text).toBeDefined()
  })
})

// ============================================================
// 流程 5：周报
// ============================================================
describe('E2E 5. 周报', () => {
  test('群聊发周报 → 生成群周报', async () => {
    const r = await handleMessage(msg('周报'))
    expect(generateGroupWeeklyReport).toHaveBeenCalledWith('oc_chat1')
  })

  test('管理周报 → 生成管理周报卡片', async () => {
    const r = await handleMessage(msg('管理周报'))
    expect(generateAdminWeeklyReport).toHaveBeenCalled()
    expect(r.card).toBeDefined()
  })

  test('私聊发周报 → 生成个人周报', async () => {
    const r = await handleMessage({ message: { content: JSON.stringify({ text: '周报' }), chat_type: 'p2p' }, sender: { sender_id: { open_id: 'ou_user1' } } })
    expect(r.card).toBeDefined()
  })
})

// ============================================================
// 流程 6：绑定/解绑群
// ============================================================
describe('E2E 6. 绑定解绑群', () => {
  test('绑定项目 → 成功', async () => {
    const r = await handleMessage(msg('绑定 绑定项目'))
    expect(bindGroup).toHaveBeenCalledWith('oc_chat1', '绑定项目', 'ou_user1')
    expectText(r, '绑定成功')
  })

  test('解绑 → 成功', async () => {
    const r = await handleMessage(msg('解绑'))
    expect(unbindGroup).toHaveBeenCalledWith('oc_chat1')
    expectText(r, '已解绑')
  })

  test('绑定无项目名 → 追问', async () => {
    const r = await handleMessage(msg('绑定'))
    expectText(r, '请告诉我要绑定的项目名称')
  })

  test('绑定不存在的项目 → 提示', async () => {
    bindGroup.mockResolvedValueOnce({ success: false, message: '未找到项目"不存在的项目"' })
    const r = await handleMessage(msg('绑定 不存在的项目'))
    expectText(r, '未找到项目')
  })

  test('解绑未绑定的群 → 提示', async () => {
    unbindGroup.mockResolvedValueOnce({ success: false, message: '当前群未绑定任何项目' })
    const r = await handleMessage(msg('解绑'))
    expectText(r, '未绑定')
  })
})

// ============================================================
// 流程 7：交叉对话（多意图混搭）
// ============================================================
describe('E2E 7. 交叉对话', () => {
  test('创建项目 → 查询项目 → 绑定群 → 发周报', async () => {
    // 创建项目
    understandIntent.mockResolvedValueOnce({
      intent: 'create_project',
      params: { name: '交叉E2E', category: '设备', owner: '张三', department: 'FBU', budget: 100, planStart: '2026-07-01', planEnd: '2026-12-31', isSingleSource: '否', procurementMethod: '项目类' },
      message: '请确认',
    })
    const r1 = await handleMessage(msg('创建交叉E2E项目，设备，FBU，100万，7月到12月'))
    expect(r1.card).toBeDefined()

    // 查询项目
    understandIntent.mockResolvedValueOnce({ intent: 'list_projects', params: {}, message: '查询中' })
    callTool.mockResolvedValueOnce([
      { record_id: 'r1', fields: { name: '交叉E2E', current_stage: 'requirement', status: '进行中' } },
    ])
    const r2 = await handleMessage(msg('查看项目'))
    expectText(r2, '交叉E2E')

    // 绑定群
    const r3 = await handleMessage(msg('绑定 交叉E2E'))
    expectText(r3, '绑定成功')

    // 发周报
    const r4 = await handleMessage(msg('周报'))
    expect(generateGroupWeeklyReport).toHaveBeenCalled()
  })

  test('查询节点 → 更新日期 → 标记完成 → 标记异常', async () => {
    // 查询节点
    understandIntent.mockResolvedValueOnce({ intent: 'list_project_nodes', params: {}, message: '查询中' })
    callTool.mockResolvedValueOnce([
      { fields: { stage_key: 'requirement', status: 'in_progress' } },
      { fields: { stage_key: 'supplier_dev', status: 'pending' } },
    ])
    const r1 = await handleMessage(msg('查看节点'))
    expectText(r1, '需求确认')

    // 更新日期
    understandIntent.mockResolvedValueOnce({
      intent: 'update_node', params: { stageKey: 'requirement', plan_end: '2026-07-20' }, message: '已更新',
    })
    const r2 = await handleMessage(msg('需求确认截止日期改为7月20号'))
    expectText(r2, '已更新')

    // 标记完成
    understandIntent.mockResolvedValueOnce({
      intent: 'advance_node', params: { stageKey: 'requirement', status: 'completed' }, message: '确认完成',
    })
    callTool.mockResolvedValueOnce({})
    const r3 = await handleMessage(msg('需求确认完成了'))
    expectText(r3, ['需求确认', '已完成'])

    // 标记异常
    understandIntent.mockResolvedValueOnce({
      intent: 'mark_node_abnormal', params: { stageKey: 'supplier_dev', reason: '供应商延迟' }, message: '标记异常',
    })
    callTool.mockResolvedValueOnce({})
    const r4 = await handleMessage(msg('供应商开发出问题了'))
    expectText(r4, ['供应商开发', '异常'])
  })

  test('纯问答 → 创建项目 → 取消 → 再查询', async () => {
    // 纯问答
    understandIntent.mockResolvedValueOnce({ intent: null, params: {}, message: '支持设备、材料、服务等品类' })
    const r1 = await handleMessage(msg('支持哪些品类'))
    expectText(r1, '设备')

    // 创建项目
    understandIntent.mockResolvedValueOnce({ intent: 'create_project', params: {}, message: '项目名称？' })
    const r2 = await handleMessage(msg('创建一个新项目'))
    expectText(r2, '项目名称')

    // 取消
    understandIntent.mockResolvedValueOnce({ intent: null, params: {}, message: '已取消操作' })
    const r3 = await handleMessage(msg('取消'))
    expectText(r3, '已取消')

    // 再查询
    understandIntent.mockResolvedValueOnce({ intent: 'list_projects', params: {}, message: '查询中' })
    callTool.mockResolvedValueOnce([])
    const r4 = await handleMessage(msg('查看项目'))
    expectText(r4, '没有找到')
  })
})

// ============================================================
// 流程 8：卡片操作（确认/取消/权限）
// ============================================================
describe('E2E 8. 卡片操作', () => {
  test('确认创建 → 异步创建项目 + 初始化节点', async () => {
    callTool.mockImplementation((tool) => {
      if (tool === 'list_projects') return Promise.resolve([])
      if (tool === 'create_project') return Promise.resolve({ record_id: 'rec_card', fields: { name: '卡片项目', no: 'CG-2026-010' } })
      return Promise.resolve({})
    })
    const r = await handleCardAction({
      action: 'confirm_project',
      params: { name: '卡片项目', category: '设备', owner: '张三', department: 'FBU', budget: 80, planStart: '2026-07-01', planEnd: '2026-12-31', isSingleSource: '否', procurementMethod: '项目类' },
    }, 'oc_chat1')
    expect(r.success).toBe(true)
    await new Promise(r => setTimeout(r, 150))
    expect(callTool).toHaveBeenCalledWith('init_project_nodes', expect.objectContaining({ projectId: 'rec_card', budget: 80 }))
  })

  test('取消创建 → 不执行创建', async () => {
    const r = await handleCardAction({ action: 'cancel_project', params: { name: '取消项目' } }, 'oc_chat1')
    expect(r.success).toBe(true)
    expect(callTool).not.toHaveBeenCalledWith('create_project', expect.any(Object))
  })

  test('确认节点完成 → 调用 advance_node', async () => {
    callTool.mockResolvedValueOnce({})
    const r = await handleCardAction({ action: 'confirm_node', project_id: 'rec_proj', stage_key: 'requirement' }, 'oc_chat1')
    expect(callTool).toHaveBeenCalledWith('advance_node', { projectId: 'rec_proj', stageKey: 'requirement', status: 'completed' })
    expect(r.success).toBe(true)
  })

  test('标记异常 → 调用 mark_node_abnormal', async () => {
    callTool.mockResolvedValueOnce({})
    const r = await handleCardAction({ action: 'mark_abnormal', project_id: 'rec_proj', stage_key: 'bid_determine' }, 'oc_chat1')
    expect(callTool).toHaveBeenCalledWith('mark_node_abnormal', expect.objectContaining({ stageKey: 'bid_determine' }))
    expect(r.success).toBe(true)
  })

  test('重复点击同一按钮 → 返回 toast', async () => {
    let resolve
    callTool.mockImplementation(() => new Promise(r => { resolve = r }))
    const action = { action: 'confirm_node', project_id: 'rec_proj', stage_key: 'requirement' }
    const p1 = handleCardAction(action, 'oc_chat1')
    await new Promise(r => setTimeout(r, 50))
    const r2 = await handleCardAction(action, 'oc_chat1')
    expect(r2.toast).toBeDefined()
    expect(r2.toast.content).toContain('正在处理')
    resolve({})
    await p1
  })

  test('非负责人操作 → 拒绝', async () => {
    const { isProjectOwner } = require('../group')
    isProjectOwner.mockResolvedValueOnce(false)
    const r = await handleCardAction({ action: 'confirm_node', project_id: 'rec_proj', stage_key: 'requirement' }, 'oc_chat1', 'ou_other')
    expect(r.toast).toBeDefined()
    expect(r.toast.content).toContain('仅负责人可操作')
  })
})

// ============================================================
// 流程 9：边界情况
// ============================================================
describe('E2E 9. 边界情况', () => {
  test('空消息 → null', async () => {
    const r = await handleMessage({ message: { content: JSON.stringify({ text: '' }) }, sender: { sender_id: { open_id: 'ou_user1' } } })
    expect(r).toBeNull()
  })

  test('无效JSON → null', async () => {
    const r = await handleMessage({ message: { content: 'not json' }, sender: { sender_id: { open_id: 'ou_user1' } } })
    expect(r).toBeNull()
  })

  test('@_user 前缀 → 正常处理', async () => {
    understandIntent.mockResolvedValueOnce({ intent: 'list_projects', params: {}, message: '查询中' })
    callTool.mockResolvedValueOnce([])
    const r = await handleMessage(msg('@_user_1 查看项目'))
    expect(r.text).toContain('没有找到')
  })

  test('LLM 返回无意图 → 默认引导', async () => {
    understandIntent.mockResolvedValueOnce({ intent: null, params: {}, message: null })
    const r = await handleMessage(msg('随便说说'))
    expectText(r, '抱歉')
  })

  test('LLM 返回纯文本 → 直接展示', async () => {
    understandIntent.mockResolvedValueOnce({ intent: null, params: {}, message: '平台支持设备、材料、服务等品类' })
    const r = await handleMessage(msg('支持哪些品类'))
    expectText(r, '设备')
  })

  test('节点操作找不到项目 → 提示', async () => {
    getSession.mockReturnValue({ currentProjectId: null, history: [], pendingAction: null })
    understandIntent.mockResolvedValueOnce({
      intent: 'advance_node', params: { name: '不存在的项目', stageKey: 'requirement' }, message: '完成',
    })
    callTool.mockResolvedValueOnce([])
    const r = await handleMessage(msg('不存在的项目需求确认完成了'))
    expectText(r, '未找到项目')
  })
})
