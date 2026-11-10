# Finance persistence and account operations

## Deployment status and prerequisites

This repository contains the implementation and an explicitly applied SQL
migration; builds never apply it automatically. Deployment-specific migration
approvals and verification are tracked in the PR, not inferred from the presence
of credentials. Creating a table does not establish that authenticated workflows
are ready for public use.

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
- `AUTH_EMAIL_REDIRECTS_READY=true`: opt in only after configuring and checking
  the callback allowlist and email templates below.
- Optional `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`):
  privileged **server-only** provider key for deleting a verified user's identity.
  Without it identity deletion is visibly unavailable. Never expose this key to
  Vite, browser storage, logs, or client responses.
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

Signup and recovery use server-side **PKCE**, not implicit tokens in browser
fragments. A random verifier and state are stored in an HttpOnly cookie for one
hour. Only the S256 challenge is sent when requesting an email. The callback
`GET /api/account?callback=1&state=…&code=…` requires the matching same-browser
cookie and state, exchanges the single-use code server-side, verifies the
returned session with Supabase, sets HttpOnly cookies, and immediately redirects
to Settings without the code. Callback responses are no-store/no-referrer.
Starting a second email flow replaces the first; users must open the latest link
in the browser where they requested it.

In Supabase **Authentication → URL Configuration**, configure the Site URL to the
intended production origin and allow the callback query on each approved host.
For this deployment the narrowly scoped allowlist patterns are:

- `https://falconeye2.vercel.app/api/account*`
- `https://falconeye--cnvs-08pbdnk8x59agbxrmcn4hmmbc9.sisko.replit.dev/api/account*`

The wildcard permits the callback/state query on this endpoint, not arbitrary
preview hosts. Add another host only after reviewing it. In **Email Templates**,
Confirm signup and Reset password links must use Supabase's `{{ .ConfirmationURL }}`
so verification is completed by the provider and the PKCE callback is preserved.
Do not substitute an implicit token-fragment link. Only then set
`AUTH_EMAIL_REDIRECTS_READY=true` in that server environment. Until then, signup
and recovery are disabled and make no provider email request; existing accounts
may still sign in. SMTP delivery, provider limits, confirmation, and recovery
must be verified with explicitly approved real test accounts before release.

Account deletion is implemented but gated by the server-only admin key. It
requires a verified session, the exact phrase `DELETE MY ACCOUNT`, and successful
password reauthentication as the **same verified user**, before deleting only
that provider identity. The finance row is removed by its approved cascading
foreign key. No local browser copy or early-access registration is erased.
Deletion without provider privileges returns unavailable, never simulated
success. Password updates require a verified session and at least 12 characters.
The Settings UI includes password confirmation and explains these boundaries.

The UI sends `X-Falcon-Account` as an expected-session guard for cloud operations
and sensitive account changes. A changed session returns 409 before accessing
storage or changing credentials. This header is never a source of ownership:
all queries still use the independently verified provider user.

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

`tests/account-flows.test.mjs` exercises the actual routers with a mock Auth
provider and isolated in-memory documents: PKCE callbacks, recovery/password
changes, privileged identity deletion guards, two-session ownership, stale
writes, account-switch guards, and JSON backup/restore. Browser fixture testing
also uses mock provider/email delivery and isolated records. These tests do not
prove live Supabase email delivery, production RLS isolation, or operational
backup restore. Never create production test users, send email, or write
financial fixtures without explicit approval.

Provider references:
[PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow) and
[redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).
