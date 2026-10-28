// F049: starts a payment. The signed-in student's own order is created by the database (which
// refuses plans that are not on sale), then a Razorpay order is created with server-held keys and
// attached. Without Razorpay keys the function fails closed.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { orderRequest } from '../_shared/razorpay.mjs'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}
const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return reply(405, { message: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL'),
    anon = Deno.env.get('SUPABASE_ANON_KEY'),
    service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    keyId = Deno.env.get('RAZORPAY_KEY_ID'),
    keySecret = Deno.env.get('RAZORPAY_KEY_SECRET'),
    auth = request.headers.get('Authorization')
  if (!url || !anon || !service || !auth?.startsWith('Bearer '))
    return reply(401, { message: 'Authorization required.' })
  if (!keyId || !keySecret) return reply(503, { message: 'Payments are not available yet.' })
  let planKey: unknown
  try {
    const text = await request.text()
    if (text.length > 1024) return reply(400, { message: 'Invalid request.' })
    planKey = JSON.parse(text).planKey
  } catch {
    return reply(400, { message: 'Invalid request.' })
  }
  if (typeof planKey !== 'string' || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(planKey))
    return reply(400, { message: 'Invalid plan.' })
  const options = { auth: { autoRefreshToken: false, persistSession: false } }
  const caller = createClient(url, anon, {
    ...options,
    global: { headers: { Authorization: auth } },
  })
  const admin = createClient(url, service, options)
  const created = await caller.rpc('create_commerce_order', { p_plan_key: planKey })
  if (created.error || !created.data)
    return reply(created.error?.code === 'DX003' ? 409 : 403, {
      message:
        created.error?.code === 'DX003'
          ? 'This plan is not on sale yet.'
          : 'The order could not be created.',
    })
  const order = created.data as {
    orderId: string
    amountPaise: number
    currency: string
    planTitle: string
  }
  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderRequest(order)),
    })
    if (!response.ok) return reply(502, { message: 'The payment provider is unavailable.' })
    const provider = (await response.json()) as { id?: string }
    if (typeof provider.id !== 'string')
      return reply(502, { message: 'The payment provider is unavailable.' })
    const attached = await admin.rpc('attach_commerce_provider_order', {
      p_order_id: order.orderId,
      p_provider_order_id: provider.id,
    })
    if (attached.error) return reply(503, { message: 'The order could not be prepared.' })
    return reply(200, {
      orderId: order.orderId,
      providerOrderId: provider.id,
      keyId,
      amountPaise: order.amountPaise,
      currency: order.currency,
      planTitle: order.planTitle,
    })
  } catch {
    return reply(502, { message: 'The payment provider is unavailable.' })
  }
})
