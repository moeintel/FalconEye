# Vercel + Supabase deployment

The full portfolio app stays intact. Supabase stores only consented registration
emails and anonymous channel events; holdings remain browser-local.

## Supabase

1. Use a Supabase project dedicated to FalconEye.
2. In **Connect**, copy the **transaction pooler** connection string for runtime
   (port 6543). Use the actual supplied hostname and username.
3. Configure TLS: prefer `sslmode=verify-full` and the database's trusted root
   certificate if required by your project. Never disable certificate verification
   to work around a connection error.
4. Save the connection string securely as `SUPABASE_DATABASE_URL` for schema setup.
   Do not paste it into chat, commit it, or prefix it with `VITE_`.
5. Run `pnpm --filter @workspace/db schema:apply` through the secure secret executor,
   or execute `lib/db/sql/001_falconeye.sql` in Supabase SQL Editor as the owner.

The SQL creates only `falcon_interest` and `falcon_visits` if absent, enables RLS,
and denies `anon` / `authenticated` Data API access. The API connects as the database
owner. Do not reuse unrelated existing tables with those names without review.
No schema change is performed automatically during a Vercel build.

The driver uses node-postgres with unnamed queries, not named prepared statements,
and caps each Vercel function pool at one connection.

## Vercel

Import `moeintel/FalconEye` at repository root (`.`), not the frontend subdirectory.
Keep Framework Preset **Other** and use the committed `vercel.json`:

- Install: `pnpm install --frozen-lockfile`
- Build: `pnpm build`
- Static output: `artifacts/falcon-eye/dist/public`
- Node.js version: 24.x
- Runtime secret: `DATABASE_URL`, set to the Supabase transaction pooler connection
  string through secure Vercel environment configuration.
- `BASE_PATH=/` if overriding it; the default is `/`.

Node functions in `api/` export the existing Express app without starting a
listener. Same-origin routes `/api/interest`, `/api/visit`, `/api/outreach`, and
`/api/healthz` preserve the existing contract. API routes are excluded from the SPA
fallback, so broken API calls cannot silently return frontend HTML.

Use an isolated Supabase branch/project for Vercel Preview environments. Do not
allow untrusted PR deployments to receive production database credentials.
Deploy production from `main` after checking the preview build and routing.
Review Vercel Deployment Protection so presentation viewers can open the public URL.

## Acceptance test on the actual deployment

- Open `/welcome?channel=deployment-test`.
- Invalid email and missing consent must be rejected.
- A synthetic test email with consent must show **You're on the list.**
- Confirm exactly one row in Supabase; repeat submission must not duplicate it.
- `/api/outreach` must contain aggregate counts only, never email addresses.
- Refresh `/holdings`, `/import`, and `/welcome` to verify SPA routing.
- Open the sample portfolio and check that simulated-insight disclosures remain.
- Remove only the synthetic deployment-test rows after testing, so they are not
  counted as real outreach. Never clear real signup data.

## Demo versus production

The existing rate limiter is per-process/in-memory, so it is not a distributed
anti-abuse mechanism across Vercel instances. For a public campaign beyond the
class demo, add Vercel Firewall rules or a durable rate limiter/CAPTCHA and review
proxy trust, CORS, email-consent enforcement on the API, and retention/deletion.
No mail is sent by registration. A database save is not email delivery or an account.
