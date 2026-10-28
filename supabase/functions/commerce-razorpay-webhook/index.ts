// F049: Razorpay webhook. Grants access only for a correctly signed `payment.captured` /
// `order.paid` event whose amount matches our order; every event is processed at most once.
// Without the webhook secret the function fails closed.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { maxWebhookBytes, parsePaidEvent, verifyWebhookSignature } from '../_shared/razorpay.mjs'

const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(405, { message: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL'),
    service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
  if (!url || !service || !secret) return reply(503, { message: 'Payments are not available yet.' })
  const length = Number(request.headers.get('Content-Length') ?? '0')
  if (length > maxWebhookBytes) return reply(413, { message: 'Too large.' })
  const raw = await request.text()
  if (raw.length > maxWebhookBytes) return reply(413, { message: 'Too large.' })
  const signature = request.headers.get('X-Razorpay-Signature') ?? ''
  if (!(await verifyWebhookSignature(raw, signature, secret)))
    return reply(401, { message: 'Invalid signature.' })
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return reply(400, { message: 'Invalid body.' })
  }
  const paid = parsePaidEvent(payload, request.headers.get('X-Razorpay-Event-Id') ?? '')
  if (!paid) return reply(200, { outcome: 'ignored' })
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const fulfilled = await admin.rpc('fulfil_commerce_order', {
    p_event_id: paid.eventId,
    p_provider_order_id: paid.providerOrderId,
    p_payment_id: paid.paymentId,
    p_amount_paise: paid.amountPaise,
    p_currency: paid.currency,
  })
  // A transient failure returns 503 so Razorpay retries; outcomes are idempotent.
  if (fulfilled.error) return reply(503, { message: 'Retry later.' })
  return reply(200, { outcome: fulfilled.data })
})
