import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';

// Build checks must never use a real database, even if credentials are present.
process.env.DATABASE_URL = 'postgresql://localhost/falconeye_build_check';
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.VERCEL = '1';

test('built Vercel entrypoints run natively without compiling TypeScript', async () => {
  const handlers = await Promise.all(
    ['healthz', 'interest', 'outreach', 'visit'].map(async (name) => {
      const { default: handler } = await import(`../api/${name}.mjs`);
      assert.equal(typeof handler, 'function', `${name} must export a request handler`);
      return handler;
    }),
  );
  assert.ok(handlers.every((handler) => handler === handlers[0]));
  const server = createServer(handlers[0]);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(`${origin}/api/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });

    const invalidSignup = await fetch(`${origin}/api/interest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'invalid', channel: 'build-check' }),
    });
    assert.equal(invalidSignup.status, 400);

    const invalidVisit = await fetch(`${origin}/api/visit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: '' }),
    });
    assert.equal(invalidVisit.status, 400);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
