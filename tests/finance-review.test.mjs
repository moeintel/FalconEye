import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyDocument, summarizeFinance, validateDocument } from '../artifacts/falcon-eye/src/lib/finance-model.ts';
import { reviewFinance, valuationAge } from '../artifacts/falcon-eye/src/lib/finance-review.ts';
import { guideMessage } from '../artifacts/falcon-eye/src/lib/assistant-guide.ts';

const now = Date.parse('2026-11-18T00:00:00.000Z');
const record = (id, overrides = {}) => ({
  id, category: 'cash', name: id, currency: 'USD', cost: null, value: 100,
  valuationDate: '2026-11-18', valuationSource: 'manual', access: 'unknown',
  location: '', notes: '', details: {}, ...overrides,
});
const document = (records, extra = {}) => validateDocument({ ...emptyDocument(), records, ...extra });

test('value-age display preserves unknown, genuine zero, future and stale dates without mutation', () => {
  const current = record('current', { value: 0 });
  const raw = JSON.stringify(current);
  assert.deepEqual(valuationAge(current, now), { days: 0, stale: false });
  assert.equal(valuationAge(record('missing', { value: null }), now), null);
  assert.equal(valuationAge(record('legacy', { valuationDate: '1970-01-01' }), now), null);
  assert.deepEqual(valuationAge(record('future', { valuationDate: '2026-11-19' }), now), { days: -1, stale: false });
  const boundary = record('boundary', { valuationDate: new Date(now - 90 * 86_400_000).toISOString().slice(0, 10) });
  assert.deepEqual(valuationAge(boundary, now), { days: 90, stale: false });
  assert.equal(valuationAge(boundary, now + 1).stale, true);
  assert.equal(valuationAge(record('old', { valuationDate: '2020-01-01' }), now).stale, true);
  assert.equal(JSON.stringify(current), raw);
});
test('review separates included old values from excluded unknown values and missing rates', () => {
  const doc = document([
    record('old', { valuationDate: '2020-01-01' }),
    record('unknown', { value: null, valuationDate: '2020-01-01' }),
    record('foreign', { currency: 'AED', valuationDate: '2020-01-01' }),
    record('current'),
    record('gift', { category: 'private', details: { agreementType: 'gift' } }),
  ]);
  const raw = JSON.stringify(doc);
  assert.deepEqual(reviewFinance(doc, now).map(({ record, reason }) => [record.id, reason]), [
    ['old', 'stale'], ['unknown', 'missingValue'], ['foreign', 'missingRate'],
  ]);
  assert.equal(summarizeFinance(doc).assets, 200);
  assert.equal(JSON.stringify(doc), raw);
});

test('zero is known, unknown dates are reviewed, and the 90-day boundary is consistent', () => {
  const boundary = new Date(now - 90 * 86_400_000).toISOString().slice(0, 10);
  const doc = document([
    record('zero', { value: 0 }), record('boundary', { valuationDate: boundary }),
    record('undated', { valuationDate: '1970-01-01' }),
    record('debt', { category: 'debt', valuationDate: '2020-01-01', value: 30 }),
  ]);
  assert.deepEqual(reviewFinance(doc, now).map(({ record }) => record.id), ['undated', 'debt']);
  assert.equal(summarizeFinance(doc).netWorth, 170);
});

test('adding a rate moves an old foreign value from excluded to included-needs-review', () => {
  const doc = document([record('foreign', { currency: 'AED', valuationDate: '2020-01-01' })]);
  const fixed = { ...doc, rates: { AED: { rate: 0.25, date: '2026-11-18' } } };
  assert.equal(reviewFinance(doc, now)[0].reason, 'missingRate');
  assert.equal(reviewFinance(fixed, now)[0].reason, 'stale');
  assert.equal(summarizeFinance(fixed).assets, 25);
});

test('guided questions request one missing detail without changing parsed financial values', () => {
  const result = guideMessage('I invested AED 10,000 with my cousin', null, 'AED');
  assert.match(result.reply, /whether this is ownership, a loan, or a gift/);
  assert.doesNotMatch(result.reply, /a name|a current value/);
  assert.equal(result.draft.cost, 10000);
  assert.equal(result.draft.value, undefined);
});
