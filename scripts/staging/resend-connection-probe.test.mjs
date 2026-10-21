// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createResendConnectionProbe } from '../../supabase/functions/_shared/resend-connection-probe.mjs'

const id = 'fd000000-0000-4000-8000-000000000001'
const settings = {
  enabled: true,
  apiKey: 're_fixture_not_a_real_secret',
  recipient: 'owner@fixture.invalid',
}
const success = () => new Response(JSON.stringify({ id }), { status: 200 })
afterEach(() => vi.useRealTimers())

describe('isolated Resend connection probe, no actual network', () => {
  it.each([{}, { enabled: false }, { enabled: 'true' }])('defaults closed: %j', async (config) => {
    const fetcher = vi.fn()
    expect(await createResendConnectionProbe(config, fetcher).send(id)).toEqual({
      status: 'disabled',
      attempts: 0,
    })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('sends only the fixed plain-text probe to one configured recipient', async () => {
    const fetcher = vi.fn().mockResolvedValue(success())
    const result = await createResendConnectionProbe(settings, fetcher).send(id)
    expect(result).toEqual({ status: 'accepted', attempts: 1 })
    const [url, request] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(request).toMatchObject({ method: 'POST', redirect: 'error', credentials: 'omit' })
    expect(request.headers).toEqual({
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `dexam/connection-test/${id}`,
    })
    expect(JSON.parse(request.body)).toEqual({
      from: 'Dexam <accounts@auth.designexam.com>',
      to: [settings.recipient],
      subject: 'Dexam email connection test',
      text: 'This is a Dexam email connection test. No account has been created or changed. This message contains no sign-in link. No action is required.',
    })
    expect(JSON.stringify(result)).not.toContain(settings.apiKey)
  })
  it.each([
    { ...settings, apiKey: undefined },
    { ...settings, apiKey: 're_secret\r\nHeader: bad' },
    { ...settings, recipient: 'one@fixture.invalid,two@fixture.invalid' },
    { ...settings, recipient: 'one@fixture.invalid\nBcc: two@fixture.invalid' },
    { ...settings, recipient: ['one@fixture.invalid'] },
    { ...settings, recipient: 'a@bad..invalid' },
    { ...settings, endpoint: 'https://elsewhere.invalid' },
    { ...settings, from: 'attacker@fixture.invalid' },
  ])('rejects malformed or expanded configuration', (config) => {
    const fetcher = vi.fn()
    expect(() => createResendConnectionProbe(config, fetcher)).toThrow(
      'Email connection test is unavailable.',
    )
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('rejects accessors without evaluating them', () => {
    const getter = vi.fn()
    const config = { ...settings }
    Object.defineProperty(config, 'apiKey', { get: getter })
    expect(() => createResendConnectionProbe(config, vi.fn())).toThrow('unavailable')
    expect(getter).not.toHaveBeenCalled()
  })
  it('captures private configuration, unaffected by caller mutation', async () => {
    const config = { ...settings }
    const fetcher = vi.fn().mockResolvedValue(success())
    const probe = createResendConnectionProbe(config, fetcher)
    config.recipient = 'other@fixture.invalid'
    await probe.send(id)
    expect(JSON.parse(fetcher.mock.calls[0][1].body).to).toEqual([settings.recipient])
  })
  it('rejects invalid identity before sending, and allows correction', async () => {
    const fetcher = vi.fn().mockResolvedValue(success())
    const probe = createResendConnectionProbe(settings, fetcher)
    await expect(probe.send('../bad')).rejects.toThrow('unavailable')
    expect(fetcher).not.toHaveBeenCalled()
    await probe.send(id)
    await expect(probe.send(id)).rejects.toThrow('unavailable')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('prevents concurrent duplicate sends', async () => {
    const fetcher = vi.fn().mockResolvedValue(success())
    const probe = createResendConnectionProbe(settings, fetcher)
    const first = probe.send(id)
    await expect(probe.send(id)).rejects.toThrow('unavailable')
    await first
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each([400, 401, 403, 422, 429])(
    'reports initial HTTP %i rejection without retry',
    async (status) => {
      const fetcher = vi.fn().mockResolvedValue(new Response('PRIVATE provider error', { status }))
      expect(await createResendConnectionProbe(settings, fetcher).send(id)).toEqual({
        status: 'rejected',
        attempts: 1,
      })
      expect(fetcher).toHaveBeenCalledTimes(1)
    },
  )
  it.each([302, 408, 409, 500, 503])('keeps HTTP %i uncertain', async (status) => {
    const fetcher = vi.fn().mockResolvedValue(new Response('private', { status }))
    expect(await createResendConnectionProbe(settings, fetcher).send(id)).toEqual({
      status: 'uncertain',
      attempts: 1,
    })
  })
  it.each([
    'not json',
    '{}',
    '{"id":"bad"}',
    JSON.stringify({ id, private: 'extra' }),
    'x'.repeat(2049),
  ])('does not trust malformed success bodies', async (body) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(body))
    expect(await createResendConnectionProbe(settings, fetcher).send(id)).toEqual({
      status: 'uncertain',
      attempts: 1,
    })
  })
  it('normalizes transport exceptions without secret leakage', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error(settings.apiKey))
    expect(await createResendConnectionProbe(settings, fetcher).send(id)).toEqual({
      status: 'uncertain',
      attempts: 1,
    })
  })
  it('times out a hung transport and aborts it, without automatic retry', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn().mockImplementation(() => new Promise(() => {}))
    const pending = createResendConnectionProbe(settings, fetcher).send(id)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await pending).toEqual({ status: 'uncertain', attempts: 1 })
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  })
})
