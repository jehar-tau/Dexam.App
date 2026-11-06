// D-065/F054: private bytes are returned only to the authorised request that asked for them.
// No signed or reusable link is issued, nothing is cached, and the stored type travels in a
// separate header so the browser never sniffs or renders the body in this origin.

export const allowedFileTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
]

/** The stored type when it is one Dexam accepts; anything else is downloaded as opaque bytes. */
export function storedFileType(value) {
  const type = typeof value === 'string' ? value.split(';')[0].trim().toLowerCase() : ''
  return allowedFileTypes.includes(type) ? type : 'application/octet-stream'
}

export function protectedFileResponse(body, storedType, corsHeaders) {
  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment',
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
      'X-Dexam-File-Type': storedFileType(storedType),
      'Access-Control-Expose-Headers': 'X-Dexam-File-Type',
    },
  })
}
