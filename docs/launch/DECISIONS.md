# Decisions

## Reservation settings switch — 2026-09-09

The user authorized deploying only this reservation change on top of main, exposing a switch in reservation settings, and altering the database provided no data is lost. Online reservations start disabled. Public booking links are hidden; `/reservation` shows a short, large bilingual call-to-reserve message and clickable `(450) 699-8088`, not a redirect. Existing guest management/cancellation and all historical data are preserved. The switch is restricted to existing authenticated administrators and changes are recorded transactionally with actor and timestamp. No unrelated delivery-launch changes are included.
