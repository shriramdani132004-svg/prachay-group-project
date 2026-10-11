import { describe, expect, it } from 'vitest'
import {
  amountSchema,
  createVoucherSchema,
  isoDateSchema,
  rejectVoucherSchema,
  uuidSchema,
} from '../../src/common/validation/schemas.js'

const VALID_UUID = '3f8c1d2e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'

describe('isoDateSchema', () => {
  it('accepts a real ISO calendar date', () => {
    expect(isoDateSchema.parse('2026-10-10')).toBe('2026-10-10')
  })

  it('rejects an impossible calendar date that Date would silently roll over', () => {
    expect(() => isoDateSchema.parse('2026-02-31')).toThrow()
  })

  it('rejects ambiguous non-ISO formats', () => {
    expect(() => isoDateSchema.parse('10/10/2026')).toThrow()
    expect(() => isoDateSchema.parse('10-10-2026')).toThrow()
  })

  it('rejects a month outside the valid range', () => {
    expect(() => isoDateSchema.parse('2026-13-01')).toThrow()
    expect(() => isoDateSchema.parse('2026-00-10')).toThrow()
  })

  it('rejects an empty string', () => {
    expect(() => isoDateSchema.parse('')).toThrow()
  })
})

describe('amountSchema', () => {
  it('accepts a positive decimal number', () => {
    expect(amountSchema.parse(45000.5)).toBe(45000.5)
  })

  it('accepts a decimal string', () => {
    expect(amountSchema.parse('45000.50')).toBe(45000.5)
  })

  it('rejects zero and negative amounts', () => {
    expect(() => amountSchema.parse(0)).toThrow()
    expect(() => amountSchema.parse(-1)).toThrow()
    expect(() => amountSchema.parse('-0.01')).toThrow()
  })

  it('rejects more than two decimal places', () => {
    expect(() => amountSchema.parse('10.005')).toThrow(/2 decimal places/)
  })

  it('rejects non-numeric input', () => {
    expect(() => amountSchema.parse('abc')).toThrow()
    expect(() => amountSchema.parse(Number.NaN)).toThrow()
  })

  it('rejects amounts beyond the NUMERIC(12,2) ceiling', () => {
    expect(() => amountSchema.parse(10_000_000_000)).toThrow()
  })
})

describe('uuidSchema', () => {
  it('accepts a UUID', () => {
    expect(uuidSchema.parse(VALID_UUID)).toBe(VALID_UUID)
  })

  it('rejects arbitrary strings', () => {
    expect(() => uuidSchema.parse('not-a-uuid')).toThrow()
    expect(() => uuidSchema.parse('1; DROP TABLE users')).toThrow()
  })
})

describe('createVoucherSchema', () => {
  const valid = {
    departmentId: VALID_UUID,
    expenseTitle: 'Client Meeting - Mumbai',
    expenseCategoryId: VALID_UUID,
    expenseDate: '2026-10-10',
    amount: 45000,
  }

  it('accepts a minimal valid payload', () => {
    expect(createVoucherSchema.parse(valid)).toMatchObject({ amount: 45000 })
  })

  it('requires department, title, category, date and amount', () => {
    const result = createVoucherSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects a blank title', () => {
    expect(() => createVoucherSchema.parse({ ...valid, expenseTitle: '   ' })).toThrow()
  })

  it('rejects an over-long title', () => {
    expect(() => createVoucherSchema.parse({ ...valid, expenseTitle: 'x'.repeat(161) })).toThrow()
  })

  it('rejects an over-long description', () => {
    expect(() =>
      createVoucherSchema.parse({ ...valid, expenseDescription: 'x'.repeat(4001) }),
    ).toThrow()
  })

  it('treats an empty description as undefined', () => {
    const parsed = createVoucherSchema.parse({ ...valid, expenseDescription: '' })
    expect(parsed.expenseDescription).toBeUndefined()
  })

  it('ignores unknown extra fields rather than trusting them', () => {
    const parsed = createVoucherSchema.parse({ ...valid, status: 'APPROVED', amount: 10 })
    expect(parsed).not.toHaveProperty('status')
  })
})

describe('rejectVoucherSchema', () => {
  it('requires a substantive reason', () => {
    expect(() => rejectVoucherSchema.parse({ reason: 'no' })).toThrow()
    expect(() => rejectVoucherSchema.parse({ reason: '   ' })).toThrow()
    expect(() => rejectVoucherSchema.parse({})).toThrow()
  })

  it('accepts a meaningful reason', () => {
    expect(rejectVoucherSchema.parse({ reason: 'Missing the original invoice.' })).toEqual({
      reason: 'Missing the original invoice.',
    })
  })
})