import { createHash } from 'node:crypto';
import express from '../../artifacts/api-server/node_modules/express/index.js';
import { createServer } from 'node:http';
import { once } from 'node:events';

const fixtureUrl = 'http://127.0.0.1:5001';
const publishableKey = 'fixture-publishable-key';
const adminKey = 'fixture-admin-key';
const MAX_FIXTURE_USERS = 50;
const MAX_FIXTURE_DOCUMENTS = 50;
const MAX_FIXTURE_EMAIL_LINKS = 20;
const MAX_FIXTURE_SESSIONS = 200;
const MAX_FIXTURE_CODES = 50;

export const fixtureCredentials = Object.freeze({
  publishableKey,
  adminKey,
  providerUrl: fixtureUrl,
});
const isFixtureEmail = (value) => typeof value === 'string' && /^[^\s@]+@example\.invalid$/i.test(value);
const isFixturePassword = (value) => typeof value === 'string' && value.startsWith('fixture-') && value.length <= 128;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function createMemoryFinanceDatabase() {
  const rows = new Map();
  const calls = [];
  return {
    rows, calls,
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (calls.length > 1000) calls.shift();
      if (/^SELECT document, revision FROM falcon_finance_documents/.test(sql)) {
        const row = rows.get(values[0]);
        return { rows: row ? [{ ...row }] : [] };
      }
      if (/^INSERT INTO falcon_finance_documents/.test(sql)) {
        if (rows.has(values[0])) return { rows: [] };
        if (rows.size >= MAX_FIXTURE_DOCUMENTS) throw new Error('Fixture document limit reached');
        const row = { document: JSON.parse(values[1]), revision: 1 };
        rows.set(values[0], row);
        return { rows: [{ ...row }] };
      }
      if (/^UPDATE falcon_finance_documents/.test(sql)) {
        const row = rows.get(values[0]);
        if (!row || row.revision !== values[2]) return { rows: [] };
        const updated = { document: JSON.parse(values[1]), revision: row.revision + 1 };
        rows.set(values[0], updated);
        return { rows: [{ ...updated }] };
      }
      if (/^DELETE FROM falcon_finance_documents/.test(sql)) {
        const row = rows.get(values[0]);
        if (!row || row.revision !== values[1]) return { rows: [] };
        rows.delete(values[0]);
        return { rows: [{ revision: row.revision }] };
      }
      if (/^SELECT revision FROM falcon_finance_documents/.test(sql)) {
        const row = rows.get(values[0]);
        return { rows: row ? [{ revision: row.revision }] : [] };
      }
      throw new Error('Unexpected finance fixture query');
    },
  };
}

function createProvider() {
  const users = new Map();
  const sessions = new Map();
  const authCodes = new Map();
  const links = [];
  const failures = new Map();
  let nextId = 1;
  let nextCode = 1;
  const userFor = (email, password) => {
    let user = users.get(email);
    if (!user) {
      if (users.size >= MAX_FIXTURE_USERS) throw new Error('Fixture user limit reached');
      user = { id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`, email, password, verified: true };
      users.set(email, user);
    }
    return user;
  };
  const issueSession = (user) => {
    const access = `fixture-access-${user.id}`;
    const refresh = `fixture-refresh-${user.id}`;
    sessions.set(access, user);
    sessions.set(refresh, user);
    while (sessions.size > MAX_FIXTURE_SESSIONS) sessions.delete(sessions.keys().next().value);
    return { access_token: access, refresh_token: refresh, token_type: 'bearer', expires_in: 3600 };
  };

  async function fetchProvider(input, init = {}) {
    const url = new URL(String(input));
    if (url.origin !== fixtureUrl || !url.pathname.startsWith('/auth/v1/')) {
      throw new Error('Fixture rejected provider request outside its local endpoint');
    }
    const path = url.pathname.slice('/auth/v1/'.length);
    const body = init.body ? JSON.parse(String(init.body)) : {};
    const headers = new Headers(init.headers);
    const failureKey = path === 'token'
      ? `token:${url.searchParams.get('grant_type')}`
      : `${path}:${init.method ?? 'GET'}`;
    if (failures.has(failureKey)) {
      const status = failures.get(failureKey);
      failures.delete(failureKey);
      return json({ message: 'Injected fixture provider outage.' }, status);
    }

    if (path === 'signup' && init.method === 'POST') {
      if (!isFixtureEmail(body.email) || !isFixturePassword(body.password)) {
        return json({ message: 'Only isolated fixture credentials are accepted.' }, 400);
      }
      if (authCodes.size >= MAX_FIXTURE_CODES) return json({ message: 'fixture code limit reached' }, 429);
      const user = userFor(body.email, body.password);
      const redirectTo = url.searchParams.get('redirect_to');
      if (typeof redirectTo === 'string' && typeof body.code_challenge === 'string') {
        const code = `fixture-code-${nextCode++}`;
        authCodes.set(code, { user, challenge: body.code_challenge, kind: 'confirmed' });
        const link = `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}code=${encodeURIComponent(code)}`;
        links.push({ email: body.email, link });
        if (links.length > MAX_FIXTURE_EMAIL_LINKS) links.shift();
      } else if (typeof redirectTo === 'string') {
        const link = `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}token=fixture-code`;
        links.push({ email: body.email, link });
      }
      return json({ user: { id: user.id, email: user.email } });
    }
    if (path === 'recover' && init.method === 'POST') {
      if (!isFixtureEmail(body.email)) return json({ message: 'Only isolated fixture credentials are accepted.' }, 400);
      if (authCodes.size >= MAX_FIXTURE_CODES) return json({ message: 'fixture code limit reached' }, 429);
      const user = users.get(body.email) ?? userFor(body.email, 'fixture-password');
      if (typeof url.searchParams.get('redirect_to') === 'string' && typeof body.code_challenge === 'string') {
        const code = `fixture-code-${nextCode++}`;
        authCodes.set(code, { user, challenge: body.code_challenge, kind: 'recovered' });
        const redirectTo = url.searchParams.get('redirect_to');
        const link = `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}code=${encodeURIComponent(code)}`;
        links.push({ email: body.email, link });
        if (links.length > MAX_FIXTURE_EMAIL_LINKS) links.shift();
      }
      return json({ message: 'If the account exists, a recovery link was sent.' });
    }
    if (path === 'token' && url.searchParams.get('grant_type') === 'pkce' && init.method === 'POST') {
      const grant = authCodes.get(body.auth_code);
      if (!grant || grant.challenge !== createHash('sha256').update(body.code_verifier ?? '').digest('base64url')) {
        return json({ msg: 'Invalid authorization code' }, 400);
      }
      authCodes.delete(body.auth_code);
      return json({ ...issueSession(grant.user), user: { id: grant.user.id, email: grant.user.email } });
    }
    if (path === 'token' && url.searchParams.get('grant_type') === 'password' && init.method === 'POST') {
      const user = users.get(body.email);
      if (!isFixtureEmail(body.email) || !isFixturePassword(body.password) ||
          !user || user.password !== body.password) return json({ error: 'invalid_grant' }, 400);
      const returnedUser = provider.mismatchReauth
        ? [...users.values()].find((candidate) => candidate.id !== user.id) ?? user
        : user;
      return json({ ...issueSession(returnedUser), user: { id: returnedUser.id, email: returnedUser.email } });
    }
    if (path === 'token' && url.searchParams.get('grant_type') === 'refresh_token' && init.method === 'POST') {
      const user = sessions.get(body.refresh_token);
      return user ? json(issueSession(user)) : json({ error: 'invalid_grant' }, 400);
    }
    if (path === 'user' && init.method === 'GET') {
      const token = headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      const user = sessions.get(token);
      return user ? json({ id: user.id, email: user.email }) : json({ message: 'invalid token' }, 401);
    }
    if (path === 'user' && init.method === 'PUT') {
      const user = sessions.get(headers.get('authorization')?.replace(/^Bearer\s+/i, ''));
      if (!user || !isFixturePassword(body.password)) return json({ message: 'invalid fixture password' }, 400);
      user.password = body.password;
      return json({ id: user.id, email: user.email });
    }
    if (path === 'logout' && init.method === 'POST') return new Response(null, { status: 204 });
    if (path.startsWith('admin/users/') && init.method === 'DELETE') {
      if (headers.get('apikey') !== adminKey) return json({ message: 'unauthorized' }, 401);
      const userId = url.pathname.split('/').at(-1);
      const user = [...users.values()].find((candidate) => candidate.id === userId);
      if (!user) return json({ message: 'not found' }, 404);
      users.delete(user.email);
      for (const [token, owner] of sessions) if (owner.id === userId) sessions.delete(token);
      return new Response(null, { status: 204 });
    }
    return json({ message: 'Unsupported fixture provider request' }, 404);
  }

  const provider = {
    fetchProvider, links, users, sessions, mismatchReauth: false,
    userFor,
    failNext(endpoint, status) {
      if (!['user:GET', 'token:refresh_token'].includes(endpoint) || ![429, 500, 503].includes(status)) {
        throw new Error('Unsupported fixture outage injection.');
      }
      failures.set(endpoint, status);
    },
  };
  return provider;
}

export async function createAccountFixture(options = {}) {
  const port = options.port ?? 0;
  const provider = createProvider();
  const database = createMemoryFinanceDatabase();
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_ORIGIN: process.env.APP_ORIGIN,
    AUTH_EMAIL_REDIRECTS_READY: process.env.AUTH_EMAIL_REDIRECTS_READY,
    NODE_ENV: process.env.NODE_ENV,
  };
  process.env.DATABASE_URL = 'postgresql://127.0.0.1/falconeye_fixture_unused';
  process.env.SUPABASE_URL = fixtureUrl;
  process.env.SUPABASE_PUBLISHABLE_KEY = publishableKey;
  process.env.APP_ORIGIN = options.appOrigin ?? 'http://127.0.0.1:5173';
  process.env.NODE_ENV = 'test';
  if (options.emailFlowsReady) process.env.AUTH_EMAIL_REDIRECTS_READY = 'true';
  else delete process.env.AUTH_EMAIL_REDIRECTS_READY;
  if (options.adminConfigured) process.env.SUPABASE_SECRET_KEY = adminKey;
  else delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const { accountRouter, createFinanceRouter } = await import('../../artifacts/api-server/dist/app.mjs');
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/api', accountRouter);
  app.use('/api', createFinanceRouter({ database }));
  app.get('/fixture/latest-link', (_req, res) => {
    const item = provider.links.at(-1);
    res.set('Cache-Control', 'no-store');
    res.json(item ? { link: item.link, email: item.email } : { link: null });
  });
  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
  const server = createServer(app);
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
    if (url.origin === fixtureUrl) return provider.fetchProvider(url, init);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1') {
      return originalFetch(input, init);
    }
    throw new Error('Fixture rejected all non-local network requests');
  };
  return {
    baseUrl, database, provider,
    async close() {
      globalThis.fetch = originalFetch;
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
