import assert from 'node:assert/strict';
import test from 'node:test';

const KEY = 'falcon-eye:v1';
const SEED_KEY = 'falcon-eye:sample-seed:v1';
let sequence = 0;

async function boot(entries = []) {
  const data = new Map(entries);
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const portfolio = await import(`../artifacts/falcon-eye/src/lib/portfolio.ts?seedTest=${++sequence}`);
  return { data, portfolio };
}

test('fresh browsers receive 11 labelled sample holdings in the regular portfolio', async () => {
  const { data } = await boot();
  const saved = JSON.parse(data.get(KEY));
  assert.equal(saved.holdings.length, 11);
  assert.equal(saved.isDemo, true);
  assert.ok(saved.holdings.some((holding) => holding.symbol === 'BTC'));
  assert.equal(data.get(SEED_KEY), '1');
});

test('an old empty portfolio is populated once', async () => {
  const { data } = await boot([[KEY, JSON.stringify({ holdings: [], isDemo: false, onboarded: true })]]);
  assert.equal(JSON.parse(data.get(KEY)).holdings.length, 11);
});

test('existing non-empty portfolios are not overwritten or supplemented', async () => {
  const existing = JSON.stringify({ holdings: [{ id: 'owned', symbol: 'CUSTOM' }], isDemo: false, onboarded: true });
  const { data } = await boot([[KEY, existing]]);
  assert.equal(data.get(KEY), existing);
  assert.equal(data.get(SEED_KEY), '1');
});

test('a deliberate reset stays empty after reloading; sample positions are not duplicated', async () => {
  const { data, portfolio } = await boot();
  portfolio.store.startEmpty();
  assert.equal(JSON.parse(data.get(KEY)).holdings.length, 0);
  const reloaded = await boot([...data]);
  assert.equal(JSON.parse(reloaded.data.get(KEY)).holdings.length, 0);
  reloaded.portfolio.store.loadDemo();
  const again = await boot([...reloaded.data]);
  assert.equal(JSON.parse(again.data.get(KEY)).holdings.length, 11);
});

test('unavailable browser storage does not crash sample initialization', async () => {
  globalThis.localStorage = {
    getItem() { throw new Error('storage unavailable'); },
    setItem() { throw new Error('storage unavailable'); },
  };
  const portfolio = await import(`../artifacts/falcon-eye/src/lib/portfolio.ts?seedTest=${++sequence}`);
  assert.doesNotThrow(() => portfolio.store.loadDemo());
});
