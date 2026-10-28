import { previewSearch } from './previewSearch'

describe('previewSearch', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('keeps only the preview flag when the build enables preview', () => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    expect(previewSearch('?preview=1&x=<script>')).toBe('?preview=1')
    expect(previewSearch('?preview=0')).toBe('')
    expect(previewSearch('')).toBe('')
  })

  it('ignores ?preview=1 when the build does not enable preview', () => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'false')
    expect(previewSearch('?preview=1')).toBe('')
  })
})
