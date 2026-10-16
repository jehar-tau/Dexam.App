// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { prepareAuthenticationEmail } from '../../supabase/functions/_shared/authentication-email.mjs'
import {
  buildResendMockRequest,
  createResendMockAdapter,
} from '../../supabase/functions/_shared/resend-mock-email.mjs'
const now = Date.parse('2026-10-17T00:00:00Z')
const config = {
  mode: 'mock-only',
  from: 'auth@fixture.invalid',
  appOrigin: 'https://app.fixture.invalid',
}
const requestId = 'fd000000-0000-4000-8000-000000000001',
  deliveryId = 'fd000000-0000-4000-8000-000000000002'
const input = {
  purpose: 'invite',
  proofType: 'invite',
  recipient: 'employee@fixture.invalid',
  requestId,
  deliveryId,
  actionLink: `${config.appOrigin}/staff/activate#request=${requestId}&proof=${'a'.repeat(64)}&token_hash=fictional_non_secret_provider_hash&type=invite`,
  expiresAt: new Date(now + 600_000).toISOString(),
}
const accepted = {
  kind: 'response',
  status: 200,
  body: { id: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794' },
}
const adapter = (script) => createResendMockAdapter(config, script, () => now)
describe('D-046 mocked authentication email', () => {
  it('formats exactly one recipient and the existing fragment proof without tracking or extra headers', () => {
    const message = prepareAuthenticationEmail(config, input, now),
      wire = buildResendMockRequest(message),
      body = JSON.parse(wire.body)
    expect(wire.endpoint).toBe('https://api.resend.com/emails')
    expect(wire.redirect).toBe('error')
    expect(body).toEqual({
      from: config.from,
      to: [input.recipient],
      subject: 'Fictional Dexam employee invitation',
      text: message.text,
    })
    expect(body.text).toContain(input.actionLink)
    expect(Object.keys(wire.headers).sort()).toEqual([
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
    ])
    expect(Object.isFrozen(message)).toBe(true)
  })
  it('supports unchanged-email recovery with its exact callback', async () => {
    const transport = adapter([accepted])
    const recovery = {
      ...input,
      purpose: 'recovery',
      proofType: 'recovery',
      actionLink: input.actionLink
        .replace('/staff/activate#', '/staff/recover#')
        .replace('type=invite', 'type=recovery'),
    }
    expect(await transport.send(recovery)).toEqual({ status: 'accepted', attempts: 1 })
  })
  it('preserves invitation reissue with an explicitly bound recovery verification type', async () => {
    const invitation = {
      ...input,
      proofType: 'recovery',
      actionLink: input.actionLink.replace('type=invite', 'type=recovery'),
    }
    expect(await adapter([accepted]).send(invitation)).toEqual({ status: 'accepted', attempts: 1 })
  })
  it.each([
    { ...config, mode: 'resend' },
    { ...config, mode: undefined },
    { ...config, appOrigin: 'https://app.example.com' },
    { ...config, appOrigin: 'http://app.fixture.invalid' },
    { ...config, appOrigin: 'https://user:secret@app.fixture.invalid' },
    { ...config, appOrigin: 'https://app.fixture.invalid/path' },
    { ...config, from: 'auth@example.com' },
    { ...config, from: 'auth@fixture.invalid\r\nBcc:other@fixture.invalid' },
    { ...config, endpoint: 'https://elsewhere.fixture.invalid' },
    { ...config, apiKey: 'PRIVATE-KEY-MUST-NOT-ECHO' },
  ])('rejects live/ambiguous/injected configuration before preparing a message', (settings) => {
    expect(() => prepareAuthenticationEmail(settings, input, now)).toThrow(
      'preparation is unavailable',
    )
  })
  it.each([
    { ...input, purpose: 'marketing' },
    { ...input, purpose: 'recovery', proofType: 'invite' },
    { ...input, recipient: 'employee@example.com' },
    { ...input, recipient: ['a@fixture.invalid', 'b@fixture.invalid'] },
    { ...input, recipient: 'a@fixture.invalid,b@fixture.invalid' },
    { ...input, recipient: 'employee@fixture.invalid\nBcc:x@fixture.invalid' },
    { ...input, recipient: 'dxm-fixture@members.dexam.invalid' },
    { ...input, requestId: deliveryId },
    { ...input, deliveryId: 'bad' },
    { ...input, expiresAt: new Date(now).toISOString() },
    { ...input, expiresAt: new Date(now + 3_600_001).toISOString() },
    { ...input, cc: 'other@fixture.invalid' },
    {
      ...input,
      actionLink: input.actionLink.replace('app.fixture.invalid', 'evil.fixture.invalid'),
    },
    { ...input, actionLink: input.actionLink.replace('/staff/activate#', '/staff/recover#') },
    { ...input, actionLink: input.actionLink.replace('#', '?') },
    { ...input, actionLink: input.actionLink + '&proof=' + 'a'.repeat(64) },
    { ...input, actionLink: input.actionLink.replace('proof=' + 'a'.repeat(64), 'proof=short') },
    { ...input, actionLink: input.actionLink.replace('type=invite', 'type=recovery') },
    { ...input, actionLink: input.actionLink + '&redirect=https://evil.fixture.invalid' },
  ])('rejects altered recipients, credentials, callbacks and expiry', (message) => {
    expect(() => prepareAuthenticationEmail(config, message, now)).toThrow(
      'preparation is unavailable',
    )
  })
  it('cannot format a forged or modified prepared message', () => {
    expect(() => buildResendMockRequest({ ...input, from: 'auth@example.com' })).toThrow(
      'unavailable',
    )
    const message = prepareAuthenticationEmail(config, input, now)
    expect(() => {
      message.recipient = 'other@fixture.invalid'
    }).toThrow()
  })
  it('uses the same message and key for the only bounded retry', async () => {
    const transport = adapter([{ kind: 'timeout' }, accepted])
    expect(await transport.send(input)).toEqual({ status: 'accepted', attempts: 2 })
    expect(transport.getTrace()).toHaveLength(2)
    expect(transport.getTrace()[0]).toEqual(transport.getTrace()[1])
    expect(transport.getTrace()[0].idempotencyKey).toContain(deliveryId)
    expect(JSON.stringify(transport.getTrace())).not.toContain(input.recipient)
    expect(JSON.stringify(transport.getTrace())).not.toContain('token_hash')
    await expect(transport.send(input)).rejects.toThrow('unavailable')
  })
  it('does not classify a later rejection as proof an earlier uncertain attempt failed', async () => {
    const transport = adapter([
      { kind: 'network-error' },
      { kind: 'response', status: 429, body: { message: 'private quota payload' } },
    ])
    expect(await transport.send(input)).toEqual({ status: 'uncertain', attempts: 2 })
  })
  it.each([400, 401, 403, 422, 429])(
    'normalizes known first-attempt rejection %s without payloads',
    async (status) => {
      expect(
        await adapter([{ kind: 'response', status, body: { message: 'PRIVATE-DETAILS' } }]).send(
          input,
        ),
      ).toEqual({ status: 'rejected', attempts: 1 })
    },
  )
  it.each([
    { kind: 'response', status: 200, body: { id: 'wrong-response' } },
    { kind: 'response', status: 200, body: { id: accepted.body.id, unexpected: 'PRIVATE' } },
    { kind: 'response', status: 500, body: { message: 'PRIVATE' } },
    { kind: 'response', status: 408 },
    { kind: 'response', status: 409 },
    { kind: 'network-error' },
  ])('preserves ambiguous outcomes without leaking provider details', async (response) => {
    expect(await adapter([response]).send(input)).toEqual({ status: 'uncertain', attempts: 1 })
  })
  it('never follows redirects', async () => {
    const transport = adapter([
      { kind: 'response', status: 307, body: { location: 'https://evil.example.com' } },
      accepted,
    ])
    expect(await transport.send(input)).toEqual({ status: 'uncertain', attempts: 1 })
  })
  it('stops retrying if the application credential expires', async () => {
    let ticks = 0
    const transport = createResendMockAdapter(config, [{ kind: 'timeout' }, accepted], () =>
      ++ticks <= 2 ? now : now + 600_001,
    )
    expect(await transport.send(input)).toEqual({ status: 'uncertain', attempts: 1 })
  })
  it('does not fall back to the network when a scenario is missing or exhausted', async () => {
    const network = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('No live calls authorized'))
    try {
      expect(() => createResendMockAdapter(config, [], () => now)).toThrow('unavailable')
      expect(await adapter([{ kind: 'timeout' }]).send(input)).toEqual({
        status: 'uncertain',
        attempts: 1,
      })
      expect(network).not.toHaveBeenCalled()
    } finally {
      network.mockRestore()
    }
  })
  it('rejects credentials and custom transport injection in configuration', () => {
    expect(() => createResendMockAdapter({ ...config, apiKey: 'PRIVATE' }, [accepted])).toThrow(
      'unavailable',
    )
    expect(() =>
      createResendMockAdapter({ ...config, fetch: globalThis.fetch }, [accepted]),
    ).toThrow('unavailable')
  })
})
