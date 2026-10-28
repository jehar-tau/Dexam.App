# F049 — Commerce in test mode (redesign step 8b, R2)

Status: Implemented locally 2026-10-28 under D-054 A and D-057; in review. **Every plan is off sale.** Public paid sales still wait for the legal view required by D-054, and for owner-approved prices, refunds and expiry.

## What exists

**Plans** (`commerce_plans`, draft prices, all `on_sale = false`):

| Plan                | Price (draft) | Grants                                                                  | Validity |
| ------------------- | ------------- | ----------------------------------------------------------------------- | -------- |
| B.Des all-exam pass | ₹1,499        | Every UCEED, NID B.Des and NIFT B.Des paper; UCEED and NIFT B.Des mocks | 365 days |
| M.Des all-exam pass | ₹1,499        | Every CEED, NID M.Des and NIFT M.Des paper; CEED and NIFT M.Des mocks   | 365 days |
| UCEED bundle        | ₹699          | Every UCEED paper; UCEED mocks                                          | 365 days |
| CEED bundle         | ₹699          | Every CEED paper; CEED mocks                                            | 365 days |

**Flow:**

1. **Plans page** (`/tests/plans`). It shows "Opening soon" while nothing is on sale; locked papers and mocks link to it.
2. **Buy** calls the `commerce-create-order` Edge Function:
   - the database creates the student's own order, and refuses plans that are not on sale (`DX003`);
   - the function creates a Razorpay order with server-held keys and attaches it;
   - without Razorpay keys the function returns 503.
3. **Razorpay Checkout** opens in the browser. The page then waits for the order to show as paid.
4. **Webhook:** `commerce-razorpay-webhook` accepts only an `X-Razorpay-Signature` that is the HMAC-SHA256 of the raw body with `RAZORPAY_WEBHOOK_SECRET`, compared in constant time. For a captured INR payment, `fulfil_commerce_order` then:
   - processes each event id once (`commerce_events`);
   - refuses an amount or currency that does not match the order;
   - marks the order paid once;
   - grants **purchase** entitlements: every bank paper in the plan's exam slots, and `mock-<key>` for its mocks (unlimited mocks while valid), until the plan's validity ends. Free papers stay free.

   A transient failure returns 503, so Razorpay retries.

5. **Orders:** students see their orders on the Plans page (`list_my_orders`). Coaching students already have everything, so their Buy is disabled.

## Security

- **Tables:** `commerce_plans`, `commerce_orders` and `commerce_events` have no browser grants.
- **Service role only:** `attach_commerce_provider_order` and `fulfil_commerce_order`.
- **Access is granted only server-side, from a verified webhook.** The browser's "payment completed" signal never grants anything.
- **Secrets:** Razorpay keys and the webhook secret live only in Edge Function secrets. None is configured anywhere yet.

## To go live (owner)

1. Get the legal view on selling official-paper practice (D-054).
2. Approve prices, the refund policy and validity. Pricing, refunds and expiry are Decision Gates.
3. Create a Razorpay account; start in test mode with test keys. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` as Edge Function secrets, and point the Razorpay webhook (`payment.captured`, `order.paid`) at `/functions/v1/commerce-razorpay-webhook`.
4. Switch the chosen plans to `on_sale` with a reviewed migration.

## Not yet

GST invoices, refunds handling (`refunded` status exists, with no flow yet), coupons, and an admin sales view.

## Verification

- pgTAP `00460_commerce_plans_orders.test.sql` (25 checks):
  - no browser access to orders or fulfilment;
  - every plan starts off sale, and off-sale or unknown plans are refused;
  - a provider order is attached once;
  - mismatched amounts and unknown orders are refused;
  - paying once, and duplicate events changing nothing;
  - unlocking only the plan's exam papers and mocks;
  - validity, and free papers staying free;
  - isolation between students.
- Vitest:
  - `scripts/staging/razorpay.test.mjs`: signature verification against tampering, the wrong secret and the wrong form; paid-event parsing that refuses failed, authorised-only, non-INR and malformed events; the order request.
  - `TestsPlansPage.test.tsx`: the off-sale state, and the Checkout flow waiting for the webhook.
