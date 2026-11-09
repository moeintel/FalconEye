# Falcon Eye

A class-demo MVP that helps self-directed investors consolidate and understand their investment holdings.

## Run & Operate

- `pnpm dev` — run API (5000) and frontend (5173); reads root `.env`
- `pnpm dev:web` — frontend only; portfolio features need no database
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Portfolio features are browser-only. Interest registration and channel counts require a separately configured PostgreSQL database (`DATABASE_URL`). No prototype database or data was copied.

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

- Use local browser persistence for this MVP rather than building unnecessary server infrastructure.
- Prices are user-entered or sample values, not live quotes.
- AI insights are explicitly simulated; do not imply a live model or investment advice.
- Only consented early-access emails and anonymous channel opens are stored server-side. Public outreach endpoints must never expose contact details.

## Product

Onboarding, manual and CSV import, consolidated portfolio analysis, simulated AI insights, CSV/print report export, interest registration, and team outreach reporting at `/admin/outreach` labelled “Admin view (prototype)”. `/outreach` redirects there. Visits/sign-ups come from recorded Supabase data; reached is manual browser-local input, never fabricated. The prototype admin label is not authentication; only aggregates are exposed. Existing records are preserved.

## User preferences

The supplied class brief says to stick strictly to the “Skateboard” MVP: functional simplicity, no complex backend integrations, suitable for a four-minute midterm presentation. The subsequently supplied instructor PDF is a grading rubric, not a visual/copy specification. It requires a working interest form saving contact details, a live end-to-end demo, and outreach counts by channel compared to a pass line with one lesson learned. Presentation split: two minutes demo, one minute landing page, one minute outreach. No actual outreach results should be fabricated.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See `README.md` for standalone setup, verification, and import boundaries.
