const { extractJson, parseFromPlainText } = require('../llm')

describe('extractJson', () => {
  test('parses valid JSON string', () => {
    const result = extractJson('{"intent": "create_project", "params": {}, "message": "ok"}')
    expect(result).toEqual({ intent: 'create_project', params: {}, message: 'ok' })
  })

  test('extracts JSON wrapped in markdown code block', () => {
    const input = '```json\n{"intent": "list_projects", "params": {}}\n```'
    const result = extractJson(input)
    expect(result).toEqual({ intent: 'list_projects', params: {} })
  })

  test('extracts JSON mixed in text', () => {
    const input = 'Here is the result: {"intent": "get_project", "params": {"name": "test"}} done.'
    const result = extractJson(input)
    expect(result).toEqual({ intent: 'get_project', params: { name: 'test' } })
  })

  test('returns null for plain text with no JSON', () => {
    const result = extractJson('This is just a normal text response with no JSON.')
    expect(result).toBeNull()
  })

  test('returns null for empty string', () => {
    expect(extractJson('')).toBeNull()
  })

  test('handles nested JSON objects', () => {
    const input = '{"intent": "create_project", "params": {"name": "测试", "budget": 100}}'
    const result = extractJson(input)
    expect(result.params.name).toBe('测试')
    expect(result.params.budget).toBe(100)
  })
})

describe('parseFromPlainText', () => {
  test('extracts category from LLM response with 采购品类', () => {
    const text = '采购品类为设备，请问预算是多少？'
    const result = parseFromPlainText(text, {}, '创建项目')
    expect(result).not.toBeNull()
    expect(result.intent).toBe('create_project')
    expect(result.params.category).toBe('设备')
  })

  test('extracts category from markdown bold format', () => {
    const text = '**采购品类**: 设备\n**所属部门**: FBU'
    const result = parseFromPlainText(text, {}, '创建项目')
    expect(result).not.toBeNull()
    expect(result.params.category).toBe('设备')
    expect(result.params.department).toBe('FBU')
  })

  test('extracts department (FBU/LBU/ABU)', () => {
    const text = '所属部门为LBU'
    const result = parseFromPlainText(text, {}, '新建项目')
    expect(result).not.toBeNull()
    expect(result.params.department).toBe('LBU')
  })

  test('extracts budget in 万', () => {
    const text = '预算为200万'
    const result = parseFromPlainText(text, {}, '创建')
    expect(result).not.toBeNull()
    expect(result.params.budget).toBe(200)
  })

  test('extracts dates', () => {
    const text = '计划开始日期为2026-03-01，结束日期为2026-12-31'
    const result = parseFromPlainText(text, {}, '创建项目')
    expect(result).not.toBeNull()
    expect(result.params.planStart).toBe('2026-03-01')
    expect(result.params.planEnd).toBe('2026-12-31')
  })

  test('merges with existing pendingParams', () => {
    const pending = { name: '测试项目', category: '设备' }
    const text = '所属部门为ABU，预算500万'
    const result = parseFromPlainText(text, pending, '创建项目')
    expect(result).not.toBeNull()
    expect(result.params.name).toBe('测试项目')
    expect(result.params.category).toBe('设备')
    expect(result.params.department).toBe('ABU')
    expect(result.params.budget).toBe(500)
  })

  test('returns null when no params extracted', () => {
    const text = '这是一个普通回答，没有任何参数信息'
    const result = parseFromPlainText(text, {}, '查看项目')
    expect(result).toBeNull()
  })

  test('returns null when no create intent in user message', () => {
    const text = '采购品类为设备'
    const result = parseFromPlainText(text, {}, '现在有哪些项目')
    expect(result).toBeNull()
  })

  test('extracts owner from 负责人 pattern', () => {
    const text = '负责人是梁景悦'
    const result = parseFromPlainText(text, { name: '测试', category: '设备' }, '创建项目')
    expect(result).not.toBeNull()
    expect(result.params.owner).toBe('梁景悦')
  })

  test('short text "我" in create flow sets owner', () => {
    const pending = { name: '测试', category: '服务', budget: 200 }
    const result = parseFromPlainText('我', pending, '创建项目')
    expect(result).not.toBeNull()
    expect(result.intent).toBe('create_project')
    expect(result.params.owner).toBe('我')
  })

  test('short text ignored when not in create flow', () => {
    const result = parseFromPlainText('我', {}, '现在有哪些项目')
    expect(result).toBeNull()
  })

  test('returns create_project when pendingParams has name (active flow)', () => {
    const pending = { name: '测试项目' }
    const text = '品类为材料'
    const result = parseFromPlainText(text, pending, '材料')
    expect(result).not.toBeNull()
    expect(result.intent).toBe('create_project')
    expect(result.params.category).toBe('材料')
  })
})
