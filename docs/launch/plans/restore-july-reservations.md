# Restore original reservation wording with a twelve-guest limit

## Milestone
CODE_COMPLETE; 2026-09-20; `codex/restore-july-reservations`, isolated from exact live main `018c4b1` / READY Vercel `dpl_PPumgdsTUYdwdpgsLXJ6w9QGmuck`.

## Goal and confirmed scope
User requests July reservation wording, then explicitly clarifies: replace 15 with 12 and deploy when done. Historical reference is July 15 `45edfa2`. Restore the two original call-guidance strings verbatim with guest threshold 12: French "Pour les groupes de plus de 12 personnes, veuillez nous appeler directement." and English "For parties over 12 guests, please call us directly." Existing range hints already equal July's strings with 15 replaced by 12. Keep the deployed 6–12/default-six policy and all existing behavior. Do not alter the separate 15% service-fee notice.

## Scope / compatibility / security
Only two existing locale strings, corresponding browser assertions and documentation. No UI controls, styles, rules, schema, migrations, database settings, assets, drinks, ordering or dependencies change. The booking switch is currently enabled and remains unchanged. No real bookings or SMS are needed.

## Verification and sequence
Compare both locales' entire reservation form copy against July, changing only the guest-limit references from 15 to 12. Run existing policy/route tests, typecheck, focused lint, safe build and live bilingual mobile/desktop checks after deploying the exact scoped commit. Existing browser expectations follow the restored copy.

## Acceptance / remaining gates
Verification PASS: deep comparison of both complete `reservation.form` locale objects against July `45edfa2`, substituting 15 → 12 only in the guest hint/note; all remaining text, including the 15% fee, matches exactly. All 39 existing reservation policy/route tests pass. Focused ESLint and safe production build/type validation pass (23 static pages). No behavior/DB test change is required for two string substitutions; corresponding existing browser assertions are updated. Final diff confirms all application, UI control, provider, schema, dependency and configuration files unchanged except the two strings in `lib/i18n.ts`. Deployment is explicitly authorized and pending; live bilingual desktop/mobile checks will follow.

## Rollback
Return to preceding deployment/commit `018c4b1`; no data rollback or settings changes needed.
