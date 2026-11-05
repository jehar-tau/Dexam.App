import type { SupabaseClient } from '@supabase/supabase-js'
import { act, renderHook, waitFor } from '@testing-library/react'

import {
  ObjectUrlBundle,
  ProtectedFileError,
  downloadProtectedObject,
  isSafeObjectPath,
  loadProtectedObjectUrls,
  revokeAllObjectUrls,
  saveBlob,
  useObjectUrlBundle,
  useProtectedObjectUrl,
} from './protectedFiles'

function storageClient(download: (path: string, ...rest: unknown[]) => unknown) {
  const from = vi.fn(() => ({ download }))
  return { client: { storage: { from } } as unknown as SupabaseClient, from }
}

describe('protected file retrieval', () => {
  let created = 0
  const revoked: string[] = []

  beforeEach(() => {
    created = 0
    revoked.length = 0
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => `blob:fictional/${++created}`),
      revokeObjectURL: vi.fn((url: string) => revoked.push(url)),
    })
  })
  afterEach(() => {
    revokeAllObjectUrls()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('reads through the session, uncached, and never asks for a signed link', async () => {
    const download = vi.fn(() => Promise.resolve({ data: new Blob(['x']), error: null }))
    const { client, from } = storageClient(download)
    const blob = await downloadProtectedObject(client, 'student-submissions', 'a/b/c.png')
    expect(blob).toBeInstanceOf(Blob)
    expect(from).toHaveBeenCalledWith('student-submissions')
    expect(download).toHaveBeenCalledWith('a/b/c.png', {}, { cache: 'no-store' })
  })

  it('fails closed when Storage denies the current session', async () => {
    const { client } = storageClient(() =>
      Promise.resolve({ data: null, error: { message: 'Object not found' } }),
    )
    await expect(
      downloadProtectedObject(client, 'assessment-media', 'questions/a.png'),
    ).rejects.toBeInstanceOf(ProtectedFileError)
  })

  it.each([
    '',
    '/root.png',
    'a/../b.png',
    'a//b.png',
    './a.png',
    'a\\b.png',
    'a.png?download',
    'a.png#x',
    'a\u0000.png',
    'x'.repeat(1025),
  ])('refuses an unsafe object name %#', async (path) => {
    expect(isSafeObjectPath(path)).toBe(false)
    const download = vi.fn()
    const { client } = storageClient(download)
    await expect(downloadProtectedObject(client, 'assessment-media', path)).rejects.toThrow()
    expect(download).not.toHaveBeenCalled()
  })

  it('loads a batch a few at a time and leaves out what is not authorised', async () => {
    let active = 0,
      peak = 0
    const download = vi.fn(async (path: string) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 1))
      active -= 1
      return path.startsWith('denied')
        ? { data: null, error: { message: 'denied' } }
        : { data: new Blob([path]), error: null }
    })
    const { client } = storageClient(download)
    const bundle = new ObjectUrlBundle()
    const paths = ['p/1.png', 'p/2.png', 'denied/3.png', 'p/4.png', 'p/5.png', 'p/1.png']
    const urls = await loadProtectedObjectUrls(client, 'assessment-media', paths, bundle, 2)
    expect(download).toHaveBeenCalledTimes(5)
    expect(peak).toBeLessThanOrEqual(2)
    expect([...urls.keys()].sort()).toEqual(['p/1.png', 'p/2.png', 'p/4.png', 'p/5.png'])
    expect(bundle.size).toBe(4)
  })

  it('never starts the unclaimed grace period while a slow load is still running', async () => {
    vi.useFakeTimers()
    let finish!: () => void
    const slow = new Promise<void>((resolve) => (finish = resolve))
    const download = vi.fn(async (path: string) => {
      if (path === 'p/slow.png') await slow
      return { data: new Blob([path]), error: null }
    })
    const { client } = storageClient(download)
    const bundle = new ObjectUrlBundle()
    const loading = loadProtectedObjectUrls(
      client,
      'assessment-media',
      ['p/a.png', 'p/slow.png'],
      bundle,
    )
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(bundle.revoked).toBe(false)
    finish()
    const urls = await loading
    expect(urls.size).toBe(2)
    expect(revoked).toEqual([])
    await vi.advanceTimersByTimeAsync(60_000)
    expect(bundle.revoked).toBe(true)
  })

  it('keeps a bundle through StrictMode remounts and revokes it after the last holder', () => {
    vi.useFakeTimers()
    const bundle = new ObjectUrlBundle()
    const url = bundle.add(new Blob(['figure']))
    const { rerender, unmount } = renderHook(({ value }) => useObjectUrlBundle(value), {
      initialProps: { value: bundle },
    })
    rerender({ value: bundle })
    act(() => void vi.advanceTimersByTime(120_000))
    expect(bundle.revoked).toBe(false)
    unmount()
    act(() => void vi.runOnlyPendingTimers())
    expect(bundle.revoked).toBe(true)
    expect(revoked).toContain(url)
    expect(() => bundle.add(new Blob(['late']))).toThrow(ProtectedFileError)
  })

  it('revokes an unclaimed bundle and every bundle on account change', () => {
    vi.useFakeTimers()
    const unclaimed = new ObjectUrlBundle()
    unclaimed.add(new Blob(['a']))
    vi.advanceTimersByTime(60_000)
    expect(unclaimed.revoked).toBe(true)

    const held = new ObjectUrlBundle()
    held.retain()
    held.add(new Blob(['b']))
    revokeAllObjectUrls()
    expect(held.revoked).toBe(true)
    expect(revoked).toHaveLength(2)
  })

  it('opens a single file for a mounted component and revokes it when the path changes', async () => {
    const download = vi.fn(() => Promise.resolve({ data: new Blob(['voice']), error: null }))
    const { client } = storageClient(download)
    const initialProps: { path: string | null } = { path: 'r/1.webm' }
    const { result, rerender, unmount } = renderHook(
      ({ path }) => useProtectedObjectUrl(client, 'teacher-feedback-audio', path),
      { initialProps },
    )
    expect(result.current.status).toBe('loading')
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'ready', url: 'blob:fictional/1' }),
    )
    rerender({ path: 'r/2.webm' })
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.url).toBe('blob:fictional/2'))
    expect(revoked).toContain('blob:fictional/1')
    unmount()
    expect(revoked).toContain('blob:fictional/2')
  })

  it('never reports a revoked address when an earlier path is shown again', async () => {
    let finishSecond!: () => void
    const second = new Promise<void>((resolve) => (finishSecond = resolve))
    const download = vi.fn(async (path: string) => {
      if (path === 'r/2.webm') await second
      return { data: new Blob([path]), error: null }
    })
    const { client } = storageClient(download)
    const initialProps: { path: string | null } = { path: 'r/1.webm' }
    const { result, rerender } = renderHook(
      ({ path }) => useProtectedObjectUrl(client, 'teacher-feedback-audio', path),
      { initialProps },
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const first = result.current.url
    rerender({ path: 'r/2.webm' })
    rerender({ path: 'r/1.webm' })
    expect(revoked).toContain(first)
    expect(result.current.url).not.toBe(first)
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.url).not.toBe(first)
    finishSecond()
  })

  it('revokes a mounted single file when the account changes', async () => {
    const { client } = storageClient(() => Promise.resolve({ data: new Blob(['v']), error: null }))
    const { result } = renderHook(() =>
      useProtectedObjectUrl(client, 'teacher-feedback-audio', 'r/1.webm'),
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))
    revokeAllObjectUrls()
    expect(revoked).toContain(result.current.url)
  })

  it('reports a denied single file without a link', async () => {
    const { client } = storageClient(() =>
      Promise.resolve({ data: null, error: { message: 'no' } }),
    )
    const { result } = renderHook(() =>
      useProtectedObjectUrl(client, 'teacher-feedback-audio', 'r/1.webm'),
    )
    await waitFor(() => expect(result.current).toEqual({ status: 'unavailable', url: null }))
    const idle = renderHook(() => useProtectedObjectUrl(client, 'teacher-feedback-audio', null))
    expect(idle.result.current).toEqual({ status: 'idle', url: null })
  })

  it('saves bytes under the chosen name and revokes the temporary address', () => {
    vi.useFakeTimers()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    saveBlob(new Blob(['pdf']), 'Brief.pdf')
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toBe('Brief.pdf')
    expect(link.getAttribute('href')).toBe('blob:fictional/1')
    vi.advanceTimersByTime(30_000)
    expect(revoked).toEqual(['blob:fictional/1'])
    click.mockRestore()
  })
})
