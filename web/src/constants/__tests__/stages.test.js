import { STAGE_MAP, STAGE_KEYS, STAGE_OPTIONS, NODE_STATUS_COLORS } from '../stages'

describe('STAGE_MAP', () => {
  test('has 15 stages', () => {
    expect(Object.keys(STAGE_MAP)).toHaveLength(15)
  })

  test('first stage is requirement', () => {
    expect(STAGE_MAP.requirement).toBe('需求确认')
  })

  test('last stage is acceptance', () => {
    expect(STAGE_MAP.acceptance).toBe('验收')
  })

  test('all values are non-empty strings', () => {
    Object.values(STAGE_MAP).forEach(v => {
      expect(typeof v).toBe('string')
      expect(v.length).toBeGreaterThan(0)
    })
  })
})

describe('STAGE_KEYS', () => {
  test('has 15 entries matching STAGE_MAP', () => {
    expect(STAGE_KEYS).toHaveLength(15)
    expect(STAGE_KEYS).toEqual(Object.keys(STAGE_MAP))
  })

  test('starts with requirement, ends with acceptance', () => {
    expect(STAGE_KEYS[0]).toBe('requirement')
    expect(STAGE_KEYS[14]).toBe('acceptance')
  })
})

describe('STAGE_OPTIONS', () => {
  test('has 15 entries', () => {
    expect(STAGE_OPTIONS).toHaveLength(15)
  })

  test('each entry has value and label', () => {
    STAGE_OPTIONS.forEach(opt => {
      expect(opt).toHaveProperty('value')
      expect(opt).toHaveProperty('label')
    })
  })

  test('values match STAGE_KEYS', () => {
    expect(STAGE_OPTIONS.map(o => o.value)).toEqual(STAGE_KEYS)
  })

  test('labels match STAGE_MAP values', () => {
    STAGE_OPTIONS.forEach(opt => {
      expect(opt.label).toBe(STAGE_MAP[opt.value])
    })
  })
})

describe('NODE_STATUS_COLORS', () => {
  test('has all 5 status colors', () => {
    expect(Object.keys(NODE_STATUS_COLORS)).toHaveLength(5)
    expect(NODE_STATUS_COLORS).toHaveProperty('completed')
    expect(NODE_STATUS_COLORS).toHaveProperty('in_progress')
    expect(NODE_STATUS_COLORS).toHaveProperty('pending')
    expect(NODE_STATUS_COLORS).toHaveProperty('blocked')
    expect(NODE_STATUS_COLORS).toHaveProperty('overdue')
  })

  test('all colors are valid hex', () => {
    Object.values(NODE_STATUS_COLORS).forEach(color => {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
    })
  })

  test('blocked and overdue are both red', () => {
    expect(NODE_STATUS_COLORS.blocked).toBe('#ff4d4f')
    expect(NODE_STATUS_COLORS.overdue).toBe('#ff4d4f')
  })
})
