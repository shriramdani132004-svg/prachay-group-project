import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  ALLOWED_SIGNATURE_MIME_TYPES,
  LocalSignatureStorage,
  assertSignatureSizeWithinLimit,
} from '../../src/modules/signatures/signature-storage.js'
import { ApiError } from '../../src/common/errors/api-error.js'

/** Smallest valid PNG (1x1). */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

let rootDir: string
let storage: LocalSignatureStorage

beforeAll(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pspl-signature-test-'))
  storage = new LocalSignatureStorage(rootDir, 2 * 1024 * 1024)
})

afterAll(async () => {
  await fs.rm(rootDir, { recursive: true, force: true })
})

describe('LocalSignatureStorage.store', () => {
  it('accepts a genuine PNG and returns safe metadata', async () => {
    const result = await storage.store(PNG_BYTES)

    expect(result.mimeType).toBe('image/png')
    expect(result.sizeBytes).toBe(PNG_BYTES.length)
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/)

    // Metadata only: never a filesystem path.
    expect(result.storageKey).not.toContain(rootDir)
    expect(path.isAbsolute(result.storageKey)).toBe(false)
  })

  it('generates an unpredictable storage name on every call', async () => {
    const a = await storage.store(PNG_BYTES)
    const b = await storage.store(PNG_BYTES)

    expect(a.storageKey).not.toBe(b.storageKey)
    expect(a.sha256).toBe(b.sha256)
  })

  it('derives the extension from the detected content, not the upload name', async () => {
    const result = await storage.store(PNG_BYTES)
    expect(result.storageKey.endsWith('.png')).toBe(true)
  })

  it('rejects an SVG even when it claims to be a PNG', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')

    await expect(storage.store(svg)).rejects.toMatchObject({ status: 415 })
  })

  it('rejects HTML content', async () => {
    const html = Buffer.from('<!DOCTYPE html><html><body>hi</body></html>')

    await expect(storage.store(html)).rejects.toMatchObject({ status: 415 })
  })

  it('rejects a PDF masquerading as an image', async () => {
    const pdf = Buffer.from('%PDF-1.4\n%fake pdf content')

    await expect(storage.store(pdf)).rejects.toMatchObject({ status: 415 })
  })

  it('rejects an executable payload', async () => {
    const exe = Buffer.from('MZ\x90\x00\x03\x00\x00\x00binary')

    await expect(storage.store(exe)).rejects.toMatchObject({ status: 415 })
  })

  it('rejects an empty upload', async () => {
    await expect(storage.store(Buffer.alloc(0))).rejects.toMatchObject({ status: 400 })
  })

  it('rejects a file above the configured maximum size', async () => {
    const small = new LocalSignatureStorage(rootDir, 10)

    await expect(small.store(PNG_BYTES)).rejects.toMatchObject({ status: 413 })
  })

  it('allows exactly the maximum permitted size', async () => {
    const exact = new LocalSignatureStorage(rootDir, PNG_BYTES.length)
    await expect(exact.store(PNG_BYTES)).resolves.toBeDefined()
  })

  it('exposes the allowed MIME types', () => {
    expect([...ALLOWED_SIGNATURE_MIME_TYPES]).toEqual(['image/png', 'image/jpeg', 'image/webp'])
  })
})

describe('LocalSignatureStorage path safety', () => {
  it('blocks directory traversal on read', async () => {
    await expect(storage.read('../../../etc/passwd')).rejects.toBeInstanceOf(ApiError)
  })

  it('blocks absolute path escapes', async () => {
    await expect(storage.read(path.resolve(rootDir, '..', 'escape.png'))).rejects.toBeInstanceOf(
      ApiError,
    )
  })

  it('blocks traversal on delete', async () => {
    await expect(storage.remove('../outside.png')).rejects.toBeInstanceOf(ApiError)
  })

  it('reads back exactly what it stored', async () => {
    const stored = await storage.store(PNG_BYTES)
    const readBack = await storage.read(stored.storageKey)

    expect(readBack.equals(PNG_BYTES)).toBe(true)
  })

  it('removes a stored file and tolerates removing it twice', async () => {
    const stored = await storage.store(PNG_BYTES)

    await storage.remove(stored.storageKey)
    await expect(storage.remove(stored.storageKey)).resolves.toBeUndefined()
  })

  it('writes the file inside the storage root only', async () => {
    const stored = await storage.store(PNG_BYTES)
    const absolute = path.resolve(rootDir, stored.storageKey)

    expect(absolute.startsWith(path.resolve(rootDir))).toBe(true)
    await expect(fs.access(absolute)).resolves.toBeUndefined()
  })
})

describe('assertSignatureSizeWithinLimit', () => {
  it('accepts a size at the limit', () => {
    expect(() => assertSignatureSizeWithinLimit(100, 100)).not.toThrow()
  })

  it('rejects an empty file', () => {
    expect(() => assertSignatureSizeWithinLimit(0, 100)).toThrow(ApiError)
  })

  it('rejects a negative size', () => {
    expect(() => assertSignatureSizeWithinLimit(-1, 100)).toThrow(ApiError)
  })

  it('rejects a size above the limit', () => {
    expect(() => assertSignatureSizeWithinLimit(101, 100)).toThrow(ApiError)
  })
})