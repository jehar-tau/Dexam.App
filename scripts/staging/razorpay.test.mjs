// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  orderRequest,
  parsePaidEvent,
  signWebhookBody,
  verifyWebhookSignature,
} from '../../supabase/functions/_shared/razorpay.mjs'

const secret = 'fictional-webhook-secret'
const captured = {
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_FictionalAbc123',
        order_id: 'order_FictionalXyz789',
        status: 'captured',
        amount: 149900,
        currency: 'INR',
      },
    },
  },
}

describe('Razorpay webhook verification', () => {
  it('accepts only the HMAC of the exact raw body', async () => {
    const body = JSON.stringify(captured)
    const signature = await signWebhookBody(body, secret)
    expect(await verifyWebhookSignature(body, signature, secret)).toBe(true)
    expect(await verifyWebhookSignature(`${body} `, signature, secret)).toBe(false)
    expect(await verifyWebhookSignature(body, signature, 'other-secret')).toBe(false)
    expect(await verifyWebhookSignature(body, signature.toUpperCase(), secret)).toBe(false)
    expect(await verifyWebhookSignature(body, '', secret)).toBe(false)
    expect(await verifyWebhookSignature(body, signature, '')).toBe(false)
  })
})

describe('paid events', () => {
  it('reads a captured payment', () => {
    expect(parsePaidEvent(captured, 'evt_1')).toEqual({
      eventId: 'evt_1',
      providerOrderId: 'order_FictionalXyz789',
      paymentId: 'pay_FictionalAbc123',
      amountPaise: 149900,
      currency: 'INR',
    })
    expect(parsePaidEvent({ ...captured, event: 'order.paid' }, 'evt_2')?.paymentId).toBe(
      'pay_FictionalAbc123',
    )
  })

  it('ignores anything that should not grant access', () => {
    expect(parsePaidEvent({ ...captured, event: 'payment.failed' }, 'evt')).toBeNull()
    const authorised = structuredClone(captured)
    authorised.payload.payment.entity.status = 'authorized'
    expect(parsePaidEvent(authorised, 'evt')).toBeNull()
    const dollars = structuredClone(captured)
    dollars.payload.payment.entity.currency = 'USD'
    expect(parsePaidEvent(dollars, 'evt')).toBeNull()
    const badOrder = structuredClone(captured)
    badOrder.payload.payment.entity.order_id = "order_x'; drop"
    expect(parsePaidEvent(badOrder, 'evt')).toBeNull()
    expect(parsePaidEvent(captured, '')).toBeNull()
    expect(parsePaidEvent(null, 'evt')).toBeNull()
  })

  it('builds the Razorpay order request from our order', () => {
    expect(
      orderRequest({
        orderId: '00000000-0000-4000-8000-0000000000e1',
        amountPaise: 69900,
        currency: 'INR',
      }),
    ).toEqual({
      amount: 69900,
      currency: 'INR',
      receipt: '00000000-0000-4000-8000-0000000000e1',
      notes: { dexam_order_id: '00000000-0000-4000-8000-0000000000e1' },
    })
  })
})
