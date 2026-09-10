# Decisions

## Reservation settings switch — 2026-09-09

The user authorized deploying only this reservation change on top of main, exposing a switch in reservation settings, and altering the database provided no data is lost. Online reservations start disabled. Public booking links are hidden; `/reservation` shows a short, large bilingual call-to-reserve message and clickable `(450) 699-8088`, not a redirect. Existing guest management/cancellation and all historical data are preserved. The switch is restricted to existing authenticated administrators and changes are recorded transactionally with actor and timestamp. No unrelated delivery-launch changes are included.


The user identified that the main-based deployment regressed an already-deployed image fix and asked to retain private shared storage, suggesting a dedicated Buffet Pin bucket. The existing dedicated private bucket and CDN were verified and reused; only the prior media URL mapping was restored. No duplicate bucket or public S3 policy is introduced.


## Online reservation guest limit — 2026-09-10

User requires a maximum of five online and phone reservations for six or more, using existing UI elements and only this change on the deployed version. Preserve current availability flag and staff larger-party bounds while allowing staff to manage the new small online bookings; public policy is independent of legacy staff min/max settings. Historical larger bookings retain contact editing and cancellation, while rescheduling at six or more requires calling.
