# Security, Privacy, Backup, and Recovery Controls

## Repository-enforced controls

- Production rejects fake providers, failure injection, ordering bypass, sandbox Clover, test currency, API-base overrides, missing/weak secrets, shared cron/driver secrets, non-HTTPS app URL, incomplete Clover credential families, and non-iframe mapped checkout.
- Raw card data never enters application contracts; browser code supplies only Clover tokens. Logs and operational alerts use internal IDs/order numbers and omit addresses, phones, tokens, and provider secrets.
- Staff capabilities are server-enforced; manager-only refund/catalog/settings/staff actions and assigned-driver scoping are independent of UI visibility.
- Public order/receipt access requires the high-entropy tracking credential; operational order numbers are display/search identifiers only.
- Checkout and reservation public endpoints use hashed database rate-limit keys. Production ordering and delivery default disabled; pickup/scheduled ordering are disabled for this launch.
- Immutable audit events and durable external intents are retained. Automated destructive data retention is intentionally not enabled before business/legal approval.

## Decisions requiring accountable-owner approval

- Retention periods for customer identity/contact/address, order/receipt/tax records, provider observations, logs, rate-limit records, and operational alerts.
- Québec privacy, tax/receipt, employee/driver, proof-of-delivery, and incident-notification duties.
- Hosting/database backup frequency, encryption, geographic location, access, RPO/RTO, and deletion/restore process.

## Backup/restore evidence procedure

1. Keep online ordering disabled and record build/schema migration state.
2. Create a provider-native encrypted backup under a named technical owner; record backup ID/time without credentials or customer data.
3. Restore into an isolated non-production environment with access restricted to the test team.
4. Run migration status, table/row-count checks, immutable audit/intent consistency queries, and a sanitized reconciliation report.
5. Record elapsed restore time, recovered point, exceptions, cleanup proof, and owner approval.
6. Never test restore by overwriting the production database.

Until this procedure has provider evidence and approved retention/RPO/RTO, EG-019 and AC-902 remain `MANUAL_VERIFICATION_REQUIRED`.

## Dependency security controls — 2026-10-14

`npm run security:audit` and `npm run security:audit:full` reject every severity, malformed/incomplete registry reports and nonzero exits. Both run first in aggregate verification/CI; there is no vulnerability allowlist. Use Node22.23.2 and npm11.8.0, install from the committed lockfile and regenerate client/worker artifacts through the normal build lifecycle. Do not use audit fix --force or bypass peers.

Qualified overrides/source adaptations, provenance, removal conditions, native Linux checks, visual compatibility and individual advisory dispositions are recorded in [dependency-security plan](plans/dependency-security.md) and [evidence](evidence/dependency-security-2026-10-14.json). Keep Prisma/client/config aligned; review the scoped merge override for any config changes. Retain all Next lint rules when updating/removing the licensed adaptation. Do not replace secure native images with unchecked system libraries. Build/dev/browser scripts regenerate the same-origin MapLibre worker; its generated asset is ignored in Git.

Security source integration does not deploy, run configured-database migrations, enable ordering or close unrelated operational gates. A future authorized Vercel release must review the complete pending migration set because its configured build command applies migrations. The owner confirms printing works; security does not impose another hardware rehearsal.
