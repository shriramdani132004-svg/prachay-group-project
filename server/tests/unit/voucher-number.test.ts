import { describe, expect, it } from 'vitest'
import {
  formatVoucherNumber,
  parseVoucherNumber,
} from '../../src/modules/vouchers/voucher-number.service.js'

describe('formatVoucherNumber', () => {
  it('zero-pads the sequence to six digits', () => {
    expect(formatVoucherNumber(1n, 2026)).toBe('VCH-2026-000001')
    expect(formatVoucherNumber(42n, 2026)).toBe('VCH-2026-000042')
    expect(formatVoucherNumber(999999n, 2026)).toBe('VCH-2026-999999')
  })

  it('does not truncate sequences wider than six digits', () => {
    expect(formatVoucherNumber(1000000n, 2026)).toBe('VCH-2026-1000000')
  })

  it('accepts plain numbers as well as bigints', () => {
    expect(formatVoucherNumber(7, 2026)).toBe('VCH-2026-000007')
  })

  it('uses the supplied year', () => {
    expect(formatVoucherNumber(1n, 2027)).toBe('VCH-2027-000001')
  })
})

describe('parseVoucherNumber', () => {
  it('round-trips a formatted number', () => {
    expect(parseVoucherNumber('VCH-2026-000042')).toEqual({ year: 2026, sequence: 42 })
  })

  it('returns null for malformed input', () => {
    expect(parseVoucherNumber('nonsense')).toBeNull()
    expect(parseVoucherNumber('VCH-26-1')).toBeNull()
    expect(parseVoucherNumber('VCH-2026-abc')).toBeNull()
    expect(parseVoucherNumber('EXP-2026-000001')).toBeNull()
  })
})