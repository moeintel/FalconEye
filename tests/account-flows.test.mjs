import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccountFixture } from './support/account-fixture.mjs';

const PASSWORD_A = 'fixture-private-password-a';
const PASSWORD_B = 'fixture-private-password-b';
const EMAIL_A = 'account-a@example.invalid';
const EMAIL_B = 'account-b@example.invalid';

function cookieFrom(response, name, previous = '') {
  const cookies = new Map(previous.split(';').map((part) => part.trim()).filter(Boolean)
    .map((part) => [part.slice(0, part.indexOf('=')), part]));
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';', 1)[0];
    cookies.set(pair.slice(0, pair.indexOf('=')), pair);
  }
  return [...cookies.values()].filter((part) => {
    const key = part.slice(0, part.indexOf('='));
    return ['fe_access', 'fe_refresh', name].includes(key);
  }).join('; ');
}

function setCookieFor(response, name) {
  return response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
}

async function postAccount(fixture, payload, cookie = '') {
  return fetch(`${fixture.baseUrl}/api/account`, {
    method: 'POST',
    headers: {
      origin: fixture.baseUrl,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(payload),
  });
}

async function beginSignup(fixture, email, password) {
  const signup = await postAccount(fixture, { action: 'signup', email, password });
  assert.equal(signup.status, 200);
  const pkceCookie = cookieFrom(signup, 'fe_pkce');
  assert.match(pkceCookie, /fe_pkce=/);
  assert.match(setCookieFor(signup, 'fe_pkce'), /;\s*HttpOnly(?:;|$)/i);
  assert.match(setCookieFor(signup, 'fe_pkce'), /;\s*SameSite=Lax(?:;|$)/i);
  const latest = await fetch(`${fixture.baseUrl}/fixture/latest-link`);
  const { link } = await latest.json();
  assert.equal(typeof link, 'string');
  const confirmation = new URL(link);
  const state = confirmation.searchParams.get('state');
  const code = confirmation.searchParams.get('code');
  assert.ok(state && code);
  assert.equal(confirmation.hash, '');
  for (const secretParam of ['access_token', 'refresh_token', 'token', 'password']) {
    assert.equal(confirmation.searchParams.has(secretParam), false);
  }
  return { signup, pkceCookie, state, code };
}

async function completeSignup(fixture, email, password) {
  const flow = await beginSignup(fixture, email, password);
  const callback = await fetch(
    `${fixture.baseUrl}/api/account?callback=1&state=${encodeURIComponent(flow.state)}&code=${encodeURIComponent(flow.code)}`,
    { headers: { cookie: flow.pkceCookie }, redirect: 'manual' },
  );
  assert.equal(callback.status, 303);
  assert.match(setCookieFor(callback, 'fe_access'), /;\s*HttpOnly(?:;|$)/i);
  assert.match(setCookieFor(callback, 'fe_refresh'), /;\s*HttpOnly(?:;|$)/i);
  return { ...flow, callback };
}

test('isolated account PKCE, deletion, and owner-scoped cloud flows', async () => {
  const fixture = await createAccountFixture({ emailFlowsReady: false, adminConfigured: false });
  try {
    const status = await (await fetch(`${fixture.baseUrl}/api/account`)).json();
    assert.equal(status.emailFlowsConfigured, false);
    assert.equal(status.deletionConfigured, false);

    // A gated email action must fail closed without contacting the provider.
    const requestCountBeforeGate = fixture.provider.links.length;
    const gated = await postAccount(fixture, { action: 'signup', email: EMAIL_A, password: PASSWORD_A });
    assert.equal(gated.status, 503);
    assert.equal(fixture.provider.links.length, requestCountBeforeGate);

    process.env.AUTH_EMAIL_REDIRECTS_READY = 'true';
    assert.equal((await completeSignup(fixture, EMAIL_A, PASSWORD_A)).callback.headers.get('location'),
      '/settings?account=confirmed#_');
    // Wrong state, missing HttpOnly flow cookie, and replayed one-time code fail.
    const wrongStateFlow = await beginSignup(fixture, 'wrong-state@example.invalid', PASSWORD_A);
    const wrongState = await fetch(
      `${fixture.baseUrl}/api/account?callback=1&state=${'x'.repeat(wrongStateFlow.state.length)}&code=${encodeURIComponent(wrongStateFlow.code)}`,
      { headers: { cookie: wrongStateFlow.pkceCookie }, redirect: 'manual' },
    );
    assert.equal(wrongState.status, 303);
    assert.equal(wrongState.headers.get('location'), '/settings?account=callback_failed#_');

    const noCookieFlow = await beginSignup(fixture, 'no-cookie@example.invalid', PASSWORD_A);
    const noCookieCallback = `/api/account?callback=1&state=${encodeURIComponent(noCookieFlow.state)}&code=${encodeURIComponent(noCookieFlow.code)}`;
    const noCookie = await fetch(`${fixture.baseUrl}${noCookieCallback}`, { redirect: 'manual' });
    assert.equal(noCookie.status, 303);
    assert.equal(noCookie.headers.get('location'), '/settings?account=callback_failed#_');
    const replayFlow = await beginSignup(fixture, 'replay@example.invalid', PASSWORD_A);
    const replayCallback = `/api/account?callback=1&state=${encodeURIComponent(replayFlow.state)}&code=${encodeURIComponent(replayFlow.code)}`;
    const replaySuccess = await fetch(`${fixture.baseUrl}${replayCallback}`, {
      headers: { cookie: replayFlow.pkceCookie }, redirect: 'manual',
    });
    assert.equal(replaySuccess.status, 303);
    assert.equal(replaySuccess.headers.get('location'), '/settings?account=confirmed#_');
    const replay = await fetch(`${fixture.baseUrl}${replayCallback}`, {
      headers: { cookie: replayFlow.pkceCookie }, redirect: 'manual',
    });
    assert.equal(replay.status, 303);
    assert.equal(replay.headers.get('location'), '/settings?account=callback_failed#_');

    const accountA = await completeSignup(fixture, EMAIL_A, PASSWORD_A);
    // Use the recovered active session for subsequent requests.
    const cookieA = cookieFrom(accountA.callback, 'fe_pkce', cookieFrom(accountA.signup, 'fe_pkce'));
    const recover = await postAccount(fixture, { action: 'recover', email: EMAIL_A });
    assert.equal(recover.status, 200);
    const recoverCookie = cookieFrom(recover, 'fe_pkce');
    const recoverLink = new URL(fixture.provider.links.at(-1).link);
    const recovered = await fetch(
      `${fixture.baseUrl}/api/account?callback=1&state=${encodeURIComponent(recoverLink.searchParams.get('state'))}&code=${encodeURIComponent(recoverLink.searchParams.get('code'))}`,
      { headers: { cookie: recoverCookie }, redirect: 'manual' },
    );
    assert.equal(recovered.status, 303);
    assert.match(setCookieFor(recovered, 'fe_access'), /;\s*HttpOnly(?:;|$)/i);
    assert.match(setCookieFor(recovered, 'fe_refresh'), /;\s*HttpOnly(?:;|$)/i);
    assert.equal(recovered.headers.get('location'), '/settings?account=recovered#_');
    const sessionA = cookieFrom(recovered, 'fe_pkce', cookieA);

    const newPassword = 'fixture-updated-password-a';
    const passwordChange = await postAccount(fixture, { action: 'password', password: newPassword }, sessionA);
    assert.equal(passwordChange.status, 200);

    // Deletion remains unavailable without admin credentials, then rejects
    // missing confirmation, bad reauthentication, and mismatched provider ID.
    const missingAdmin = await postAccount(fixture, {
      action: 'delete', password: newPassword, confirmation: 'DELETE MY ACCOUNT',
    }, sessionA);
    assert.equal(missingAdmin.status, 503);

    process.env.SUPABASE_SECRET_KEY = 'fixture-admin-key';
    const missingConfirmation = await postAccount(fixture, { action: 'delete', password: newPassword }, sessionA);
    assert.equal(missingConfirmation.status, 400);
    const wrongPassword = await postAccount(fixture, {
      action: 'delete', password: 'not-the-password', confirmation: 'DELETE MY ACCOUNT',
    }, sessionA);
    assert.equal(wrongPassword.status, 401);

    const accountB = await completeSignup(fixture, EMAIL_B, PASSWORD_B);
    assert.equal(accountB.callback.headers.get('location'), '/settings?account=confirmed#_');
    const sessionB = cookieFrom(accountB.callback, 'fe_pkce', cookieFrom(accountB.signup, 'fe_pkce'));
    fixture.provider.mismatchReauth = true;
    const mismatch = await postAccount(fixture, {
      action: 'delete', password: newPassword, confirmation: 'DELETE MY ACCOUNT',
    }, sessionA);
    assert.equal(mismatch.status, 401);
    fixture.provider.mismatchReauth = false;

    const documentA = {
      schemaVersion: 1, records: [], activities: [], baseCurrency: 'USD',
      rates: {}, isSample: false, legacyImported: false,
    };
    const documentB = { ...documentA, baseCurrency: 'EUR' };
    const save = async (cookie, document, revision = 0, extra = {}) => fetch(`${fixture.baseUrl}/api/finance`, {
      method: 'PUT',
      headers: { origin: fixture.baseUrl, cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ document, revision, ...extra }),
    });
    const savedA = await save(sessionA, documentA);
    assert.equal(savedA.status, 200, JSON.stringify({
      response: await savedA.clone().json(),
      queries: fixture.database.calls.map(({ sql }) => sql),
    }));
    assert.equal((await savedA.json()).revision, 1);
    const savedB = await save(sessionB, documentB);
    assert.equal(savedB.status, 200, JSON.stringify(await savedB.clone().json()));
    assert.equal((await savedB.json()).revision, 1);

    // The expected-account header is only a stale-UI guard, never an owner
    // selector. A mismatch is rejected after auth verification and before SQL.
    const userAId = fixture.provider.users.get(EMAIL_A).id;
    const userBId = fixture.provider.users.get(EMAIL_B).id;
    const beforeMismatchQueries = fixture.database.calls.length;
    const staleUi = await fetch(`${fixture.baseUrl}/api/finance`, {
      headers: { cookie: sessionB, 'x-falcon-account': userAId },
    });
    assert.equal(staleUi.status, 409);
    assert.deepEqual(await staleUi.json(), {
      error: 'The signed-in account changed.', accountChanged: true,
    });
    assert.equal(fixture.database.calls.length, beforeMismatchQueries);
    const ownA = await fetch(`${fixture.baseUrl}/api/finance`, {
      headers: { cookie: sessionA, 'x-falcon-account': userAId },
    });
    const ownB = await fetch(`${fixture.baseUrl}/api/finance`, {
      headers: { cookie: sessionB, 'x-falcon-account': userBId },
    });
    assert.deepEqual(await ownA.json(), { document: documentA, revision: 1 });
    assert.deepEqual(await ownB.json(), { document: documentB, revision: 1 });

    // The JSON backup payload can be exported, parsed, restored, and loaded
    // without changing document contents.
    const backupResponse = await fetch(`${fixture.baseUrl}/api/finance`, {
      headers: { cookie: sessionA, 'x-falcon-account': userAId },
    });
    const backupJson = JSON.stringify((await backupResponse.json()).document);
    const restored = await save(sessionA, JSON.parse(backupJson), 1);
    assert.equal(restored.status, 200);
    const restoredCloud = await fetch(`${fixture.baseUrl}/api/finance`, {
      headers: { cookie: sessionA, 'x-falcon-account': userAId },
    });
    assert.deepEqual(await restoredCloud.json(), { document: documentA, revision: 2 });

    const stale = await save(sessionA, { ...documentA, baseCurrency: 'GBP' }, 0);
    assert.equal(stale.status, 409);
    const invalidAccess = sessionA.replace(/fe_access=[^;]+/, 'fe_access=expired-access');
    fixture.provider.failNext('token:refresh_token', 503);
    const beforeRefreshOutageQueries = fixture.database.calls.length;
    const refreshOutage = await fetch(`${fixture.baseUrl}/api/finance`, {
      headers: { cookie: invalidAccess, 'x-falcon-account': userAId },
    });
    assert.equal(refreshOutage.status, 503);
    assert.deepEqual(refreshOutage.headers.getSetCookie(), []);
    assert.equal(fixture.database.calls.length, beforeRefreshOutageQueries);

    fixture.provider.failNext('user:GET', 429);
    const beforeUserOutageQueries = fixture.database.calls.length;
    const userOutage = await fetch(`${fixture.baseUrl}/api/finance`, {
      headers: { cookie: sessionA, 'x-falcon-account': userAId },
    });
    assert.equal(userOutage.status, 503);
    assert.deepEqual(userOutage.headers.getSetCookie(), []);
    assert.equal(fixture.database.calls.length, beforeUserOutageQueries);

    const beforeRefreshGateQueries = fixture.database.calls.length;
    const refreshOwnerGate = await fetch(`${fixture.baseUrl}/api/finance`, {
      headers: { cookie: invalidAccess, 'x-falcon-account': userBId },
    });
    assert.equal(refreshOwnerGate.status, 409);
    assert.deepEqual(await refreshOwnerGate.json(), {
      error: 'The signed-in account changed.', accountChanged: true,
    });
    assert.equal(fixture.database.calls.length, beforeRefreshGateQueries);

    const refreshVerified = await fetch(`${fixture.baseUrl}/api/finance`, {
      headers: { cookie: invalidAccess, 'x-falcon-account': userAId },
    });
    assert.equal(refreshVerified.status, 200);
    assert.deepEqual(await refreshVerified.json(), { document: documentA, revision: 2 });

    const removeA = await fetch(`${fixture.baseUrl}/api/finance`, {
      method: 'DELETE',
      headers: { origin: fixture.baseUrl, cookie: sessionA, 'content-type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE MY FINANCIAL DATA', revision: 2 }),
    });
    assert.equal(removeA.status, 200);
    const [afterA, afterB] = await Promise.all([
      fetch(`${fixture.baseUrl}/api/finance`, { headers: { cookie: sessionA } }).then((res) => res.json()),
      fetch(`${fixture.baseUrl}/api/finance`, { headers: { cookie: sessionB } }).then((res) => res.json()),
    ]);
    assert.deepEqual(afterA, { document: null, revision: 0 });
    assert.deepEqual(afterB, { document: documentB, revision: 1 });

    const approvedDelete = await postAccount(fixture, {
      action: 'delete', password: newPassword, confirmation: 'DELETE MY ACCOUNT',
    }, sessionA);
    assert.equal(approvedDelete.status, 200);
    assert.equal((await (await fetch(`${fixture.baseUrl}/api/finance`, {
      headers: { cookie: sessionB },
    })).json()).document.baseCurrency, 'EUR');
  } finally {
    await fixture.close();
  }
});
