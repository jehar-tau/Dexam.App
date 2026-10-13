import { describe, expect, it, vi } from 'vitest'
import {
  assertLocalEmployeeEmail,
  sendCapturedEmployeeEmail,
} from '../../supabase/functions/_shared/local-employee-email.mjs'

const config = {
  mode: 'local-capture',
  apiURL: 'http://kong:8000',
  captureURL: 'http://supabase_inbucket_dexam-platform:8025',
}
const link =
  'http://127.0.0.1:54321/auth/v1/verify?type=invite&token=fictional-non-secret-token&redirect_to=http%3A%2F%2F127.0.0.1%3A5173%2Fstaff%2Factivate'
describe('D-029 local-only employee email', () => {
  it('allows only explicit fictional local capture', () => {
    expect(assertLocalEmployeeEmail(config, 'employee@fixture.invalid')).toBe(config.captureURL)
  })
  it.each([
    { ...config, mode: undefined },
    { ...config, apiURL: 'https://ienwcencjbgdsqxfyxmj.supabase.co' },
    { ...config, captureURL: 'https://email.example.com' },
    { ...config, captureURL: 'http://supabase_inbucket_dexam-platform:8025/path' },
    { ...config, captureURL: 'http://user:secret@127.0.0.1:54324' },
  ])(
    'rejects disabled/hosted/unsafe destinations without attempting delivery',
    async (settings) => {
      const send = vi.fn()
      await expect(
        sendCapturedEmployeeEmail(settings, 'employee@fixture.invalid', link, 'invite', send),
      ).rejects.toThrow('unavailable')
      expect(send).not.toHaveBeenCalled()
    },
  )
  it.each([
    'employee@example.com',
    'employee@fixture.invalid.example.com',
    'employee@fixture.invalid\n',
    'Employee@fixture.invalid',
    'person..name@fixture.invalid',
  ])('rejects non-fictional or malformed recipients', (email) => {
    expect(() => assertLocalEmployeeEmail(config, email)).toThrow('unavailable')
  })
  it('captures plain text only, without releasing messages or using SMTP', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true })
    await sendCapturedEmployeeEmail(config, 'employee@fixture.invalid', link, 'invite', send)
    expect(send).toHaveBeenCalledOnce()
    const [url, options] = send.mock.calls[0]
    expect(url).toBe(`${config.captureURL}/api/v1/send`)
    expect(options.redirect).toBe('error')
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(options.body).To).toEqual([{ Email: 'employee@fixture.invalid' }])
    expect(JSON.parse(options.body).HTML).toBeUndefined()
  })
  it.each([
    link.replace('127.0.0.1:54321', 'evil.example.com'),
    link.replace('type=invite', 'type=recovery'),
    link.replace('%2Fstaff%2Factivate', '%2Fstaff%2Fcrm'),
    link.replace('http%3A%2F%2F127.0.0.1%3A5173', 'https%3A%2F%2Fevil.example.com'),
    `${link}#secret`,
  ])('rejects wrong-purpose or unsafe callback links', async (value) => {
    const send = vi.fn()
    await expect(
      sendCapturedEmployeeEmail(config, 'employee@fixture.invalid', value, 'invite', send),
    ).rejects.toThrow('unavailable')
    expect(send).not.toHaveBeenCalled()
  })
  it('withholds transport errors and credential-bearing payloads', async () => {
    const send = vi.fn().mockRejectedValue(new Error(`private ${link}`))
    await expect(
      sendCapturedEmployeeEmail(config, 'employee@fixture.invalid', link, 'invite', send),
    ).rejects.toThrow('Employee email delivery is unavailable in this environment.')
  })
})
// @vitest-environment node
