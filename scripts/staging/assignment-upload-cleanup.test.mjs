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
