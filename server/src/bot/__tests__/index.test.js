const { normalizeBudget, validateDates } = require('../index')

describe('normalizeBudget', () => {
  test('passes through null/undefined', () => {
    expect(normalizeBudget(null)).toBeNull()
    expect(normalizeBudget(undefined)).toBeUndefined()
  })

  test('parses "80万" string to 80', () => {
    expect(normalizeBudget('80万')).toBe(80)
  })

  test('parses plain number string', () => {
    expect(normalizeBudget('200')).toBe(200)
  })

  test('passes through small numbers as-is', () => {
    expect(normalizeBudget(50)).toBe(50)
    expect(normalizeBudget(100)).toBe(100)
  })

  test('passes through raw numbers as-is (assumed 万)', () => {
    expect(normalizeBudget(800000)).toBe(800000)
    expect(normalizeBudget(5000)).toBe(5000)
  })

  test('handles decimal values', () => {
    expect(normalizeBudget('1.5万')).toBe(1.5)
  })
})

describe('validateDates', () => {
  test('returns null when dates are valid', () => {
    expect(validateDates({ planStart: '2026-01-01', planEnd: '2026-12-31' })).toBeNull()
  })

  test('returns error when end is before start', () => {
    const result = validateDates({ planStart: '2026-12-31', planEnd: '2026-01-01' })
    expect(result).toBe('计划结束日期不能早于开始日期')
  })

  test('returns null when only start is provided', () => {
    expect(validateDates({ planStart: '2026-01-01' })).toBeNull()
  })

  test('returns null when no dates provided', () => {
    expect(validateDates({})).toBeNull()
  })

  test('returns null when dates are equal', () => {
    expect(validateDates({ planStart: '2026-06-15', planEnd: '2026-06-15' })).toBeNull()
  })
})
