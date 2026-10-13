# Buffet Pin Direct — Tomorrow's Onsite Checklist

Date: **Tuesday, July 28, 2026**

Time available: **4–6 hours**

Use this as the main checklist. Do not try to remember the system. Follow the boxes in order.

If the long sheet feels like too much, do only this: open this file, start at the first empty box, and tell Codex `I am onsite. Walk me through the next box.` Do not troubleshoot from memory.

## The whole job in one line

Customer pays → one ticket prints → food is prepared → bag is checked → dispatcher gives it to the driver → driver delivers it → money and order match at the end.

## The day in 10 simple steps

1. Keep the real ordering site OFF.
2. Confirm the real Clover device can print to the SP700.
3. Confirm the app's menu matches Clover.
4. Make one safe test order and walk it all the way to Delivered.
5. Prove a declined payment does not print.
6. Prove printer failure stays visible and does not create a mystery duplicate.
7. Prove a reprint says REPRINT.
8. Prove a paid cancellation creates one correct refund.
9. Check SMS, receipt, driver, permissions, totals, and the emergency OFF switch.
10. With permission, make one small real order. Turn ordering OFF again. Decide GO or NO GO.

## Three rules

- Keep **Online ordering OFF** on the live site until the last decision.
- If you do not know whether money moved or a ticket printed, **stop and check**. Do not click again.
- Never paste passwords, tokens, card details, customer addresses, phone numbers, or private tracking links into Codex.

## Write these down first

- Live site: _______________________________________________
- Safe test site connected to Clover sandbox: _______________________________________________
- Release commit: _______________________________________________
- Vercel deployment: _______________________________________________
- Restaurant decision maker: _______________________________________________
- Backup contact: _______________________________________________
- Your test phone number: _______________________________________________
- Driver test phone: _______________________________________________
- Evidence folder: _______________________________________________
- Start time: __________

If the safe test site, release commit, or named decision maker is missing, you can still inspect the printer and app, but you cannot finish a safe launch decision.

## Know which site you are using

There are two separate test paths:

- Use the **protected test site + Clover sandbox** for fake-money success, decline, refund, duplicate, and software-flow tests.
- Use the **live site + Clover production** only for the one approved low-value real order near the end.

The restaurant's real Clover device and SP700 may not belong to the Clover sandbox merchant. If they do not, a sandbox order will not prove that the live SP700 prints. That is expected, not a reason to reconnect environments.

- [ ] Ask Clover which merchant is open: Sandbox / Live.
- [ ] Ask Clover which merchant owns the default firing device: Sandbox / Live.
- [ ] If a sandbox Clover device is connected to the SP700, mark: `SANDBOX CAN PRINT`.
- [ ] Otherwise mark: `PHYSICAL APP PRINT REQUIRES LIVE SMOKE`.
- [ ] Never put production Clover credentials into the protected sandbox site.
- [ ] Never put sandbox Clover credentials into the live production site.

---

## Before you leave for the restaurant

Do this before spending any of the four-to-six onsite hours.

### Laptop and accounts

- [ ] Laptop charged.
- [ ] Charger packed.
- [ ] Phone charger packed.
- [ ] Hotspot works.
- [ ] You can sign in to Vercel.
- [ ] You can sign in to Clover and receive its MFA code.
- [ ] You can sign in to Neon.
- [ ] You can sign in to Supabase.
- [ ] You can sign in to Twilio.
- [ ] You can sign in to the Buffet Pin admin page.
- [ ] The driver test phone can open a web link.
- [ ] The restaurant decision maker will be available for the first 15 minutes and the last 20 minutes.

### Things to bring

- [ ] Approved test card or payment method.
- [ ] SP700 bond-paper rolls.
- [ ] A working SP700 ribbon or spare ribbon.
- [ ] Pen and paper.
- [ ] Tape or bag labels.
- [ ] One small bag for the fake delivery.
- [ ] A second device or private browser window for the customer.
- [ ] A phone for the driver screen.

### Prove the exact code before leaving

Open Terminal:

```bash
cd /Users/daniel/buffet-pin
nvm use
npm ci
npm run verify
npm audit --audit-level=high
```

- [ ] Every command passed.
- [ ] Docker Desktop was running for the database tests.
- [ ] The release commit above contains the exact code that passed.
- [ ] That exact commit is deployed.

Run the live-site safety check without saving production secrets to a file:

```bash
npx vercel env run -e production -- npm run launch:preflight:production:probe
```

- [ ] It says `Launch production preflight PASS`.
- [ ] It says health/readiness passed.
- [ ] It says online intake remains paused.

If this command does not pass, fix it before travelling.

### Live services

- [ ] A fresh Neon backup exists.
- [ ] All database migrations are applied.
- [ ] The live app opens.
- [ ] `<LIVE SITE>/api/health` shows `"ok": true`.
- [ ] `<LIVE SITE>/api/readiness` shows `"intakeEnabled": false`.
- [ ] Vercel monitoring/log access works.
- [ ] The safe test site uses Clover **sandbox**, not production.
- [ ] The safe test site is private or protected from ordinary customers.
- [ ] The live site uses Clover **production**, but ordering is still off.
- [ ] The live Clover webhook URL points to `<LIVE SITE>/api/webhooks/clover`.
- [ ] The live Clover Platform webhook URL points to `<LIVE SITE>/api/webhooks/clover/platform`.

---

# At the restaurant

Start a timer. Do not enable the live site.

## 0:00–0:20 — Open everything and make it safe

Open these tabs. Replace `<LIVE SITE>` with the real domain:

1. `<LIVE SITE>/admin/settings/orders`
2. `<LIVE SITE>/dev/machine-test`
3. `<LIVE SITE>/dev/clover/catalog`
4. `<LIVE SITE>/admin/orders`
5. `<LIVE SITE>/admin/production`
6. `<LIVE SITE>/admin/dispatch`
7. `<LIVE SITE>/dev/operations`
8. `<LIVE SITE>/dev/reconciliation`
9. `<LIVE SITE>/admin/drivers`
10. `<LIVE SITE>/api/health`
11. `<LIVE SITE>/api/readiness`
12. Clover Dashboard
13. Twilio Messaging logs
14. Vercel logs

On **Order settings**:

- [ ] Turn **Online ordering OFF**.
- [ ] Turn **Delivery OFF**.
- [ ] Set **Maximum active orders** to `4`.
- [ ] Leave **Busy mode OFF** for testing.
- [ ] Set **Extra minutes in busy mode** to the restaurant-approved number.
- [ ] Leave **Allow partial refunds OFF**.
- [ ] Enter the approved business legal name.
- [ ] Enter the approved receipt address.
- [ ] Enter the approved receipt phone.
- [ ] Enter the approved tax registration number.
- [ ] Check the delivery radius.
- [ ] Check the delivery fee.
- [ ] Check the minimum order.
- [ ] Click **Save changes**.
- [ ] See `Order settings saved.`

Now check:

- [ ] Health says `healthy`.
- [ ] Readiness says `intake_paused`.
- [ ] Readiness says `intakeEnabled: false`.
- [ ] **Operations & recovery** has no unexplained critical alert.

Write any existing alert here:

---

**STOP** if the live site is taking orders, health is bad, or a critical alert cannot be explained.

## 0:20–0:50 — Identify and test the SP700

Do not unplug anything yet.

Open `https://buffetpin.com/dev/machine-test` for the owner-approved real-money hardware test. Keep public ordering off. Press **Run live test**. It rejects fake, sandbox, incomplete Clover, or open-public-ordering configuration; checks the live credentials with a read-only merchant request; and gives this manager browser one 15-minute, single-use checkout pass. Press **Open order page** and complete exactly one small order. The page follows only that new paid order and gives a plain-English diagnosis for payment, Clover-order, print-request, timeout, uncertainty, no-ticket, or duplicate-ticket results. The pass skips storefront/zone availability only. It does not bypass payment or send an extra print.

- [ ] Take a photo of the printer's back/bottom model label.
- [ ] Hide the serial number before sharing the photo.
- [ ] Write the full model: _______________________________________________
- [ ] Write the connection type: Ethernet / USB / serial / parallel / other.
- [ ] Check that paper is loaded.
- [ ] Check that the ribbon prints dark enough.
- [ ] Check that the red error light is off.

Print the printer's own settings:

1. Turn the printer off.
2. Hold the **FEED** button.
3. Turn the printer on while holding **FEED**.
4. Release **FEED** after the first buzzer.
5. Keep the printed version/settings page.

- [ ] Self-test printed.
- [ ] Text is dark and readable.
- [ ] Model/version/interface are recorded.
- [ ] If it is a tear-bar model, paper tears cleanly.
- [ ] If it is a cutter model, the cutter works.

On the Clover device:

1. Open **Setup**.
2. Open **Devices**.
3. Confirm the correct Clover device is the default firing device.
4. Confirm the SP700-family printer is its order printer.
5. Open the Clover Orders app.
6. Print one order marked clearly as `TEST`.

- [ ] Exactly one Clover test ticket printed.
- [ ] It came from the correct printer.
- [ ] It did not also print from an unwanted Clover onboard printer.

This proves Clover can reach the printer. It does **not** yet prove that Buffet Pin can send the live ticket.

If nothing prints:

1. Check paper, ribbon and error light.
2. Check the cable/network.
3. Check Clover **Setup → Devices** again.
4. Correct one known setting.
5. Try one more test.

**STOP after 30 minutes** if Clover itself cannot print to this printer. App code cannot fix a broken Clover-to-printer connection.

## 0:50–1:20 — Check Clover and the menu

Use the safe test site and Clover sandbox for this section. Do not expect its ticket to reach the restaurant SP700 unless you marked `SANDBOX CAN PRINT` above.

Open `<TEST SITE>/admin/settings/orders`:

- [ ] Online ordering is ON only on this protected test site.
- [ ] Delivery is ON.
- [ ] Maximum active orders is `4`.
- [ ] Partial refunds are OFF.
- [ ] Click **Save changes**.

Open `<TEST SITE>/dev/clover/catalog`:

1. Click **Reread all mappings**.
2. Wait for the report.

- [ ] The heading says **Ready**.
- [ ] The verified count equals the required count.
- [ ] There are zero blockers.

If there is a blocker:

1. Click the blocker.
2. Find the matching item, modifier, tax, charge, or order type in Clover.
3. Copy only its Clover ID into **Clover ID**.
4. Enter the exact Clover name when asked.
5. Enter the exact Clover tax rate when asked.
6. Enter: `Confirmed in Clover on 2026-07-28 by <your name>`.
7. Click **Read and verify**.
8. Repeat until the page says **Ready**.

Check the launch menu:

- [ ] Every launch item exists in Clover.
- [ ] Every modifier exists and belongs to the correct item.
- [ ] Prices match.
- [ ] Taxes match.
- [ ] Delivery fee/service charge matches.
- [ ] Sold-out items cannot be bought.

**STOP** if the catalog page is blocked. Do not “just try” a payment with bad mappings.

## 1:20–1:35 — Prepare the driver phone

Open `<TEST SITE>/admin/drivers`:

- [ ] Add or select the test driver.
- [ ] Confirm the driver is **Active**.
- [ ] Click **Zones & shifts**.
- [ ] Check the delivery zone you will use.
- [ ] Set the shift from now until after the test ends.
- [ ] Use reason: `Onsite launch test 2026-07-28`.
- [ ] Click **Save operations**.
- [ ] Return to Drivers.
- [ ] Click **Regenerate**.
- [ ] Click **Copy link**.
- [ ] Open the copied link on the driver phone.
- [ ] The driver phone reaches **My delivery runs**.

Do not paste the driver link into Codex. It is a private login link.

## 1:35–2:30 — Complete one normal order

This is the most important test.

On a customer phone/private browser, open `<TEST SITE>/order`.

Build an obvious test order:

- [ ] At least two different items.
- [ ] Quantity `2` on one item.
- [ ] At least one modifier.
- [ ] One drink if drinks are in the launch menu.
- [ ] Note: `TEST - sans oignons - élève`.
- [ ] A real test address inside the delivery zone.
- [ ] Your own consenting phone and email.

Before paying:

- [ ] Screenshot the app total.
- [ ] Write the subtotal: __________
- [ ] Write the tax: __________
- [ ] Write the delivery fee: __________
- [ ] Write the tip: __________
- [ ] Write the total: __________

Pay only inside Clover's payment frame. Use Clover's official sandbox success card from its [test-card page](https://docs.clover.com/dev/docs/test-card-numbers). Do not paste the number into Codex or any Buffet Pin field.

After paying:

- [ ] The customer sees a success page.
- [ ] Write the Buffet Pin order number: __________________________________
- [ ] Save the private customer status page only in the secure evidence folder.
- [ ] Clover Dashboard shows exactly one order.
- [ ] Clover shows exactly one successful payment.
- [ ] Clover total matches the app total.
- [ ] If `SANDBOX CAN PRINT`: exactly one kitchen ticket prints.
- [ ] If not: mark the physical sandbox print `NOT RUN`; prove the exact app-to-SP700 path during the approved live smoke.

On `<TEST SITE>/dev/machine-test`:

- [ ] Confirm the owner-approved amount and test card, then press **Run live test** and **Open order page**.
- [ ] Complete one small paid order.
- [ ] The page finds that new order and shows its payment, Clover, and printer states.
- [ ] Answer what came out of the SP700: **One ticket**, **Nothing**, or **More than one**.
- [ ] Save the final diagnosis with the ticket photos and Clover evidence.

Check the ticket:

- [ ] Same Buffet Pin order number.
- [ ] Correct item names.
- [ ] Correct quantities.
- [ ] Correct modifiers.
- [ ] Correct note and readable accents.
- [ ] Correct total if the ticket shows a total.
- [ ] No private tracking link.
- [ ] No card data.

Open `<TEST SITE>/dev/operations`:

- [ ] The Print queue shows this order.
- [ ] It shows `INITIAL`.
- [ ] If `SANDBOX CAN PRINT`: it reaches `PRINTED`.
- [ ] If not: record the sandbox provider result without pretending it proves the live printer.

If it says `PENDING`, click **Submit** once.

If it says `SUBMITTED` or `PRINTING`, wait and refresh. Do not submit another print.

If it says `UNKNOWN`, search the printer and Clover first. Do not retry.

Move the order through the kitchen:

Open `<TEST SITE>/admin/production`.

- [ ] Find the same order number.
- [ ] The page says payment is paid.
- [ ] The page says the ticket is confirmed.
- [ ] Click **ACCEPTED**.
- [ ] Click **PREPARING**.
- [ ] Click **PACKING**.
- [ ] Click every **Verify modifiers & qty** button.
- [ ] Read the note and click its instruction verification.
- [ ] Click **PACKED**.
- [ ] Put the labelled test bag at the actual dispatch desk.
- [ ] Click **AT DISPATCH DESK**.

Dispatch it:

Open `<TEST SITE>/admin/dispatch`.

- [ ] Select the same order number.
- [ ] Select the test driver.
- [ ] Read the route suggestion.
- [ ] Click **Use this suggestion** if it is correct.
- [ ] Click **Approve run**.
- [ ] Click **Verify bag** only while holding the correct bag.

On the driver phone:

- [ ] The run appears.
- [ ] The same order number appears.
- [ ] The correct address appears.
- [ ] Click **Verify pickup** while holding the bag.
- [ ] Click **En route**.
- [ ] Carry the bag through a short real movement or agreed test route.
- [ ] Click **Delivered** at the test destination.

Back on the customer status page:

- [ ] It shows delivered.
- [ ] It never showed paid before Clover confirmed payment.
- [ ] It did not expose staff-only notes.
- [ ] The digital receipt opens.
- [ ] Receipt order number and totals match.
- [ ] Receipt business details are correct.

You have now proved the main product.

## 2:30–3:00 — Prove a declined payment is safe

On the protected test site:

1. Start a new small order.
2. Use Clover's official sandbox decline card from its [test-card page](https://docs.clover.com/dev/docs/test-card-numbers).

- [ ] Customer sees a safe payment-failed message.
- [ ] No kitchen ticket prints.
- [ ] No paid order appears in Production.
- [ ] Clover does not show a successful charge.
- [ ] Retrying from the customer page does not change the failed attempt into a fake paid order.

**STOP** if a declined or unpaid order prints or enters Production.

## 3:00–3:30 — Prove printer failure is safe

Run this section only if the sandbox Clover device actually uses this SP700. Otherwise mark it `NOT RUN` and rehearse the written recovery steps without turning off the live printer.

Warn the restaurant before turning off the test printer.

1. Turn the SP700 off.
2. Place and successfully pay for one small **sandbox** test order.
3. Write its order number: __________________________________
4. Wait at least two minutes.
5. Refresh `<TEST SITE>/dev/operations`.

- [ ] The paid order stays visible.
- [ ] It does not enter Production as a confirmed printed order.
- [ ] A paid-unprinted problem becomes visible.
- [ ] Nobody prepares the food.
- [ ] No one blindly presses Submit again.

Now turn the printer back on.

- [ ] Watch whether the original ticket prints by itself.
- [ ] Write what happened: _______________________________________________
- [ ] Check Clover and the Print queue before taking any recovery action.
- [ ] Exactly one active kitchen ticket is identified.

If the original result is known failed, **Authorize retry** once with reason:

`Printer restored during onsite test 2026-07-28`.

If the result is `UNKNOWN`, do not retry. Search the physical printer and Clover first.

**STOP** if recovery creates two unmarked initial tickets or loses the paid order.

## 3:30–3:50 — Prove reprints are not mistaken for new orders

Use the successful normal order.

Open `<TEST SITE>/admin/orders`:

1. Open the order.
2. Click **Print labelled reprint**.
3. Enter: `Onsite reprint test 2026-07-28`.
4. Complete the browser print dialog using the approved fallback printer/path.
5. Click **Confirm labelled reprint** only after paper comes out.

- [ ] Reprint clearly says `REPRINT`.
- [ ] Reprint has the same order number.
- [ ] The original order did not change into a new order.
- [ ] The event history records who requested it and why.

Put the reprint aside and mark it `TEST — DO NOT PREPARE`.

## 3:50–4:15 — Prove cancellation and refund

Place one more small successful sandbox order. Do not start preparing it.

Write its order number: __________________________________

Open `<TEST SITE>/admin/orders`:

1. Find the new paid order.
2. Click **Reject**.
3. Enter: `Onsite paid rejection and refund test 2026-07-28`.

- [ ] The order leaves the normal production flow.
- [ ] It appears in **Problem/refund**.
- [ ] Production shows a stop/refund warning until the refund is settled.
- [ ] Clover shows one refund for the correct amount.
- [ ] The app shows `Refunded`.
- [ ] Customer status says refunded.
- [ ] Customer notification does not claim success before Clover confirms it.
- [ ] Clicking the same action again cannot create a second refund.

Open `<TEST SITE>/dev/operations`:

- [ ] There is no unresolved refund.
- [ ] If a refund is `UNKNOWN`, check Clover first. Do not submit another refund.

**STOP** if the refund amount is wrong, duplicates, or remains unexplained.

## 4:15–4:35 — Check SMS and daily close

In Twilio Messaging logs:

- [ ] The successful-order message exists.
- [ ] The refund message exists.
- [ ] Messages went only to your consenting test phone.
- [ ] Delivery status callbacks reached the app.
- [ ] The customer link is private and works.
- [ ] No secret, card data, or internal note appears in the message.

Open `<TEST SITE>/dev/reconciliation`.

1. Select today's date.
2. Prepare sanitized Clover rows using the template at the bottom of this file.
3. Include IDs and cent amounts only.
4. Click **Import and compare**.

- [ ] Local payment count matches Clover.
- [ ] Local payment total matches Clover.
- [ ] Refund total matches Clover.
- [ ] Tax matches.
- [ ] Tip matches.
- [ ] Delivery fee matches.
- [ ] Exception count is `0`, or every exception has a true written explanation.

Do not press **Resolve with evidence** unless you actually have the Clover evidence.

## 4:35–5:10 — Check four-order delivery capacity

Do this if time remains. Use sandbox orders marked `TEST`.

- [ ] Create enough paid test orders to have five bags at the dispatch desk.
- [ ] Move each through Production and packing.
- [ ] On Dispatch, select four.
- [ ] Confirm the fifth checkbox cannot be added.
- [ ] Approve the four-order run.
- [ ] Confirm the stop order does not change by itself.
- [ ] Confirm every bag number matches.
- [ ] Try to put an already-assigned order into another run.
- [ ] Confirm the app rejects it.
- [ ] Complete or cancel the test run cleanly.

## 5:10–5:30 — Check permissions and emergency stop

- [ ] Driver link cannot open admin settings.
- [ ] Operator account cannot edit the Clover catalog.
- [ ] Reporting account cannot create a delivery run.
- [ ] Deactivate the test driver.
- [ ] Confirm the old driver link can no longer act.
- [ ] Reactivate only if the restaurant approves it.

On the protected test site:

1. Open **Order settings**.
2. Turn **Online ordering OFF**.
3. Click **Save changes**.
4. Try to start a customer order.

- [ ] New checkout is blocked.
- [ ] Existing paid orders remain visible.
- [ ] Turning orders off did not delete or cancel anything.

This is the kill-switch test.

## 5:30–5:50 — Optional live production smoke

This is required to prove the real Buffet Pin → live Clover → SP700 path when the restaurant printer is not connected to the sandbox merchant.

Do this only if:

- every earlier red **STOP** condition is clear;
- the restaurant decision maker approves a real low-value charge;
- the exact live amount, card, phone, address and refund plan are approved;
- the live site is healthy;
- the live catalog says Ready;
- the live printer path already passed;
- monitoring and support are present.

On the live site:

1. Keep the order cap at `4`.
2. Turn Delivery ON.
3. Turn Online ordering ON only for the approved test window.
4. Place one low-value real order using your own information.
5. Complete payment, one ticket, production, packing, desk, one-order run, delivery, receipt and reconciliation.
6. Immediately turn Online ordering OFF again.

- [ ] Exactly one real charge.
- [ ] Exactly one Clover order.
- [ ] Exactly one kitchen ticket.
- [ ] Same order number everywhere.
- [ ] Correct bag and delivery.
- [ ] Correct SMS and receipt.
- [ ] Correct daily reconciliation.
- [ ] No critical alert.
- [ ] Online ordering is OFF again.

Do a real refund only if it was separately approved before starting.

## 5:50–6:00 — Final answer: GO or NO GO

Write `PASS`, `FAIL`, or `NOT RUN`:

- Normal order: __________
- Decline: __________
- Printer outage/recovery: __________
- Reprint: __________
- Refund: __________
- Driver delivery: __________
- SMS: __________
- Reconciliation: __________
- Kill switch: __________
- Live smoke: __________
- Receipt/legal approval: __________
- Backup/support ready: __________

### Automatic NO GO

Do not enable public ordering if any answer below is yes:

- [ ] Did an unpaid or uncertain order print?
- [ ] Did an unpaid or uncertain order enter Production?
- [ ] Did one payment create two charges?
- [ ] Did one payment create two unmarked initial tickets?
- [ ] Was a paid order missing from staff screens?
- [ ] Is any payment or refund result still unknown?
- [ ] Could the printer not recover safely?
- [ ] Did totals differ between app and Clover?
- [ ] Did the same order number fail to follow ticket, bag and driver?
- [ ] Did an unauthorized account perform a protected action?
- [ ] Is a critical alert still open?
- [ ] Is there no support person or kill switch?
- [ ] Is receipt/tax approval missing?

If any box is checked, the answer is **NO GO**. Leave Online ordering OFF.

### If everything passed

- [ ] Restaurant decision maker writes `GO`.
- [ ] Approved pilot hours: __________________________________
- [ ] Approved pilot menu: __________________________________
- [ ] Approved delivery area: __________________________________
- [ ] Maximum active orders: __________________________________
- [ ] Person watching orders: __________________________________
- [ ] Person dispatching: __________________________________
- [ ] Driver: __________________________________
- [ ] Technical support: __________________________________
- [ ] Stop conditions reviewed.
- [ ] Online ordering is enabled only for the approved pilot window.
- [ ] Someone watches the first real service continuously.

Decision: **GO / NO GO**

Decision maker: __________________________________

Time: __________________________________

Signature/note: __________________________________

---

## If something breaks

Do this in order:

1. Turn **Online ordering OFF**.
2. Do not click payment, print, or refund again if the first result is unknown.
3. Write the time and Buffet Pin order number.
4. Take a screenshot with personal information hidden.
5. Check Clover/Twilio before guessing what happened.
6. Tell Codex:
   - which page you were on;
   - which button you clicked;
   - the order number;
   - the exact error message;
   - whether Clover shows money moved;
   - whether paper came out.
7. Make only one small fix at a time.
8. Run the focused test.
9. Run `npm run verify`.
10. Deploy with Online ordering OFF.
11. Repeat the failed test.

Do not make an untested live hotfix because time is running out.

## Sanitized reconciliation row

Ask Codex to help fill this using Clover IDs and cent amounts. Do not include names, addresses, phone numbers, card numbers, or full Clover payloads.

```json
[
  {
    "providerPaymentId": "CLOVER_PAYMENT_ID",
    "providerOrderId": "CLOVER_ORDER_ID",
    "amountCents": 0,
    "refundedAmountCents": 0,
    "tipCents": 0,
    "taxCents": 0,
    "deliveryFeeCents": 0,
    "currency": "CAD"
  }
]
```
