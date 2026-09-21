# Decisions

## Reservation settings switch — 2026-09-09

The user authorized deploying only this reservation change on top of main, exposing a switch in reservation settings, and altering the database provided no data is lost. Online reservations start disabled. Public booking links are hidden; `/reservation` shows a short, large bilingual call-to-reserve message and clickable `(450) 699-8088`, not a redirect. Existing guest management/cancellation and all historical data are preserved. The switch is restricted to existing authenticated administrators and changes are recorded transactionally with actor and timestamp. No unrelated delivery-launch changes are included.


The user identified that the main-based deployment regressed an already-deployed image fix and asked to retain private shared storage, suggesting a dedicated Buffet Pin bucket. The existing dedicated private bucket and CDN were verified and reused; only the prior media URL mapping was restored. No duplicate bucket or public S3 policy is introduced.


## Online reservation guest limit — 2026-09-10

User requires a maximum of five online and phone reservations for six or more, using existing UI elements and only this change on the deployed version. Preserve current availability flag and staff larger-party bounds while allowing staff to manage the new small online bookings; public policy is independent of legacy staff min/max settings. Historical larger bookings retain contact editing and cancellation, while rescheduling at six or more requires calling.

## Drinks image page — 2026-09-12
User selected the supplied Drinks.jpg as the public drinks menu, #020305 page/header/footer background, white header/footer text and existing site content width. Implement as an opt-in layout theme; admin catalog data remains intact. Deployment authorized for this scoped change only.

## Drinks catalog — 2026-09-13
User authorizes replacing the temporary menu cover with the editable catalog, uploading the 15 approved generated images, simplifying admin title/price edits and deploying the scoped release. Reference images provide content, not photographic style. Preserve the dark public theme. Generated packaged products use the verified 330mL Corona/Perrier and 300mL Oasis formats. The existing 24 sample entries are retained hidden. Reference menus contain no prices; no seed price is represented as an approved selling price. Blank prices remain unpublished until entered by staff. New drinks start hidden in the editor. Migration and import affect drinks only; booking and ordering remain disabled.


## Online reservation range — 2026-09-15
User supersedes the five-person policy: online reservations are now for groups of 6–12, and authorizes deployment of only this change. Default six; existing copy directs other sizes to phone reservations. No new controls or layout changes. Preserve current live booking-enabled setting, staff capabilities, and all historical records; existing outside-range parties retain contact edits/cancellation and may change into the valid range online.


## Reservation copy correction — 2026-09-20
User requests July wording with the guest threshold changed from 15 to 12, and explicitly authorizes deployment when done. Only restore the original French/English call-guidance strings with that number substitution; retain the current 6–12 policy/default six, switch state, UI, and separate 15% fee copy.


## Functional July reservation restoration — 2026-09-20
User explicitly requests and authorizes publishing the functional July restoration, not only copy: restore shared configured min/max validation and original management behavior, set existing maximum 15→12 through a guarded versioned migration, and preserve all other settings, existing reservations and current booking switch.
