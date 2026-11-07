# FalconEye

Standalone product home for the [Falcon Eye investment MVP](https://replit.com/t/mbzuai/repls/Falcon-Eye-Investment-MVP).
Clean source import: the original Replit project is unchanged.

## Features and limits

- Onboarding, manual holdings entry, CSV import, portfolio allocation and gain/loss analysis.
- Simulated insights, CSV export, and printable reports.
- Interest landing page at `/welcome` and aggregate channel counts at `/outreach`.
- Holdings stay in the current browser's local storage: no accounts, cross-device sync, or server portfolio storage.
- Prices are manual/sample values, not live quotes. Insights are simulated, not live AI or investment advice.
- Registration and channel events use PostgreSQL via Express and Drizzle. No real outreach results are supplied.

## Local setup

Use Node.js 24 and pnpm 10 (`corepack enable` if your Node distribution provides Corepack,
or install pnpm 10 using its official installation instructions).

```sh
pnpm install --frozen-lockfile
pnpm dev:web
```

Open `http://localhost:5173`. Portfolio functionality works without a database.
Registration and outreach require the API setup below; frontend-only mode does not simulate successful submissions.

### Registration and outreach

Provision a **new development PostgreSQL database**. Do not point schema tools at
production or the original prototype database.

```sh
cp .env.example .env
# Set DATABASE_URL in .env using your own database connection details.
```

For schema setup, run the database package's command with the environment loaded:

```sh
set -a; . ./.env; set +a
pnpm --filter @workspace/db run push
pnpm dev
```

`drizzle-kit push` changes the selected database schema; inspect its proposed changes.
The API defaults to port 5000 and the UI to 5173. Vite proxies `/api` to the API.
`API_PORT`, `WEB_PORT`, and `BASE_PATH` can be set in `.env` for `pnpm dev`.
Do not expose the API port directly to the internet without reviewing its CORS,
proxy trust, and in-memory rate limiting.

## Verify and build

```sh
pnpm typecheck
pnpm build
```

Frontend output: `artifacts/falcon-eye/dist/public`. API output:
`artifacts/api-server/dist`. Run the API with `PORT` and `DATABASE_URL` configured:

```sh
PORT=5000 pnpm --filter @workspace/api-server start
```

Production hosting needs static SPA fallback routing and same-origin `/api` routing
to the Express service. Vite's development proxy is not part of the static build.
Vercel deployment configuration and Supabase schema setup are included.
Actual deployment requires your Vercel account and Supabase connection.
See [deployment instructions](docs/DEPLOYMENT.md); inclusion of configuration
does not mean a live deployment or Supabase verification has completed.

## Workspace

- `artifacts/falcon-eye`: React/Vite frontend.
- `artifacts/api-server`: Express API for registrations and channel events.
- `lib/db`: Drizzle database schema.
- `lib/api-spec`: OpenAPI contract and Orval codegen.
- `lib/api-client-react`, `lib/api-zod`: generated contract helpers (committed because source imports them).

Regenerate contract helpers with `pnpm --filter @workspace/api-spec run codegen`.
For changes, preserve browser-local holdings, simulated-insight disclosures, email
consent, duplicate-safe signup behavior, and aggregate-only public outreach responses.

## Import boundaries

Imported application source and required shared packages, not prototype history.
Excluded credentials, database contents, personal uploads, dependency folders,
compiled output, Replit session metadata, the mockup sandbox, and the demo-film artifact/recording.
The unused automatic post-merge database-push hook was excluded intentionally.
The original workspace catalog and lockfile are retained, then reconciled for the
selected packages. Existing platform-specific native-package overrides target Linux x64;
other platforms may need those overrides revised and their lockfile regenerated.
No license grant is added by this import.
