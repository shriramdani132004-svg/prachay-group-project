import { describe, expect, it } from 'vitest'
import {
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizePagination,
} from '../../src/common/pagination/pagination.js'
import { ApiError } from '../../src/common/errors/api-error.js'

const SORTABLE = ['name', 'code', 'createdAt'] as const

describe('normalizePagination', () => {
  it('applies defaults when no parameters are supplied', () => {
    const result = normalizePagination({}, SORTABLE, 'name')

    expect(result.page).toBe(DEFAULT_PAGE)
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE)
    expect(result.sortBy).toBe('name')
    expect(result.sortOrder).toBe('desc')
  })

  it('coerces numeric strings from query parameters', () => {
    const result = normalizePagination(
      { page: '3', pageSize: '25' },
      SORTABLE,
      'name',
    )

    expect(result.page).toBe(3)
    expect(result.pageSize).toBe(25)
    expect(result.skip).toBe(50)
    expect(result.take).toBe(25)
  })

  it('rejects non-numeric parameters', () => {
    expect(() => normalizePagination({ page: 'abc' }, SORTABLE, 'name')).toThrow(ApiError)
  })

  it('rejects zero and negative page values', () => {
    expect(() => normalizePagination({ page: '0' }, SORTABLE, 'name')).toThrow(/page/i)
    expect(() => normalizePagination({ page: '-2' }, SORTABLE, 'name')).toThrow(/page/i)
  })

  it('rejects zero and negative page sizes', () => {
    expect(() => normalizePagination({ pageSize: '0' }, SORTABLE, 'name')).toThrow(/pageSize/i)
    expect(() => normalizePagination({ pageSize: '-10' }, SORTABLE, 'name')).toThrow(/pageSize/i)
  })

  it('accepts the maximum page size', () => {
    const result = normalizePagination({ pageSize: String(MAX_PAGE_SIZE) }, SORTABLE, 'name')
    expect(result.pageSize).toBe(MAX_PAGE_SIZE)
  })

  it('rejects a page size above the maximum', () => {
    expect(() =>
      normalizePagination({ pageSize: String(MAX_PAGE_SIZE + 1) }, SORTABLE, 'name'),
    ).toThrow(/pageSize/i)
  })

  it('accepts both valid sort directions', () => {
    expect(normalizePagination({ sortOrder: 'asc' }, SORTABLE, 'name').sortOrder).toBe('asc')
    expect(normalizePagination({ sortOrder: 'desc' }, SORTABLE, 'name').sortOrder).toBe('desc')
  })

  it('rejects an invalid sort direction', () => {
    expect(() => normalizePagination({ sortOrder: 'sideways' }, SORTABLE, 'name')).toThrow(
      /sortOrder/i,
    )
  })

  it('rejects a sort field that is not on the allow-list', () => {
    expect(() => normalizePagination({ sortBy: 'passwordHash' }, SORTABLE, 'name')).toThrow(
      /sortBy/i,
    )
  })

  it('rejects SQL-injection style sort input', () => {
    expect(() =>
      normalizePagination({ sortBy: 'name; DROP TABLE users' }, SORTABLE, 'name'),
    ).toThrow(/sortBy/i)
  })

  it('raises a validation ApiError carrying per-field issues', () => {
    try {
      normalizePagination({ page: '0', pageSize: '0' }, SORTABLE, 'name')
      expect.unreachable('expected normalizePagination to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      const apiError = error as ApiError
      expect(apiError.status).toBe(400)
      expect(apiError.code).toBe('VALIDATION_FAILED')
      expect(apiError.details?.length).toBeGreaterThan(0)
    }
  })
})

describe('buildPaginationMeta', () => {
  it('computes totals for a partial page', () => {
    const meta = buildPaginationMeta(2, 10, 25)

    expect(meta).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    })
  })

  it('reports no next page on the final page', () => {
    const meta = buildPaginationMeta(3, 10, 25)
    expect(meta.hasNextPage).toBe(false)
    expect(meta.hasPreviousPage).toBe(true)
  })

  it('handles an empty result set', () => {
    const meta = buildPaginationMeta(1, 20, 0)
    expect(meta.totalPages).toBe(0)
    expect(meta.hasNextPage).toBe(false)
    expect(meta.hasPreviousPage).toBe(false)
  })
})