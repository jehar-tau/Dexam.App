import { maxMaterialBytes, validateMaterialFile } from './contentWorkspace'

describe('assignment material validation', () => {
  it('accepts the approved private material types within the size limit', () => {
    expect(
      validateMaterialFile(new File(['drawing'], 'reference.pdf', { type: 'application/pdf' }), 0),
    ).toBeNull()
    expect(
      validateMaterialFile(new File(['image'], 'reference.webp', { type: 'image/webp' }), 4),
    ).toBeNull()
  })

  it('rejects unsupported, oversized, mismatched, and sixth files', () => {
    expect(
      validateMaterialFile(new File(['text'], 'notes.txt', { type: 'text/plain' }), 0),
    ).toMatch(/PDF/)
    expect(
      validateMaterialFile(
        { name: 'large.pdf', type: 'application/pdf', size: maxMaterialBytes + 1 },
        0,
      ),
    ).toMatch(/10 MB/)
    expect(
      validateMaterialFile(new File(['image'], 'wrong.pdf', { type: 'image/png' }), 0),
    ).toMatch(/extension/)
    expect(
      validateMaterialFile(new File(['drawing'], 'reference.pdf', { type: 'application/pdf' }), 5),
    ).toMatch(/limit is 5/)
  })
})
