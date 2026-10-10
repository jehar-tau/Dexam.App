import {
  formatFileSize,
  imageTargetDimensions,
  prepareSubmissionFile,
} from './prepareSubmissionFile'

describe('prepareSubmissionFile', () => {
  it('reduces only images whose longest edge exceeds 3,200 pixels', () => {
    expect(imageTargetDimensions(4032, 3024)).toEqual({ width: 3200, height: 2400 })
    expect(imageTargetDimensions(1200, 1800)).toEqual({ width: 1200, height: 1800 })
  })

  it('keeps an allowed PDF unchanged for trusted upload validation', async () => {
    const file = new File(['%PDF-1.4\nfictional'], 'study.pdf', { type: 'application/pdf' })

    await expect(prepareSubmissionFile(file)).resolves.toMatchObject({
      file,
      originalByteSize: file.size,
      originalFileName: 'study.pdf',
      pixelHeight: null,
      pixelWidth: null,
      previewUrl: null,
      wasCompressed: false,
    })
  })

  it('rejects unsupported executable content before upload', async () => {
    const file = new File(['<script>'], 'unsafe.html', { type: 'text/html' })
    await expect(prepareSubmissionFile(file)).rejects.toThrow('Use a PDF, JPEG, PNG, or WebP file.')
  })

  it('formats before-and-after sizes for the student preview', () => {
    expect(formatFileSize(842000)).toBe('822 KB')
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})
