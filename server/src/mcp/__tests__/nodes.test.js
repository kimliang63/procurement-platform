const { STAGE_MAP, STAGE_KEYS } = require('../nodes')

describe('STAGE_MAP', () => {
  test('has 13 stages in correct order', () => {
    expect(STAGE_KEYS).toHaveLength(13)
    expect(STAGE_KEYS[0]).toBe('requirement')
    expect(STAGE_KEYS[12]).toBe('shipping')
  })

  test('each stage has label and order', () => {
    for (const [key, info] of Object.entries(STAGE_MAP)) {
      expect(info.label).toBeDefined()
      expect(info.order).toBeDefined()
      expect(typeof info.label).toBe('string')
      expect(typeof info.order).toBe('number')
    }
  })

  test('orders are sequential from 1 to 13', () => {
    const orders = Object.values(STAGE_MAP).map(s => s.order).sort((a, b) => a - b)
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })

  test('all labels are Chinese', () => {
    for (const info of Object.values(STAGE_MAP)) {
      expect(info.label).toMatch(/[一-鿿]/)
    }
  })
})
