import { describe, expect, it } from 'vitest'
import { assertOwned, assertTarget, digest, verifyManifest } from './restore-safety.mjs'

describe('restore boundaries', () => {
  it('rejects remote, shared and credential-bearing API targets', () => {
    for (const API_URL of [
      'https://example.com',
      'http://127.0.0.1:54321',
      'http://user@127.0.0.1:56321',
      'http://127.0.0.1:56321/?x=1',
    ])
      expect(() => assertTarget({ API_URL, ANON_KEY: 'a', SERVICE_ROLE_KEY: 's' }, 56321)).toThrow()
    expect(() =>
      assertTarget(
        { API_URL: 'http://127.0.0.1:56321', ANON_KEY: 'a', SERVICE_ROLE_KEY: 's' },
        56321,
      ),
    ).not.toThrow()
  })
  it('rejects cleanup of another run or shared project', () => {
    for (const project of [
      'dexam-platform',
      'restore-bbbbbbbbbbbb-source',
      '../restore-aaaaaaaaaaaa-source',
    ])
      expect(() => assertOwned(project, 'aaaaaaaaaaaa')).toThrow()
    expect(() => assertOwned('restore-aaaaaaaaaaaa-source', 'aaaaaaaaaaaa')).not.toThrow()
  })
  it('rejects missing, corrupt, duplicate and incompatible captures', () => {
    const bytes = Buffer.from('fictional')
    const entry = { bucket: 'private', path: 'a', size: bytes.length, sha256: digest(bytes) }
    const manifest = { version: 'v1', entries: [entry] }
    expect(() => verifyManifest(manifest, new Map([['private/a', bytes]]), 'v1')).not.toThrow()
    expect(() => verifyManifest(manifest, new Map(), 'v1')).toThrow()
    expect(() =>
      verifyManifest(manifest, new Map([['private/a', Buffer.from('corrupted')]]), 'v1'),
    ).toThrow()
    expect(() => verifyManifest(manifest, new Map([['private/a', bytes]]), 'v2')).toThrow()
    expect(() =>
      verifyManifest(
        { version: 'v1', entries: [entry, entry] },
        new Map([
          ['private/a', bytes],
          ['private/b', bytes],
        ]),
        'v1',
      ),
    ).toThrow()
  })
})
