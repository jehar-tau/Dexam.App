import { readFile, rename, writeFile, mkdir } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'

import type { Plugin } from 'vite'

/**
 * D-060 owner question review, local dev server only. Serves the workstation's review export and
 * its media, and stores the owner's verdicts back in the workstation, so no bank content enters
 * this repository or any build. Enabled by DEXAM_REVIEW_DATA=<workstation>/server/data.
 */

export const REVIEW_REASONS = [
  'crop-cut-off',
  'crop-extra-content',
  'wrong-question',
  'missing-figure',
  'wrong-answer-key',
  'text-or-options',
  'other',
] as const

export type Verdict = {
  verdict: 'ok' | 'fix'
  reasons: string[]
  note: string
  reviewedAt: string
}

const ID_RE = /^[a-z0-9][a-z0-9-]{0,119}$/
const MEDIA_RE = /^[A-Za-z0-9][A-Za-z0-9/_.-]*\.(png|jpe?g|webp)$/i
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

/** A media path inside the media root, or null for anything that could leave it. */
export function safeMediaPath(root: string, requested: string): string | null {
  if (!MEDIA_RE.test(requested) || requested.split('/').includes('..')) return null
  const resolved = path.resolve(root, requested)
  return resolved.startsWith(path.resolve(root) + path.sep) ? resolved : null
}

/** Validates one verdict from the page; returns the stored shape or an error message. */
export function parseVerdict(body: unknown): { id: string; verdict: Verdict } | string {
  if (!body || typeof body !== 'object') return 'Expected a JSON object.'
  const { id, verdict, reasons, note } = body as Record<string, unknown>
  if (typeof id !== 'string' || !ID_RE.test(id)) return 'Unknown question id.'
  if (verdict !== 'ok' && verdict !== 'fix') return 'Verdict must be ok or fix.'
  const list = Array.isArray(reasons) ? reasons : []
  if (!list.every((reason) => (REVIEW_REASONS as readonly unknown[]).includes(reason)))
    return 'Unknown reason.'
  if (note !== undefined && (typeof note !== 'string' || note.length > 2000))
    return 'The note is too long.'
  return {
    id,
    verdict: {
      verdict,
      reasons: verdict === 'ok' ? [] : (list as string[]),
      note: typeof note === 'string' ? note.trim() : '',
      reviewedAt: new Date().toISOString(),
    },
  }
}

/**
 * Only the review page itself may save verdicts: a JSON request (so browsers send a CORS
 * preflight that other sites cannot pass) from this server's own origin. This stops another
 * website open in the same browser from posting a forged form to the local server.
 */
export function sameOriginJson(headers: IncomingMessage['headers']): boolean {
  const type = String(headers['content-type'] ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (type !== 'application/json') return false
  const origin = headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === headers.host
  } catch {
    return false
  }
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    size += (chunk as Buffer).length
    if (size > 16_384) throw new Error('too large')
    chunks.push(chunk as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

export function bankReviewPlugin(dataDir: string | undefined): Plugin {
  return {
    name: 'dexam-bank-review',
    apply: 'serve',
    configureServer(server) {
      if (!dataDir) return
      const root = path.resolve(dataDir)
      const mediaRoot = path.join(root, 'media')
      const exportFile = path.join(root, 'exports', 'dexam-review.json')
      const verdictFile = path.join(root, 'reviews', 'owner-verdicts.json')
      let writing = Promise.resolve()

      const readVerdicts = async (): Promise<Record<string, Verdict>> => {
        try {
          return JSON.parse(await readFile(verdictFile, 'utf8')) as Record<string, Verdict>
        } catch {
          return {}
        }
      }

      server.middlewares.use('/__review', (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://local')
        void (async () => {
          if (request.method === 'GET' && url.pathname === '/bank.json') {
            try {
              response.setHeader('Content-Type', 'application/json')
              response.setHeader('Cache-Control', 'no-store')
              response.end(await readFile(exportFile))
            } catch {
              send(response, 404, {
                error: 'Run tools/export_platform_bank.py in the workstation.',
              })
            }
            return
          }
          if (request.method === 'GET' && url.pathname === '/verdicts') {
            send(response, 200, await readVerdicts())
            return
          }
          if (request.method === 'POST' && url.pathname === '/verdicts') {
            if (!sameOriginJson(request.headers)) {
              send(response, 403, { error: 'Verdicts are saved from the review page only.' })
              return
            }
            let parsed: ReturnType<typeof parseVerdict>
            try {
              parsed = parseVerdict(await readBody(request))
            } catch {
              parsed = 'Could not read the verdict.'
            }
            if (typeof parsed === 'string') {
              send(response, 400, { error: parsed })
              return
            }
            const { id, verdict } = parsed
            // One write at a time; write to a temporary file, then swap it in.
            writing = writing.then(async () => {
              const all = await readVerdicts()
              all[id] = verdict
              await mkdir(path.dirname(verdictFile), { recursive: true })
              await writeFile(`${verdictFile}.tmp`, JSON.stringify(all, null, 1))
              await rename(`${verdictFile}.tmp`, verdictFile)
            })
            await writing
            send(response, 200, { id, ...verdict })
            return
          }
          if (request.method === 'GET' && url.pathname.startsWith('/media/')) {
            const file = safeMediaPath(
              mediaRoot,
              decodeURIComponent(url.pathname.slice('/media/'.length)),
            )
            if (!file) {
              send(response, 400, { error: 'Invalid media path.' })
              return
            }
            try {
              const bytes = await readFile(file)
              response.setHeader('Content-Type', MIME[path.extname(file).slice(1).toLowerCase()])
              response.setHeader('Cache-Control', 'private, max-age=300')
              response.end(bytes)
            } catch {
              send(response, 404, { error: 'Not found.' })
            }
            return
          }
          next()
        })().catch(() => send(response, 500, { error: 'Review server error.' }))
      })
    },
  }
}
