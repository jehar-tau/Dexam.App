import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

/**
 * D-065/F054: private files open through the caller's current session, never through a reusable
 * bearer link. Storage evaluates its row-level policy on every request, so expired, suspended or
 * revoked access stops the next read. The bytes stay in this tab as a private object URL that is
 * revoked when its owner unmounts or the account changes. Bytes a person has already viewed or
 * saved on their device cannot be recalled.
 */

export type ProtectedBucket =
  | 'assessment-media'
  | 'assessment-part-b'
  | 'assignment-materials'
  | 'payment-receipts'
  | 'student-submissions'
  | 'teacher-feedback-audio'

export class ProtectedFileError extends Error {}

const unavailable = 'This file is not available to your account.'

/** Object names are server-issued; refuse anything that could address another path. */
export function isSafeObjectPath(path: string) {
  return (
    path.length > 0 &&
    path.length <= 1024 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.split('/').some((part) => part === '' || part === '.' || part === '..') &&
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001f\u007f?#]/.test(path)
  )
}

/** One authenticated, uncached read of a private object. */
export async function downloadProtectedObject(
  client: SupabaseClient,
  bucket: ProtectedBucket,
  path: string,
  signal?: AbortSignal,
): Promise<Blob> {
  if (!isSafeObjectPath(path)) throw new ProtectedFileError(unavailable)
  const result = await client.storage
    .from(bucket)
    .download(path, {}, { cache: 'no-store', ...(signal ? { signal } : {}) })
  if (result.error || !(result.data instanceof Blob)) throw new ProtectedFileError(unavailable)
  return result.data
}

const UNCLAIMED_MS = 60_000
const live = new Set<ObjectUrlBundle>()

/**
 * Owns the object URLs made for one loaded view (a paper, a result, a review) or one shown file.
 * It is revoked once no holder remains, after an unclaimed grace period, or when the account
 * changes. Loading holds it too, so a slow download never starts the grace period early.
 * Retain/release counting tolerates React StrictMode's mount, unmount, mount sequence.
 */
export class ObjectUrlBundle {
  #urls: string[] = []
  #holders = 0
  #timer: ReturnType<typeof setTimeout> | undefined
  #revoked = false

  constructor() {
    live.add(this)
    this.#schedule(UNCLAIMED_MS)
  }

  get revoked() {
    return this.#revoked
  }

  get size() {
    return this.#urls.length
  }

  add(blob: Blob) {
    if (this.#revoked) throw new ProtectedFileError(unavailable)
    const url = URL.createObjectURL(blob)
    this.#urls.push(url)
    return url
  }

  retain() {
    this.#holders += 1
    clearTimeout(this.#timer)
    this.#timer = undefined
  }

  /** `delay` lets a finished load hand the bundle to a view that has not mounted yet. */
  release(delay = 0) {
    this.#holders = Math.max(0, this.#holders - 1)
    if (this.#holders === 0) this.#schedule(delay)
  }

  revoke() {
    clearTimeout(this.#timer)
    this.#timer = undefined
    this.#revoked = true
    for (const url of this.#urls) URL.revokeObjectURL(url)
    this.#urls = []
    live.delete(this)
  }

  #schedule(delay: number) {
    clearTimeout(this.#timer)
    this.#timer = setTimeout(() => {
      if (this.#holders === 0) this.revoke()
    }, delay)
  }
}

/** Sign-out and account switches must not leave another person's files in memory. */
export function revokeAllObjectUrls() {
  for (const bundle of [...live]) bundle.revoke()
}

/** Holds a bundle for as long as the calling component is mounted. */
export function useObjectUrlBundle(bundle: ObjectUrlBundle | undefined) {
  useEffect(() => {
    if (!bundle) return
    bundle.retain()
    return () => bundle.release()
  }, [bundle])
}

/**
 * Loads several objects into a bundle, a few at a time. A file the caller may not read is left
 * out, exactly as an unsignable path was before; callers decide whether that is fatal.
 */
export async function loadProtectedObjectUrls(
  client: SupabaseClient,
  bucket: ProtectedBucket,
  paths: string[],
  bundle: ObjectUrlBundle,
  concurrency = 4,
) {
  const urls = new Map<string, string>()
  const queue = [...new Set(paths)]
  bundle.retain()
  const worker = async () => {
    for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
      try {
        const blob = await downloadProtectedObject(client, bucket, path)
        if (!bundle.revoked) urls.set(path, bundle.add(blob))
      } catch {
        // Missing or no longer authorised: omitted, never replaced with a public link.
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
  } finally {
    bundle.release(UNCLAIMED_MS)
  }
  return urls
}

export type ProtectedObjectState =
  { status: 'idle' | 'loading' | 'unavailable'; url: null } | { status: 'ready'; url: string }

/** Component-scoped single file: fetched when mounted, revoked when unmounted or changed. */
export function useProtectedObjectUrl(
  client: SupabaseClient | null,
  bucket: ProtectedBucket,
  path: string | null | undefined,
): ProtectedObjectState {
  const [state, setState] = useState<ProtectedObjectState & { key: string | null }>({
    key: null,
    status: 'idle',
    url: null,
  })
  const key = client && path ? `${bucket}/${path}` : null

  useEffect(() => {
    if (!client || !path) return
    const controller = new AbortController()
    // Tracked like any bundle, so an account change revokes it even while this view is mounted.
    const bundle = new ObjectUrlBundle()
    bundle.retain()
    downloadProtectedObject(client, bucket, path, controller.signal).then(
      (blob) => {
        if (controller.signal.aborted || bundle.revoked) return
        setState({ key: `${bucket}/${path}`, status: 'ready', url: bundle.add(blob) })
      },
      () => {
        if (!controller.signal.aborted)
          setState({ key: `${bucket}/${path}`, status: 'unavailable', url: null })
      },
    )
    return () => {
      controller.abort()
      bundle.revoke()
      // A revoked address must never be reported as ready if this path is shown again.
      setState((current) =>
        current.key === `${bucket}/${path}` ? { key: null, status: 'idle', url: null } : current,
      )
    }
  }, [client, bucket, path])

  if (!key) return { status: 'idle', url: null }
  if (state.key !== key) return { status: 'loading', url: null }
  return state.status === 'ready'
    ? { status: 'ready', url: state.url }
    : { status: state.status, url: null }
}

/** Stored types Dexam accepts, with the extension used when a name must be made up. */
const fileExtensions: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
}

/**
 * Bytes an Edge Function returned after its own authorisation check, typed from the separate
 * stored-type header (the body is always sent as opaque bytes). Null for anything else.
 */
export function protectedFunctionFile(result: {
  data: unknown
  error: unknown
  response?: Response
}): Blob | null {
  if (result.error || !(result.data instanceof Blob)) return null
  const stored = result.response?.headers.get('X-Dexam-File-Type') ?? ''
  const type = Object.hasOwn(fileExtensions, stored) ? stored : 'application/octet-stream'
  return new Blob([result.data], { type })
}

/** A file name for bytes whose stored name is not shown, from their checked type. */
export function fileNameFor(base: string, type: string) {
  return Object.hasOwn(fileExtensions, type) ? `${base}.${fileExtensions[type]}` : base
}

/** Saves already-authorised bytes under a chosen name without exposing a reusable link. */
export function saveBlob(blob: Blob, fileName: string) {
  const bundle = new ObjectUrlBundle()
  bundle.retain()
  const link = document.createElement('a')
  link.href = bundle.add(blob)
  link.download = fileName
  link.rel = 'noreferrer'
  link.click()
  // Long enough for the browser to start the download; the bytes never had a shareable address.
  setTimeout(() => bundle.revoke(), 30_000)
}
