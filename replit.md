# Falcon Eye

An everyday-finance prototype that helps people understand what they own and owe across formal and informal assets. It began as a class-demo investment dashboard.

## Run & Operate

- `pnpm dev` — run API (5000) and frontend (5173); reads root `.env`
- `pnpm dev:web` — frontend only; portfolio features need no database
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Financial records work locally in the browser. Optional private cloud persistence requires Supabase Auth configuration plus the separately approved `migrations/003_finance.sql` migration. Interest registration and channel counts use the existing PostgreSQL database (`DATABASE_URL`). No prototype database or data was copied.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: Vite frontend and esbuild (ESM API bundle)

## Where things live

- `artifacts/falcon-eye/` — investment MVP frontend
- `artifacts/api-server/` and `lib/` — interest registration, anonymous aggregate channel counts, and database schema

## Architecture decisions

- Local records use `falcon-eye:finance:v2`. Preserve the old `falcon-eye:v1` raw string; migrate separately without inventing an original valuation date. Unknown legacy dates use the 1970-01-01 sentinel with explanatory notes and render as unknown.
- Samples stay clearly labelled through edits and cannot be uploaded as personal data. Starting personal records is explicit. Never mix personal additions silently into a sample.
- Cloud upload/download is explicit, owner-scoped, and revision-checked. Verify Supabase sessions server-side; no session tokens in localStorage. Do not apply database migrations or claim cloud success without approval and runtime verification.
- A one-time `falcon-eye:sample-seed:v1` browser migration populates old empty portfolios with the 11 sample holdings. Never overwrite non-empty portfolios or re-seed deliberate resets after this migration. No separate demo route.
- Prices are user-entered or sample values, not live quotes.
- Legacy AI insights remain simulated. Falc defaults to a bounded local guided assistant; optional authenticated OpenAI mode requires a server key and user opt-in. It prepares drafts only. Every save requires a review and explicit confirmation, via button or exact chat confirmation. No trades, arbitrary tools, or autonomous database writes.
- Existing server data consists of consented early-access emails and anonymous channel opens. The new finance table is separate and its migration is unapplied until explicitly approved. Public outreach endpoints must never expose contact details.
- Outreach visits and sign-ups are different counting units with no saved linkage: do not display their ratio as visitor conversion or fabricate missing historical visits. Manual reached, pass-line timing, and lesson are browser-local notes; they are not stored in Supabase.

## Product

Everyday overview, guided asset/debt entry, search/filter, dated manual currency conversion, activity, CSV/JSON/print reports, backups, optional private accounts, and Falc conversational entry. Categories include gold, IPOs, private investments, money lent, property, and debt alongside the original assets. Gifts are excluded from wealth; IPO refunds and ownership shares are applied once. Received income is history-only, not assumed reinvested.

The original investment screens remain under `/legacy/*`. Interest registration and team outreach reporting remain at `/welcome` and `/admin/outreach`; `/outreach` redirects there. Visits/sign-ups come from recorded Supabase data; reached is manual browser-local input, never fabricated. The prototype admin label is not authentication; only aggregates are exposed. This admin route, account recovery/deletion, distributed abuse protection, and operational restore verification remain public-beta release gates.

## User preferences

The original class brief requested a simple four-minute “Skateboard” demo. The user subsequently requested the broader everyday-finance improvement plan, a much easier UI with a visual infographic, and a falcon mascot assistant that can prepare asset entries through chat. Keep the existing presentation and registration stable until an approved release. Never fabricate actual outreach results.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See `README.md` for standalone setup, verification, and import boundaries.
- See `docs/EVERYDAY_FINANCE_PLAN.md` for product/UI scope and acceptance criteria.
- See `docs/FINANCE_OPERATIONS.md` for account configuration, unapplied migration, and release blockers.
