import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';

process.env.DATABASE_URL = 'postgresql://localhost/falconeye_security_build_check';
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.VERCEL = '1';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_PUBLISHABLE_KEY;
delete process.env.OPENAI_API_KEY;

test('built API security endpoints fail closed without accessing a real database', async () => {
  const { default: handler } = await import('../artifacts/api-server/dist/app.mjs');
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const account = await fetch(`${origin}/api/account`);
    assert.equal(account.status, 200);
    assert.deepEqual(await account.json(), {
      configured: false,
      user: null,
      assistantConfigured: false,
    });

    // A configured provider with no session must not become an empty portfolio.
    process.env.SUPABASE_URL = 'https://falconeye-security-test.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
    const denied = await fetch(`${origin}/api/finance`);
    assert.equal(denied.status, 401);

    const csrf = await fetch(`${origin}/api/finance`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ document: {}, revision: 0 }),
    });
    assert.equal(csrf.status, 403);

    const malformed = await fetch(`${origin}/api/finance`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ document: { isSample: true }, revision: -1 }),
    });
    assert.equal(malformed.status, 400);

    const neverWritten = await fetch(`${origin}/api/finance`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        document: {
          schemaVersion: 1,
          records: [],
          activities: [],
          baseCurrency: 'USD',
          rates: {},
          isSample: false,
          legacyImported: false,
        },
        revision: 0,
      }),
    });
    assert.equal(neverWritten.status, 401);

    const assistant = await fetch(`${origin}/api/assistant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Help me enter a holding.' }], currency: 'USD' }),
    });
    assert.equal(assistant.status, 503);
    assert.deepEqual(await assistant.json(), {
      error: 'AI assistant is not configured.',
      configured: false,
    });

    // Even with a configured paid provider, an anonymous request must not
    // reach OpenAI. There is deliberately no auth cookie in this request.
    process.env.OPENAI_API_KEY = 'test-only-not-a-real-key';
    const realFetch = globalThis.fetch;
    let openAiCalled = false;
    globalThis.fetch = async (url, options) => {
      if (String(url).startsWith('https://api.openai.com/')) openAiCalled = true;
      return realFetch(url, options);
    };
    try {
      const anonymousAssistant = await fetch(`${origin}/api/assistant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Help me enter a holding.' }], currency: 'USD' }),
      });
      assert.equal(anonymousAssistant.status, 401);
      assert.equal(openAiCalled, false);
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.OPENAI_API_KEY;
    }
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('optimistic finance persistence SQL handles insert, update, conflict, and delete safely', async () => {
  process.env.DATABASE_URL = 'postgresql://localhost/falconeye_finance_query_check';
  const { saveFinanceDocument, deleteFinanceDocument } = await import(
    '../artifacts/api-server/src/lib/finance-persistence.ts'
  );
  const fakeClient = (...responses) => {
    const calls = [];
    return {
      calls,
      query: async (text, values) => {
        calls.push({ text, values });
        assert.ok(responses.length, 'unexpected fake SQL query');
        return responses.shift();
      },
    };
  };

  const createdClient = fakeClient({ rows: [{ document: { schemaVersion: 1 }, revision: '1' }] });
  assert.deepEqual(await saveFinanceDocument(createdClient, 'owner-a', { schemaVersion: 1 }, 0), {
    kind: 'saved', document: { schemaVersion: 1 }, revision: 1,
  });
  assert.match(createdClient.calls[0].text, /INSERT INTO falcon_finance_documents/);
  assert.match(createdClient.calls[0].text, /ON CONFLICT \(user_id\) DO NOTHING/);
  assert.doesNotMatch(createdClient.calls[0].text, /DO UPDATE/);
  assert.deepEqual(createdClient.calls[0].values, ['owner-a', '{"schemaVersion":1}']);

  const updatedClient = fakeClient({ rows: [{ document: { version: 2 }, revision: '8' }] });
  assert.deepEqual(await saveFinanceDocument(updatedClient, 'owner-a', { version: 2 }, 7), {
    kind: 'saved', document: { version: 2 }, revision: 8,
  });
  assert.match(updatedClient.calls[0].text, /^UPDATE falcon_finance_documents/);
  assert.match(updatedClient.calls[0].text, /WHERE user_id = \$1 AND revision = \$3/);
  assert.deepEqual(updatedClient.calls[0].values, ['owner-a', '{"version":2}', 7]);

  const staleClient = fakeClient({ rows: [] }, { rows: [{ revision: '9' }] });
  assert.deepEqual(await saveFinanceDocument(staleClient, 'owner-a', {}, 7), {
    kind: 'conflict', revision: 9,
  });
  assert.match(staleClient.calls[0].text, /^UPDATE /);
  assert.equal(staleClient.calls[1].text, 'SELECT revision FROM falcon_finance_documents WHERE user_id = $1');

  const staleCreateClient = fakeClient({ rows: [] }, { rows: [{ revision: '4' }] });
  assert.deepEqual(await saveFinanceDocument(staleCreateClient, 'owner-a', {}, 0), {
    kind: 'conflict', revision: 4,
  });
  assert.match(staleCreateClient.calls[0].text, /DO NOTHING/);
  assert.doesNotMatch(staleCreateClient.calls[0].text, /DO UPDATE/);

  const absentDeleteClient = fakeClient({ rows: [] }, { rows: [] });
  assert.deepEqual(await deleteFinanceDocument(absentDeleteClient, 'owner-a', 0), { kind: 'deleted' });
  const staleDeleteClient = fakeClient({ rows: [] }, { rows: [{ revision: '2' }] });
  assert.deepEqual(await deleteFinanceDocument(staleDeleteClient, 'owner-a', 0), {
    kind: 'conflict', revision: 2,
  });
  const currentDeleteClient = fakeClient({ rows: [{ revision: '3' }] });
  assert.deepEqual(await deleteFinanceDocument(currentDeleteClient, 'owner-a', 3), { kind: 'deleted' });
});

test('finance allowlist matches supported currencies, detail types, and record-only activity references', async () => {
  const { validateFinanceDocument } = await import(
    '../artifacts/api-server/src/lib/finance-validation.ts'
  );
  const document = {
    schemaVersion: 1,
    records: [{
      id: 'record-1', category: 'gold', name: 'Gold', currency: 'USD', cost: 100,
      value: 110, valuationDate: '2025-01-01', valuationSource: 'manual',
      access: 'available', location: '', notes: '',
      details: { weightGrams: 10, purity: 0.999 },
    }],
    activities: [{
      id: 'activity-1', recordId: 'record-1', type: 'valuation',
      date: '2025-01-01', amount: 110, currency: 'USD', note: '',
    }],
    baseCurrency: 'USD', rates: {}, isSample: false, legacyImported: false,
  };
  assert.equal(validateFinanceDocument(document), true);
  assert.equal(validateFinanceDocument({
    ...document,
    baseCurrency: 'XYZ',
  }), false);
  assert.equal(validateFinanceDocument({
    ...document,
    records: [{ ...document.records[0], details: { weightGrams: '10', purity: 0.999 } }],
  }), false);
  assert.equal(validateFinanceDocument({
    ...document,
    activities: [
      ...document.activities,
      { id: 'activity-2', recordId: 'activity-1', type: 'valuation', date: '2025-01-01', amount: 1, currency: 'USD', note: '' },
    ],
  }), false);
});
