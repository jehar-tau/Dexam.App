// F049 Razorpay helpers shared by the commerce Edge Functions (Deno) and tested in Node.
// Webhooks are trusted only when the X-Razorpay-Signature header is the HMAC-SHA256 of the raw
// request body with the webhook secret, compared in constant time.

const encoder = new TextEncoder()

export const maxWebhookBytes = 64 * 1024

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return difference === 0
}

/** True only for a well-formed signature that matches the raw body and secret. */
export async function verifyWebhookSignature(rawBody, signature, secret) {
  if (typeof rawBody !== 'string' || !secret || typeof signature !== 'string') return false
  if (!/^[0-9a-f]{64}$/.test(signature)) return false
  return constantTimeEqual(await hmacHex(secret, rawBody), signature)
}

/** For tests and local simulation only: the signature Razorpay would send. */
export function signWebhookBody(rawBody, secret) {
  return hmacHex(secret, rawBody)
}

const orderPattern = /^order_[A-Za-z0-9]{6,40}$/
const paymentPattern = /^pay_[A-Za-z0-9]{6,40}$/

/**
 * The paid order in a webhook, or null for events that do not grant access.
 * Accepts `payment.captured` and `order.paid`.
 */
export function parsePaidEvent(payload, eventId) {
  if (!payload || typeof payload !== 'object') return null
  if (payload.event !== 'payment.captured' && payload.event !== 'order.paid') return null
  const payment = payload.payload?.payment?.entity
  if (!payment || payment.status !== 'captured') return null
  const orderId = payment.order_id
  const paymentId = payment.id
  if (!orderPattern.test(orderId ?? '') || !paymentPattern.test(paymentId ?? '')) return null
  if (!Number.isInteger(payment.amount) || payment.amount <= 0 || payment.currency !== 'INR')
    return null
  const id =
    typeof eventId === 'string' && eventId.length > 0 && eventId.length <= 120 ? eventId : null
  if (!id) return null
  return {
    eventId: id,
    providerOrderId: orderId,
    paymentId,
    amountPaise: payment.amount,
    currency: payment.currency,
  }
}

/** The Razorpay Orders API request for one of our orders. */
export function orderRequest(order) {
  return {
    amount: order.amountPaise,
    currency: order.currency,
    receipt: order.orderId.slice(0, 40),
    notes: { dexam_order_id: order.orderId },
  }
}
