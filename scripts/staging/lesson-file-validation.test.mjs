import { describe, expect, it } from 'vitest'
import {
  boundedBody,
  maxLessonBytes,
  validLessonFile,
} from '../../supabase/functions/_shared/lesson-file-validation.mjs'
describe('trusted lesson file validation', () => {
  const pdf = new TextEncoder().encode('%PDF-1.4 fictional')
  it('accepts matching bounded PDF/image signatures only', () => {
    expect(
      validLessonFile({ name: 'notes.pdf', type: 'application/pdf', size: pdf.length }, pdf),
    ).toBe(true)
    expect(
      validLessonFile(
        { name: 'notes.jpg', type: 'image/jpeg', size: 3 },
        new Uint8Array([255, 216, 255]),
      ),
    ).toBe(true)
    expect(
      validLessonFile(
        { name: 'notes.png', type: 'image/png', size: 8 },
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      ),
    ).toBe(true)
    expect(
      validLessonFile(
        { name: 'notes.webp', type: 'image/webp', size: 12 },
        new TextEncoder().encode('RIFFxxxxWEBP'),
      ),
    ).toBe(true)
  })
  it('rejects executable/disguised types and signature mismatch', () => {
    expect(
      validLessonFile(
        { name: 'notes.pdf', type: 'application/pdf', size: 10 },
        new TextEncoder().encode('<script>'),
      ),
    ).toBe(false)
    expect(
      validLessonFile({ name: 'notes.exe', type: 'application/pdf', size: pdf.length }, pdf),
    ).toBe(false)
    expect(
      validLessonFile({ name: 'notes.svg', type: 'image/svg+xml', size: pdf.length }, pdf),
    ).toBe(false)
  })
  it('rejects unsafe names and oversized or empty bytes', () => {
    for (const name of ['../notes.pdf', 'notes\\file.pdf', 'notes\n.pdf', 'a'.repeat(181) + '.pdf'])
      expect(validLessonFile({ name, type: 'application/pdf', size: pdf.length }, pdf)).toBe(false)
    for (const size of [0, maxLessonBytes + 1])
      expect(validLessonFile({ name: 'notes.pdf', type: 'application/pdf', size }, pdf)).toBe(false)
  })
  it('bounds streamed bodies even without Content-Length', async () => {
    const request = new Request('https://fictional.test', { method: 'POST', body: '12345' })
    await expect(boundedBody(request, 4)).rejects.toThrow('Body too large')
    expect(
      new TextDecoder().decode(
        await boundedBody(
          new Request('https://fictional.test', { method: 'POST', body: '1234' }),
          4,
        ),
      ),
    ).toBe('1234')
  })
})
