# YYC Table: interactive demo

An interactive demo of **YYC Table**, a QR-code ordering system for pubs, bars and cafes (fictional venue: Ember & Oak Public House, Calgary).
It runs entirely in your browser: **no server, no database, no real payments.** Everything you do stays on your device.

**Live demo:** _add your Cloudflare Pages link here_

## Try it
1. Open the live demo and press **Open Table 7 as a guest** (best on a phone).
2. Place an order (pay at the table, or pay now with the mock test checkout).
3. In a **second tab of the same browser** open **Kitchen**, **Bar**, **Waiter** or **Admin** and move the order forward. The guest screen updates.

## What it shows
- Guest flow in 5 languages (English, Punjabi, Simplified Chinese, Spanish, Arabic with right-to-left layout), 3 colour themes with background photos
- Menu with photos, allergen and dietary tags, cart with notes, GST, tips, receipt, rating
- Pay now or pay at the table; pay-now orders reach the kitchen only after payment
- Kitchen and bar screens with a wait timer that starts when the kitchen presses Accept; stage messages for the guest
- Waiters assigned by workload; waiter screen with Ready alerts and mark-as-paid
- Admin: prices, "86" an item, Happy Hour discount, busy hour, reassign orders, demo reset

## Run locally
```
pnpm install
pnpm dev        # development
pnpm build      # static site in static-demo/dist
pnpm test       # end-to-end tests (Playwright)
```

## Tech
TypeScript, React, Vite, Tailwind CSS, Playwright. Order logic (workload assignment, wait-time stages, ticket state machine, money and tax maths, promo windows) is plain TypeScript in `lib/`.

## About
This is a portfolio demo of a larger full-stack application (Next.js, PostgreSQL, Stripe) that is not part of this repository.
Texts and translations are drafts. Photos: see CREDITS-photos.md and CREDITS-backgrounds.md.

**All rights reserved.** Demo for portfolio purposes. Please do not copy or reuse the code without permission.
