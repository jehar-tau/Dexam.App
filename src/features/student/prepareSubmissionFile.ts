export const submissionFileTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

const maxStoredBytes = 10 * 1024 * 1024
const maxOriginalBytes = 50 * 1024 * 1024
const maxImageEdge = 3200

export type PreparedSubmissionFile = {
  file: File
  originalByteSize: number
  originalFileName: string
  pixelHeight: number | null
  pixelWidth: number | null
  previewUrl: string | null
  wasCompressed: boolean
}

export function imageTargetDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('This image could not be read.')
  }
  const scale = Math.min(1, maxImageEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function outputName(name: string, mimeType: string) {
  const base = name.replace(/\.[^.]+$/, '') || 'submission'
  if (mimeType === 'image/jpeg') return `${base}.jpg`
  if (mimeType === 'image/png') return `${base}.png`
  return `${base}.webp`
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('This image could not be optimized.'))
      },
      type,
      quality,
    )
  })
}

async function loadImage(file: File) {
  if ('createImageBitmap' in globalThis) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return {
      height: bitmap.height,
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      release: () => bitmap.close(),
    }
  }

  const url = URL.createObjectURL(file)
  const image = new Image()
  image.decoding = 'async'
  image.src = url
  await image.decode()
  return {
    height: image.naturalHeight,
    source: image as CanvasImageSource,
    width: image.naturalWidth,
    release: () => URL.revokeObjectURL(url),
  }
}

export async function prepareSubmissionFile(
  original: File,
  quality: 'optimized' | 'original' = 'optimized',
): Promise<PreparedSubmissionFile> {
  if (!submissionFileTypes.includes(original.type as (typeof submissionFileTypes)[number])) {
    throw new Error('Use a PDF, JPEG, PNG, or WebP file.')
  }
  if (original.size < 1 || original.size > maxOriginalBytes) {
    throw new Error('Choose a file smaller than 50 MB before optimization.')
  }

  if (original.type === 'application/pdf') {
    if (original.size > maxStoredBytes) throw new Error('PDF files must be 10 MB or smaller.')
    return {
      file: original,
      originalByteSize: original.size,
      originalFileName: original.name,
      pixelHeight: null,
      pixelWidth: null,
      previewUrl: null,
      wasCompressed: false,
    }
  }

  const loaded = await loadImage(original)
  try {
    const dimensions = imageTargetDimensions(loaded.width, loaded.height)
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d', { alpha: original.type !== 'image/jpeg' })
    if (!context) throw new Error('This browser cannot optimize the image.')
    context.drawImage(loaded.source, 0, 0, dimensions.width, dimensions.height)

    const outputType = original.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp'
    const outputQuality = quality === 'original' ? 0.98 : outputType === 'image/jpeg' ? 0.85 : 0.9
    const blob = await canvasBlob(canvas, outputType, outputQuality)
    if (blob.size > maxStoredBytes) {
      throw new Error('The optimized image is still larger than 10 MB. Try a smaller image.')
    }
    const file = new File([blob], outputName(original.name, outputType), {
      type: outputType,
      lastModified: Date.now(),
    })

    return {
      file,
      originalByteSize: original.size,
      originalFileName: original.name,
      pixelHeight: dimensions.height,
      pixelWidth: dimensions.width,
      previewUrl: URL.createObjectURL(file),
      wasCompressed: file.size < original.size,
    }
  } finally {
    loaded.release()
  }
}
