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
