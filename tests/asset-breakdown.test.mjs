import assert from 'node:assert/strict';
import test from 'node:test';
import { assetBreakdown } from '../artifacts/falcon-eye/src/lib/asset-breakdown.ts';
import { CATEGORIES, emptyDocument, validateDocument } from '../artifacts/falcon-eye/src/lib/finance-model.ts';

const record = (id, overrides = {}) => ({
  id, category: 'cash', name: id, currency: 'USD', cost: null, value: 100,
  valuationDate: '2026-11-19', valuationSource: 'manual', access: 'available',
  location: '', notes: '', details: {}, ...overrides,
});
const document = (records, extra = {}) => validateDocument({ ...emptyDocument(), records, ...extra });

test('asset infographic distinguishes unknown, missing conversion, known zero and partial categories without mutation', () => {
  const doc = document([
    record('cash'),
    record('unknown', { value: null }),
    record('gold', { category: 'gold', value: null, details: { weightGrams: 20, purity: 22 / 24 } }),
    record('foreign', { category: 'stocks', currency: 'EUR' }),
    record('zero', { category: 'bonds', value: 0 }),
  ]);
  const raw = JSON.stringify(doc);
  const result = assetBreakdown(doc);
  const group = (category) => result.groups.find((item) => item.category === category);
  assert.equal(result.total, 100);
  assert.equal(result.count, 5);
  assert.equal(result.excludedCount, 3);
  assert.equal(group('cash').share, 1);
  assert.equal(group('cash').excludedCount, 1);
  assert.equal(group('gold').valuedCount, 0);
  assert.equal(group('gold').share, null);
  assert.equal(group('stocks').valuedCount, 0);
  assert.equal(group('bonds').valuedCount, 1);
  assert.equal(group('bonds').share, 0);
  assert.equal(JSON.stringify(doc), raw);
});

test('asset infographic excludes debts/gifts and uses existing conversion and IPO refund rules', () => {
  const result = assetBreakdown(document([
    record('cash'),
    record('debt', { category: 'debt', value: 900 }),
    record('gift', { category: 'private', details: { agreementType: 'gift' } }),
    record('equity', { category: 'private', value: 20, details: { agreementType: 'equity' } }),
    record('foreign', { category: 'gold', currency: 'AED', value: 400, details: { weightGrams: 20, purity: 22 / 24 } }),
    record('ipo', { category: 'ipo', value: 100, details: { status: 'applied', refundedAmount: 25 } }),
  ], { rates: { AED: { rate: 0.25, date: '2026-11-19' } } }));
  assert.equal(result.total, 295);
  assert.equal(result.count, 4);
  assert.equal(result.groups.find((item) => item.category === 'private').count, 1);
  assert.equal(result.groups.find((item) => item.category === 'ipo').value, 75);
  assert.equal(result.groups.some((item) => item.category === 'debt'), false);
});

test('all asset types remain visible, and a zero total never creates a fictional share', () => {
  const categories = CATEGORIES.filter(({ id }) => id !== 'debt');
  const result = assetBreakdown(document(categories.map(({ id }) => record(id, {
    category: id, value: 0, details: id === 'private' ? { agreementType: 'equity' }
      : id === 'gold' ? { weightGrams: 20, purity: 22 / 24 } : id === 'ipo' ? { status: 'allocated' } : {},
  }))));
  assert.equal(result.groups.length, 10);
  assert.equal(result.total, 0);
  assert.ok(result.groups.every((item) => item.valuedCount === 1 && item.share === null));
  assert.deepEqual(assetBreakdown(emptyDocument()).groups, []);
});
