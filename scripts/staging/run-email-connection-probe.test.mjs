// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { runEmailConnectionProbe } from './run-email-connection-probe.mjs'
const id = 'fd000000-0000-4000-8000-000000000001'
const key = 're_fixture_not_a_real_secret'
const recipient = 'owner@fixture.invalid'
function setup(answers, fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id })))) {
  const prompt = vi.fn(async () => answers.shift())
  const write = vi.fn()
  return { prompt, write, fetchImpl: fetcher, deliveryId: id }
}
describe('interactive local email test orchestration, offline only', () => {
  it('requires explicit confirmation before reading a key or sending', async () => {
    const ctx = setup([recipient, 'NO'])
    expect(await runEmailConnectionProbe(ctx)).toBe(0)
    expect(ctx.prompt).toHaveBeenCalledTimes(2)
    expect(ctx.fetchImpl).not.toHaveBeenCalled()
  })
  it('sends once, hides the key prompt and never prints the key', async () => {
    const ctx = setup([recipient, 'SEND ONCE', key])
    expect(await runEmailConnectionProbe(ctx)).toBe(0)
    expect(ctx.prompt.mock.calls[2][1]).toBe(true)
    expect(ctx.fetchImpl).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(ctx.write.mock.calls)).not.toContain(key)
  })
  it('does not retry after uncertainty or echo provider exceptions', async () => {
    const ctx = setup([recipient, 'SEND ONCE', key], vi.fn().mockRejectedValue(new Error(key)))
    expect(await runEmailConnectionProbe(ctx)).toBe(2)
    expect(ctx.fetchImpl).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(ctx.write.mock.calls)).toContain('Do not rerun')
    expect(JSON.stringify(ctx.write.mock.calls)).not.toContain(key)
  })
  it('stops after prompt cancellation without exposing its exception', async () => {
    const ctx = setup([])
    ctx.prompt.mockRejectedValue(new Error(key))
    expect(await runEmailConnectionProbe(ctx)).toBe(2)
    expect(ctx.fetchImpl).not.toHaveBeenCalled()
    expect(JSON.stringify(ctx.write.mock.calls)).not.toContain(key)
  })
})
