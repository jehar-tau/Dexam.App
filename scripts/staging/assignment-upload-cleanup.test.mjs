import { describe, it, expect, vi } from 'vitest'
import { reconcileAssignmentUploads } from './assignment-upload-cleanup.mjs'
describe('assignment cleanup entry boundary', () => {
  it('rejects remote targets before claiming work', async () => {
    const rpc = vi.fn()
    await expect(
      reconcileAssignmentUploads({ supabaseUrl: 'https://example.invalid', rpc }, [
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ]),
    ).rejects.toThrow('local')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('requires explicit bounded identities', async () => {
    const rpc = vi.fn(),
      admin = { supabaseUrl: 'http://127.0.0.1:54321', rpc }
    for (const ids of [[], ['not-an-id'], Array(101).fill('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')])
      await expect(reconcileAssignmentUploads(admin, ids)).rejects.toThrow('bounded')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('fails closed on claim errors without echoing private payloads', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'private-provider-payload' } })
    await expect(
      reconcileAssignmentUploads({ supabaseUrl: 'http://127.0.0.1:54321', rpc }, [
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ]),
    ).rejects.toThrow('Upload cleanup claim failed')
  })
})

const uploadId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const objectPath = 'fictional-owned-file'
function cleanupFixture({ lookup, refs, remove, complete, candidates } = {}) {
  const rpc = vi.fn(async (name) =>
    name === 'claim_assignment_upload_cleanup'
      ? { data: candidates ?? [{ upload_id: uploadId, object_path: objectPath }], error: null }
      : (complete ?? { data: null, error: null }),
  )
  const removeObject = vi.fn().mockResolvedValue(remove ?? { error: null })
  const reservation = {
    single: vi.fn().mockResolvedValue(
      lookup ?? {
        data: { object_path: objectPath, state: 'deleting', cleanup_hold: false },
        error: null,
      },
    ),
  }
  const references = {
    limit: vi.fn().mockResolvedValue(refs ?? { data: [], error: null }),
  }
  const from = vi.fn((table) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => (table === 'assignment_upload_reservations' ? reservation : references)),
    })),
  }))
  const storageFrom = vi.fn(() => ({ remove: removeObject }))
  return {
    admin: { supabaseUrl: 'http://127.0.0.1:54321', rpc, from, storage: { from: storageFrom } },
    rpc,
    from,
    storageFrom,
    removeObject,
  }
}

describe('assignment cleanup execution failures', () => {
  it.each([
    ['reservation unavailable', { data: null, error: { message: 'private lookup failure' } }],
    [
      'held reservation',
      { data: { object_path: objectPath, state: 'deleting', cleanup_hold: true } },
    ],
    [
      'changed state',
      { data: { object_path: objectPath, state: 'attached', cleanup_hold: false } },
    ],
    [
      'changed object path',
      { data: { object_path: 'another-object', state: 'deleting', cleanup_hold: false } },
    ],
  ])('protects bytes when %s', async (_name, lookup) => {
    const fixture = cleanupFixture({ lookup })
    await expect(reconcileAssignmentUploads(fixture.admin, [uploadId])).resolves.toEqual({
      examined: 1,
      deleted: 0,
      failed: 1,
    })
    expect(fixture.storageFrom).not.toHaveBeenCalled()
    expect(fixture.rpc).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['referenced file', { data: [{ id: 'existing-material' }], error: null }],
    ['unavailable reference lookup', { data: null, error: { message: 'private failure' } }],
  ])('protects a %s', async (_name, refs) => {
    const fixture = cleanupFixture({ refs })
    await expect(reconcileAssignmentUploads(fixture.admin, [uploadId])).resolves.toEqual({
      examined: 1,
      deleted: 0,
      failed: 1,
    })
    expect(fixture.removeObject).not.toHaveBeenCalled()
    expect(fixture.rpc).toHaveBeenCalledTimes(1)
  })

  it('never confirms deletion after Storage rejects removal', async () => {
    const fixture = cleanupFixture({ remove: { error: { message: 'private storage failure' } } })
    await expect(reconcileAssignmentUploads(fixture.admin, [uploadId])).resolves.toEqual({
      examined: 1,
      deleted: 0,
      failed: 1,
    })
    expect(fixture.rpc).toHaveBeenCalledTimes(1)
  })

  it('does not report success when bytes are removed but completion is uncertain', async () => {
    const fixture = cleanupFixture({ complete: { error: { message: 'completion response lost' } } })
    await expect(reconcileAssignmentUploads(fixture.admin, [uploadId])).resolves.toEqual({
      examined: 1,
      deleted: 0,
      failed: 1,
    })
    expect(fixture.removeObject).toHaveBeenCalledWith([objectPath])
    expect(fixture.rpc).toHaveBeenLastCalledWith('complete_assignment_upload_cleanup', {
      p_upload_id: uploadId,
    })
  })

  it('rejects an out-of-scope claim before touching any object', async () => {
    const fixture = cleanupFixture({
      candidates: [{ upload_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', object_path: objectPath }],
    })
    await expect(reconcileAssignmentUploads(fixture.admin, [uploadId])).rejects.toThrow(
      'Cleanup scope mismatch',
    )
    expect(fixture.from).not.toHaveBeenCalled()
    expect(fixture.storageFrom).not.toHaveBeenCalled()
  })

  it('counts success only after exact-bucket removal and completion', async () => {
    const fixture = cleanupFixture()
    await expect(reconcileAssignmentUploads(fixture.admin, [uploadId])).resolves.toEqual({
      examined: 1,
      deleted: 1,
      failed: 0,
    })
    expect(fixture.storageFrom).toHaveBeenCalledWith('assignment-materials')
    expect(fixture.removeObject).toHaveBeenCalledExactlyOnceWith([objectPath])
    expect(fixture.rpc).toHaveBeenLastCalledWith('complete_assignment_upload_cleanup', {
      p_upload_id: uploadId,
    })
  })
})
