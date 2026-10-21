// Explicit, interactive local operator tool. Importing this file never sends.
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { createResendConnectionProbe } from '../../supabase/functions/_shared/resend-connection-probe.mjs'

export async function runEmailConnectionProbe({
  prompt,
  fetchImpl,
  write,
  deliveryId = randomUUID(),
}) {
  let key
  try {
    write('One fixed non-credential email only. No account creation or sign-in links.')
    write(
      'Use only the privately approved test recipient. Never retry an uncertain send without investigation.',
    )
    const recipient = await prompt('Approved test recipient email: ', false)
    // Confirm destination before requesting the credential; no network has occurred.
    write(`Destination: ${recipient}`)
    if (
      (await prompt('Type SEND ONCE to authorize this single message: ', false)) !== 'SEND ONCE'
    ) {
      write('Cancelled. No email sent.')
      return 0
    }
    key = await prompt('Paste the sending-only Resend key (hidden; not saved): ', true)
    const probe = createResendConnectionProbe({ enabled: true, apiKey: key, recipient }, fetchImpl)
    key = undefined
    write(`Probe identity: ${deliveryId}`)
    const result = await probe.send(deliveryId)
    if (result.status === 'accepted') {
      write(
        'Accepted by Resend. Check the approved inbox/spam folder; this does not prove delivery.',
      )
      return 0
    }
    write(
      result.status === 'rejected'
        ? 'Provider rejected the test. No automatic retry. Check provider settings before authorizing another attempt.'
        : 'Delivery outcome uncertain. Do not rerun. Inspect provider activity before authorizing another attempt.',
    )
    return 2
  } catch {
    // Never print exceptions: a transport/prompt may include key or provider content.
    write(
      'Connection test stopped. No automatic retry. Check provider activity before any new attempt.',
    )
    return 2
  } finally {
    // eslint-disable-next-line no-useless-assignment -- Release a retained credential on failure as well as success.
    key = undefined
  }
}

async function interactivePrompt(label, hidden) {
  process.stdout.write(label)
  const silent = new Writable({
    write(_chunk, _encoding, done) {
      done()
    },
  })
  const rl = createInterface({
    input: process.stdin,
    output: hidden ? silent : process.stdout,
    terminal: true,
  })
  let aborted = false
  const abort = new AbortController()
  rl.once('SIGINT', () => {
    aborted = true
    abort.abort()
  })
  try {
    const value = await rl.question('', { signal: abort.signal })
    if (aborted) throw new Error()
    return value
  } finally {
    rl.close()
    if (hidden) process.stdout.write('\n')
    silent.destroy()
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === '--check') {
    console.log(
      'Local non-credential probe ready. No key read or network call. Live use requires --send, an interactive TTY, recipient confirmation and a hidden key prompt.',
    )
    return
  }
  if (args.length !== 1 || args[0] !== '--send' || !process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(
      'Disabled. Use --check for offline inspection. Authorized live use requires --send in an interactive terminal. Do not pass keys or recipients in arguments or environment variables.',
    )
    process.exitCode = 2
    return
  }
  process.exitCode = await runEmailConnectionProbe({
    prompt: interactivePrompt,
    fetchImpl: globalThis.fetch,
    write: (message) => console.log(message),
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
