export const maxLessonBytes = 10 * 1024 * 1024
export function validLessonFile(file, bytes) {
  if (
    !file ||
    file.size < 1 ||
    file.size > maxLessonBytes ||
    file.name.length < 1 ||
    file.name.length > 180 ||
    /[\x00-\x1f\x7f/\\]/.test(file.name)
  )
    return false
  const starts = (values) => values.every((v, i) => bytes[i] === v)
  const text = (start, end) => new TextDecoder().decode(bytes.slice(start, end))
  if (file.type === 'application/pdf') return /\.pdf$/i.test(file.name) && text(0, 5) === '%PDF-'
  if (file.type === 'image/jpeg') return /\.(jpg|jpeg)$/i.test(file.name) && starts([255, 216, 255])
  if (file.type === 'image/png')
    return /\.png$/i.test(file.name) && starts([137, 80, 78, 71, 13, 10, 26, 10])
  if (file.type === 'image/webp')
    return /\.webp$/i.test(file.name) && text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP'
  return false
}
export async function boundedBody(request, limit) {
  if (!request.body) throw new Error('Body required')
  const reader = request.body.getReader(),
    chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > limit) {
        await reader.cancel()
        throw new Error('Body too large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}
