export function assertBrowserBundleBudget(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) throw new Error('Browser chunks missing')
  for (const chunk of chunks) {
    if (!Number.isSafeInteger(chunk.bytes) || chunk.bytes < 1 || chunk.bytes > 500_000)
      throw new Error('Browser JavaScript chunk exceeds the 500 KB engineering budget')
  }
  for (const prefix of ['index-', 'react-runtime-', 'supabase-client-', 'shared-libraries-']) {
    if (!chunks.some((chunk) => chunk.name.startsWith(prefix) && chunk.name.endsWith('.js')))
      throw new Error('Expected browser dependency split missing')
  }
}
