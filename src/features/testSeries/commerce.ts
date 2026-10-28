import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

/**
 * F049 commerce. Plans start off sale; while they are, nothing can be bought. Paying happens in
 * Razorpay Checkout; access is granted only by the verified Razorpay webhook on the server.
 */

const planSchema = z.array(
  z.object({
    key: z.string(),
    title: z.string(),
    description: z.string(),
    level: z.enum(['bdes', 'mdes']).nullable(),
    pricePaise: z.number().int(),
    currency: z.literal('INR'),
    validityDays: z.number().int(),
    onSale: z.boolean(),
  }),
)

export type Plan = z.infer<typeof planSchema>[number]

const orderSchema = z.array(
  z.object({
    orderId: z.string().uuid(),
    planKey: z.string(),
    planTitle: z.string(),
    amountPaise: z.number().int(),
    status: z.enum(['created', 'paid', 'failed', 'refunded']),
    createdAt: z.string(),
    paidAt: z.string().nullable(),
  }),
)

export type Order = z.infer<typeof orderSchema>[number]

export class CommerceError extends Error {}

export const formatRupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export async function fetchPlans(client: SupabaseClient): Promise<Plan[]> {
  const result = await client.rpc('list_commerce_plans')
  if (result.error) throw new CommerceError('Plans could not be loaded.')
  return planSchema.parse(result.data as unknown)
}

export async function fetchMyOrders(client: SupabaseClient): Promise<Order[]> {
  const result = await client.rpc('list_my_orders')
  if (result.error) throw new CommerceError('Your orders could not be loaded.')
  return orderSchema.parse(result.data as unknown)
}

const checkoutSchema = z.object({
  orderId: z.string().uuid(),
  providerOrderId: z.string(),
  keyId: z.string(),
  amountPaise: z.number().int(),
  currency: z.string(),
  planTitle: z.string(),
})

export type CheckoutOrder = z.infer<typeof checkoutSchema>

/** Creates our order and its Razorpay order through the trusted function. */
export async function createCheckout(
  client: SupabaseClient,
  planKey: string,
): Promise<CheckoutOrder> {
  const result = await client.functions.invoke('commerce-create-order', { body: { planKey } })
  if (result.error) {
    throw new CommerceError('Payments are not available right now. Please try again later.')
  }
  const parsed = checkoutSchema.safeParse(result.data as unknown)
  if (!parsed.success) throw new CommerceError('The payment could not be prepared.')
  return parsed.data
}

type RazorpayOptions = {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description: string
  handler: () => void
  modal: { ondismiss: () => void }
  theme: { color: string }
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void }
  }
}

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CHECKOUT_SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new CommerceError('The payment window could not be opened.'))
    document.head.append(script)
  })
}

/** Opens Razorpay Checkout; resolves when the student completes or closes it. */
export async function openCheckout(order: CheckoutOrder): Promise<'completed' | 'dismissed'> {
  await loadCheckout()
  const Razorpay = window.Razorpay
  if (!Razorpay) throw new CommerceError('The payment window could not be opened.')
  return new Promise((resolve) => {
    new Razorpay({
      key: order.keyId,
      order_id: order.providerOrderId,
      amount: order.amountPaise,
      currency: order.currency,
      name: 'Dexam',
      description: order.planTitle,
      handler: () => resolve('completed'),
      modal: { ondismiss: () => resolve('dismissed') },
      theme: { color: '#c76a2d' },
    }).open()
  })
}
