# Finance persistence and account operations

## Deployment status and prerequisites

This repository contains the implementation and an unapplied SQL migration. No
production or development database was modified by this change, and the presence
of credentials in an environment is not evidence that the migration or service
has been deployed.

The existing `/api/outreach` public aggregate is intentionally unchanged in this
scope. It still serves the prototype reporting contract and is not an
authenticated admin service; this implementation does not make the broader
application production-ready. Admin access hardening needs a separately
approved route change.

Configure the API runtime with:

- `DATABASE_URL`: the existing PostgreSQL/Supabase server connection used by the
  API. Keep this separate from Supabase Auth credentials.
- `SUPABASE_URL`: the Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY`: the project's public/publishable key, held only in
  server configuration and never exposed through a `VITE_` variable.
- `APP_ORIGIN`: the exact public application origin, including scheme and host,
  for cross-origin same-site deployments and Auth redirect configuration.
- Optionally, `OPENAI_API_KEY` and `OPENAI_MODEL` (default `gpt-4o-mini`) to
  enable assistant-generated data-entry drafts. The key stays server-side.

Apply `migrations/003_finance.sql` to the intended Supabase project using a
privileged, separately approved migration process. Check that Supabase Auth and
its `auth.users`, `authenticated`, and `anon` objects exist first. The migration
creates only `public.falcon_finance_documents`; it does not alter the existing
interest or visit tables. Verify the table, grants, forced RLS, and owner policy
in the target project after applying it.

## Authentication and account safety

`GET /api/account` reports `{configured, user, assistantConfigured}`. When Auth
configuration is absent, finance operations are unavailable rather than
returning a successful empty portfolio. Sign-in/sign-up and session validation
use Supabase Auth REST endpoints. Sessions are stored only in HttpOnly cookies
scoped to `/api`, with `SameSite=Lax` and `Secure` in production. The server
verifies sessions with `/auth/v1/user`; it does not trust locally decoded JWT
claims. Expired access cookies are refreshed and verified before use.

Mutating account, finance, and assistant requests require a same-origin
`Origin` header matching the request host or configured `APP_ORIGIN`. Do not
disable this check or rely on forwarded host headers. Account request limiting
is in-memory per process and is not a distributed abuse control.

Secure recovery is **unavailable**: Supabase recovery links can carry credentials
in browser URLs, and this app has no configured Supabase recovery email template,
first-party callback page, or PKCE verifier lifecycle that can safely redeem a
recovery code. A production flow needs reviewed provider mail-template/redirect
configuration, a server-issued HttpOnly PKCE verifier bound to the recovery
attempt, and a first-party callback that exchanges the code and clears browser
history before rendering user content. That frontend callback/configuration is
not present in this implementation's scope. The API therefore returns an
explicit 503 and does not request a provider recovery email. The account UI
surfaces this explicit unavailable status rather than claiming an email was
sent. Account deletion is also **unavailable**:
the configured publishable key cannot delete a Supabase Auth user. The API does
not simulate deletion or delete finance data as a substitute. A future deletion
implementation needs an approved server-only provider credential and a reviewed
account/data deletion flow. Password changes require a verified session.

## Finance API behavior

- `GET /api/finance` returns `{document, revision}` only for the verified owner.
  No document is represented as `document: null, revision: 0`.
- `PUT /api/finance` accepts only an allowlisted version-1 finance document and
  the revision the user last read. A successful update increments the revision;
  stale writes return 409 with the current revision.
- `DELETE /api/finance` requires the exact confirmation
  `DELETE MY FINANCIAL DATA` and the current revision. It removes only the
  authenticated user's finance document.

Sample documents are rejected. `isSample` must be false, so only a user's own
manual or explicitly imported data can be saved. Ownership is always derived
from the verified Supabase user and is never accepted from a request body. The
API uses parameterized SQL and reports a missing migration as a setup error.

Assistant requests are bounded, sent to the official OpenAI API only when the
server key is configured, and only after a valid signed-in user is verified to
prevent anonymous paid-provider use. They produce a constrained response/draft
only and do not access or write portfolio data, invoke tools, or perform actions.
The assistant is not investment advice. Without its key, it returns a 503 so the
frontend can use its local guided fallback without authentication.

Finance documents have an explicit 512 KiB serialized-document limit. The
shared Express JSON parser accepts at most 1 MiB, allowing room for the request
envelope without removing a bounded HTTP limit. The database also limits the
stored document size and rejects sample documents.

## Backup, restore, and rollback

Back up the finance table before maintenance and before any rollback. Use a
secure operator environment where `DATABASE_URL` is supplied through secret
management, not command history or checked-in files:

```sh
pg_dump "$DATABASE_URL" --format=custom --table=public.falcon_finance_documents \
  --file=falcon-finance-documents.dump
```

Restrict access to the backup: it contains personal financial information.
Restore only into an approved target after taking a fresh backup of that target;
review the destination and use the standard PostgreSQL restore review process
before executing:

```sh
pg_restore --dbname="$DATABASE_URL" --table=falcon_finance_documents \
  falcon-finance-documents.dump
```

Rollback is data-destructive. After preserving a verified backup and confirming
the target project, an operator may remove the feature table and its policy:

```sql
DROP TABLE public.falcon_finance_documents;
```

Do not run rollback or restore against production without explicit approval.
After rollback, disable finance endpoints or they will correctly report storage
setup failure. Validate a restore in a non-production project first.

## Verification boundaries

`tests/finance-security.test.mjs` targets the built API and uses no real database
or provider credentials. It covers configuration status, anonymous denial,
CSRF rejection, malformed input, unconfigured assistant behavior, and a
write-shaped anonymous request that must not reach storage. A successful local
test does not establish that provider credentials, the migration, or a live
database are configured.
