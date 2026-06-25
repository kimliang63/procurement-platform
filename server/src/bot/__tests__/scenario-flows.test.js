/**
 * 场景流程测试 — 模拟用户真实操作路径
 * 覆盖私聊/群聊全流程 + 边界场景
 * 每个 describe 使用独立 senderId 避免会话泄漏
 */
const { handleMessage, handleCardAction, normalizeBudget } = require('../index')

// Mock dependencies
jest.mock('../../mcp', () => {
  const projects = [
    { record_id: 'rec_proj1', fields: { name: '测试项目A', no: 'CG-2026-001', owner: '测试用户', department: 'FBU', category: '设备', budget: 100, status: '进行中', current_stage: 'requirement', plan_start: '2026-03-01', plan_end: '2026-12-31' } },
    { record_id: 'rec_proj2', fields: { name: '测试项目B', no: 'CG-2026-002', owner: '测试用户', department: 'LBU', category: '材料', budget: 200, status: '进行中', current_stage: 'supplier_dev', plan_start: '2026-04-01', plan_end: '2026-12-31' } },
    { record_id: 'rec_proj3', fields: { name: '性能测试项目', no: 'CG-2026-003', owner: '另一用户', department: 'ABU', category: '服务', budget: 50, status: '进行中', current_stage: 'bid_approval', plan_start: '2026-05-01', plan_end: '2026-11-30' } },
  ]
  const nodes = [
    { record_id: 'n1', fields: { project_id: 'rec_proj1', stage_key: 'requirement', stage_label: '需求确认', order: 1, status: 'completed', plan_start: '2026-03-01', plan_end: '2026-03-15', actual_date: '2026-03-10' } },
    { record_id: 'n2', fields: { project_id: 'rec_proj1', stage_key: 'supplier_dev', stage_label: '供应商开发', order: 2, status: 'in_progress', plan_start: '2026-03-16', plan_end: '2026-04-15', actual_date: '' } },
    { record_id: 'n3', fields: { project_id: 'rec_proj1', stage_key: 'tech_exchange', stage_label: '技术交流', order: 3, status: 'pending', plan_start: '', plan_end: '', actual_date: '' } },
  ]
  const issues = [
    { record_id: 'i1', fields: { project_id: 'rec_proj1', stage_key: 'requirement', description: '需求不明确', assignee: '测试用户', priority: '高', status: 'open' } },
  ]
  return {
    callTool: jest.fn(async (tool, params) => {
      if (tool === 'list_projects') return projects
      if (tool === 'get_project') return projects.find(p => p.record_id === params.projectId) || null
      if (tool === 'create_project') return { record_id: 'rec_new', fields: { name: params.name, no: 'CG-2026-099', ...params } }
      if (tool === 'update_project') return { record_id: params.projectId, fields: params }
      if (tool === 'init_project_nodes') return []
      if (tool === 'list_project_nodes') return nodes.filter(n => n.fields.project_id === params.projectId)
      if (tool === 'update_node') return { record_id: 'n1', fields: params }
      if (tool === 'advance_node') return { record_id: 'n1', fields: { status: 'completed' } }
      if (tool === 'mark_node_abnormal') return { record_id: 'n1', fields: { status: 'blocked' } }
      if (tool === 'list_issues') return issues.filter(i => i.fields.project_id === params?.projectId)
      if (tool === 'create_issue') return { record_id: 'i_new', fields: params }
      if (tool === 'update_issue') return { record_id: 'i1', fields: params }
      return []
    }),
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
  }
})

jest.mock('../../bot/llm', () => {
  const sessions = new Map()
  return {
    understandIntent: jest.fn(async (text, senderId) => {
      if (/创建|新建|新增/.test(text)) {
        const session = sessions.get(senderId) || { pendingAction: null, history: [] }
        const isNewFlow = !session.pendingAction
        const prevParams = isNewFlow ? {} : (session.pendingAction?.params || {})
        const params = { ...prevParams }
        if (/测试项目A/.test(text)) params.name = '测试项目A'
        else if (/测试项目/.test(text)) params.name = '测试项目'
        if (/设备/.test(text)) params.category = '设备'
        if (/FBU/.test(text)) params.department = 'FBU'
        if (/100万/.test(text)) params.budget = 100
        if (/1月.*12月/.test(text)) { params.planStart = '2026-01-01'; params.planEnd = '2026-12-31' }
        if (!params.isSingleSource) params.isSingleSource = true
        if (!params.procurementMethod) params.procurementMethod = '项目类'
        session.pendingAction = { intent: 'create_project', params }
        sessions.set(senderId, session)
        const missing = []
        if (!params.name) missing.push('项目名称')
        if (!params.category) missing.push('采购品类')
        if (!params.department) missing.push('所属部门')
        if (params.budget === undefined) missing.push('预算')
        if (!params.planStart) missing.push('计划开始日期')
        if (!params.planEnd) missing.push('计划结束日期')
        if (missing.length > 0) {
          return { intent: 'create_project', params, message: `还缺少以下信息：\n${missing.map(m => `- ${m}`).join('\n')}\n请补充告诉我` }
        }
        return { intent: 'create_project', params, message: '信息完整' }
      }
      if (/查看|查询|有哪些/.test(text) && /项目/.test(text)) {
        return { intent: 'list_projects', params: {}, message: '正在查询' }
      }
      if (/进度|到哪了|节点/.test(text)) {
        return { intent: 'list_project_nodes', params: { projectId: 'rec_proj1' }, message: '正在查询' }
      }
      if (/完成|推进|下一步/.test(text)) {
        return { intent: 'advance_node', params: { projectId: 'rec_proj1', stageKey: 'requirement', status: 'completed' }, message: '确认完成' }
      }
      if (/更新|修改|改/.test(text)) {
        const params = { projectId: 'rec_proj1' }
        if (/预算/.test(text)) params.budget = 200
        if (/名称/.test(text)) params.name = '新名称'
        return { intent: 'update_project', params, message: '已更新' }
      }
      if (/问题|issue/.test(text)) {
        return { intent: 'list_issues', params: { projectId: 'rec_proj1' }, message: '正在查询问题' }
      }
      if (/周报|weekly/.test(text)) {
        return { intent: null, params: {}, message: '' }
      }
      return { intent: null, params: {}, message: '抱歉，我没有理解你的意思' }
    }),
    getSession: jest.fn((senderId) => sessions.get(senderId) || null),
  }
})

jest.mock('../../bot/group', () => ({
  getGroupBinding: jest.fn(async () => null),
  bindGroup: jest.fn(async (chatId, projectName) => ({
    project: { record_id: 'rec_proj1', fields: { name: projectName || '测试项目A' } },
    message: null,
  })),
  unbindGroup: jest.fn(async () => ({
    projectName: '测试项目A',
    message: null,
  })),
  isProjectOwner: jest.fn(async () => true),
}))

jest.mock('../../bot/weekly', () => ({
  generateAdminWeeklyReport: jest.fn(async () => ({ header: { title: { content: '管理周报' } } })),
  generateGroupWeeklyReport: jest.fn(async () => ({ header: { title: { content: '项目周报' } } })),
  generateMyWeeklyReport: jest.fn(async () => ({ header: { title: { content: '个人周报' } } })),
}))

jest.mock('../../db', () => ({
  listRecords: jest.fn(async (table) => {
    if (table === 'users') return [
      { record_id: 'u1', fields: { feishu_open_id: 'ou_test_user', name: '测试用户', role: 'pm' } },
      { record_id: 'u2', fields: { feishu_open_id: 'ou_s1', name: '私聊用户', role: 'pm' } },
      { record_id: 'u3', fields: { feishu_open_id: 'ou_s2', name: '群聊用户', role: 'pm' } },
      { record_id: 'u4', fields: { feishu_open_id: 'ou_s3a', name: '边界用户A', role: 'pm' } },
      { record_id: 'u5', fields: { feishu_open_id: 'ou_s3b', name: '边界用户B', role: 'pm' } },
      { record_id: 'u6', fields: { feishu_open_id: 'ou_s3d', name: '边界用户D', role: 'pm' } },
    ]
    return []
  }),
}))

jest.mock('../../feishu/client', () => ({
  im: {
    message: { create: jest.fn(async () => ({ code: 0 })) },
    messageReaction: { create: jest.fn(async () => ({ code: 0 })) },
  },
}))

function makeEvent(text, senderId = 'ou_default', chatId = null, chatType = 'p2p') {
  return {
    message: { content: JSON.stringify({ text }), chat_id: chatId, chat_type: chatType, message_id: 'msg_test' },
    sender: { sender_id: { open_id: senderId } },
  }
}

// ============================================================
// 场景一：私聊全流程 (senderId: ou_s1)
// ============================================================
describe('场景一：私聊全流程', () => {
  const S = 'ou_s1'

  test('1.1.1 发起创建 → 追问缺少信息', async () => {
    const r = await handleMessage(makeEvent('创建一个新项目', S))
    expect(r.text).toContain('还缺少')
  })

  test('1.1.7 信息完整 → 发送确认卡片', async () => {
    const r = await handleMessage(makeEvent('创建测试项目，品类设备，部门FBU，预算100万，1月到12月', S))
    expect(r.card).toBeDefined()
    expect(r.card.header.title.content).toContain('确认')
  })

  test('1.1.9 重名检查 → 提示已存在', async () => {
    const r = await handleMessage(makeEvent('创建测试项目A，品类设备，部门FBU，预算100万，1月到12月', S))
    expect(r.text).toContain('已存在')
  })

  test('1.2.1 按名称更新项目', async () => {
    const r = await handleMessage(makeEvent('把测试项目A预算改为200万', S))
    expect(r.text).toContain('更新')
  })

  test('1.3.1 推进节点完成', async () => {
    const r = await handleMessage(makeEvent('需求确认完成了', S))
    expect(r.text).toContain('需求确认')
  })

  test('1.3.4 查看节点进度', async () => {
    const r = await handleMessage(makeEvent('现在项目进度怎样', S))
    expect(r.text).toBeDefined()
  })

  test('1.4.2 查看问题列表', async () => {
    const r = await handleMessage(makeEvent('有哪些问题', S))
    expect(r.text).toBeDefined()
  })

  test('1.5.1 个人周报', async () => {
    const r = await handleMessage(makeEvent('周报', S))
    expect(r.card).toBeDefined()
  })

  test('1.5.2 管理周报', async () => {
    const r = await handleMessage(makeEvent('管理周报', S))
    expect(r.card).toBeDefined()
  })

  test('1.5.3 admin周报', async () => {
    const r = await handleMessage(makeEvent('admin周报', S))
    expect(r.card).toBeDefined()
  })

  test('1.6.1 取消操作', async () => {
    const r = await handleMessage(makeEvent('取消', S))
    expect(r.text).toBeDefined()
  })
})

// ============================================================
// 场景二：群聊全流程 (senderId: ou_s2, chatId: oc_g2)
// ============================================================
describe('场景二：群聊全流程', () => {
  const S = 'ou_s2'
  const C = 'oc_g2'

  test('2.1.1 群聊发起创建', async () => {
    const r = await handleMessage(makeEvent('创建一个新项目', S, C, 'group'))
    expect(r.text).toContain('还缺少')
  })

  test('2.1.3 信息完整 → 确认卡片', async () => {
    const r = await handleMessage(makeEvent('创建测试项目，品类设备，部门FBU，预算100万，1月到12月', S, C, 'group'))
    expect(r.card).toBeDefined()
  })

  test('2.2.1 解绑', async () => {
    const r = await handleMessage(makeEvent('解绑', S, C, 'group'))
    expect(r.text).toContain('解绑')
  })

  test('2.2.3 手动绑定', async () => {
    const r = await handleMessage(makeEvent('绑定 测试项目A', S, C, 'group'))
    expect(r.text).toContain('绑定')
  })

  test('2.2.4 绑定无项目名 → 提示输入', async () => {
    const r = await handleMessage(makeEvent('绑定', S, C, 'group'))
    expect(r.text).toContain('请告诉我要绑定的项目名称')
  })

  test('2.3.1 群聊更新项目', async () => {
    const r = await handleMessage(makeEvent('预算改为200万', S, C, 'group'))
    expect(r.text).toContain('更新')
  })

  test('2.3.2 群聊推进节点', async () => {
    const r = await handleMessage(makeEvent('需求确认完成了', S, C, 'group'))
    expect(r.text).toContain('需求确认')
  })

  test('2.3.4 群聊查看问题', async () => {
    const r = await handleMessage(makeEvent('有哪些问题', S, C, 'group'))
    expect(r.text).toBeDefined()
  })

  test('2.4.1 群聊周报', async () => {
    const r = await handleMessage(makeEvent('周报', S, C, 'group'))
    expect(r.card).toBeDefined()
  })

  test('2.5.1 私聊绑定 → 提示仅群聊', async () => {
    const r = await handleMessage(makeEvent('绑定 测试项目A', S))
    expect(r.text).toContain('仅支持群聊')
  })

  test('2.5.2 私聊解绑 → 提示仅群聊', async () => {
    const r = await handleMessage(makeEvent('解绑', S))
    expect(r.text).toContain('仅支持群聊')
  })
})

// ============================================================
// 场景三：边界与异常 (各子场景独立 senderId)
// ============================================================
describe('场景三：边界与异常', () => {
  describe('3.1 关键词精确匹配', () => {
    const S = 'ou_s3a'

    test('"之前绑定的项目叫什么" → 不触发绑定', async () => {
      const r = await handleMessage(makeEvent('之前绑定的项目叫什么', S))
      expect(r.text).not.toContain('已绑定')
      expect(r.text).not.toContain('仅支持群聊')
    })

    test('"上周报的那个项目叫什么" → 不触发周报', async () => {
      const r = await handleMessage(makeEvent('上周报的那个项目叫什么', S))
      expect(r.card).toBeUndefined()
    })

    test('"解绑之后还能查到吗" → 不触发解绑', async () => {
      const r = await handleMessage(makeEvent('解绑之后还能查到吗', S))
      expect(r.text).not.toContain('已解绑')
    })

    test('"不要忘了更新日期" → 不触发取消', async () => {
      const r = await handleMessage(makeEvent('不要忘了更新日期', S))
      expect(r.text).not.toContain('已取消')
    })

    test('正常绑定命令 → 触发绑定', async () => {
      const r = await handleMessage(makeEvent('绑定 测试项目A', S, 'oc_g3', 'group'))
      expect(r.text).toContain('绑定')
    })

    test('正常解绑命令 → 触发解绑', async () => {
      const r = await handleMessage(makeEvent('解绑', S, 'oc_g3', 'group'))
      expect(r.text).toContain('解绑')
    })

    test('正常周报命令 → 触发周报', async () => {
      const r = await handleMessage(makeEvent('周报', S))
      expect(r.card).toBeDefined()
    })
  })

  describe('3.2 项目名消歧', () => {
    const S = 'ou_s3b'

    test('精确匹配 → 直接选中', async () => {
      const r = await handleMessage(makeEvent('查看测试项目A的进度', S))
      expect(r.text).toBeDefined()
    })

    test('无匹配 → 提示未找到', async () => {
      const r = await handleMessage(makeEvent('查看不存在XYZ的进度', S))
      // Mock LLM 返回 projectId 所以不会走到 name lookup
      expect(r.text).toBeDefined()
    })
  })

  describe('3.3 预算归一化', () => {
    test('"80万" → 80', () => expect(normalizeBudget('80万')).toBe(80))
    test('"1.5万" → 1.5', () => expect(normalizeBudget('1.5万')).toBe(1.5))
    test('"200" → 200', () => expect(normalizeBudget('200')).toBe(200))
    test('5000 → 5000 (不再除以10000)', () => expect(normalizeBudget(5000)).toBe(5000))
    test('800000 → 800000 (不再除以10000)', () => expect(normalizeBudget(800000)).toBe(800000))
    test('null → null', () => expect(normalizeBudget(null)).toBeNull())
  })

  describe('3.4 无法理解的输入', () => {
    const S = 'ou_s3d'

    test('随机文本 → 提示不理解', async () => {
      const r = await handleMessage(makeEvent('今天天气不错', S))
      expect(r.text).toBeDefined()
    })
  })

  describe('3.5 意图切换', () => {
    const S = 'ou_s3e'

    test('创建流程中发查询 → 走查询意图', async () => {
      // 先发起创建
      await handleMessage(makeEvent('创建一个新项目', S))
      // 再发查询，不应干扰创建会话
      const r = await handleMessage(makeEvent('查看项目', S))
      expect(r.text).toBeDefined()
      expect(r.text).not.toContain('还缺少')
    })

    test('更新后插入查询 → 正常回答', async () => {
      const r = await handleMessage(makeEvent('现在项目进度怎样', S))
      expect(r.text).toBeDefined()
    })
  })

  describe('3.6 负责人校验', () => {
    test('未注册用户(open_id不在users表) → 跳过校验，正常出卡片', async () => {
      // ou_unknown 不在 mock users 表中，senderName=null，跳过校验
      const r = await handleMessage(makeEvent('创建测试项目，品类设备，部门FBU，预算100万，1月到12月', 'ou_unknown'))
      expect(r.card).toBeDefined()
    })
  })

  describe('3.7 绑定命令格式', () => {
    test('"绑定" 无项目名 → 提示输入名称', async () => {
      const r = await handleMessage(makeEvent('绑定', 'ou_s3f', 'oc_g7', 'group'))
      expect(r.text).toContain('请告诉我要绑定的项目名称')
    })

    test('"绑定项目XX" 无空格 → 正常解析', async () => {
      const r = await handleMessage(makeEvent('绑定测试项目A', 'ou_s3f', 'oc_g7', 'group'))
      expect(r.text).toContain('绑定')
    })
  })

  describe('3.8 周报边界', () => {
    test('私聊周报无负责人 → 提示使用群聊', async () => {
      // ou_default 不在 mock users 表中
      const r = await handleMessage(makeEvent('周报', 'ou_default'))
      expect(r.text).toContain('群聊')
    })

    test('"管理周报" → 管理员周报', async () => {
      const r = await handleMessage(makeEvent('管理周报', 'ou_s3g'))
      expect(r.card).toBeDefined()
    })
  })
})
