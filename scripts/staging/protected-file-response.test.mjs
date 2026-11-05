import { describe, expect, it } from 'vitest'
import {
  allowedFileTypes,
  protectedFileResponse,
  storedFileType,
} from '../../supabase/functions/_shared/protected-file-response.mjs'

describe('protected file response', () => {
  it('returns opaque, uncached bytes and exposes only the stored type', async () => {
    const response = protectedFileResponse('fictional', 'application/pdf', {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/octet-stream')
    expect(response.headers.get('Content-Disposition')).toBe('attachment')
    expect(response.headers.get('Cache-Control')).toBe('no-store, private')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('X-Dexam-File-Type')).toBe('application/pdf')
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('X-Dexam-File-Type')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(await response.text()).toBe('fictional')
  })

  it('never forwards an unexpected stored type', () => {
    for (const type of allowedFileTypes)
      expect(storedFileType(`${type}; charset=binary`)).toBe(type)
    for (const type of ['text/html', 'image/svg+xml', 'application/javascript', '', null, 7])
      expect(storedFileType(type)).toBe('application/octet-stream')
  })
})
