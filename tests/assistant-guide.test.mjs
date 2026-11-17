import assert from 'node:assert/strict';
import test from 'node:test';
import { guideMessage } from '../artifacts/falcon-eye/src/lib/assistant-guide.ts';

test('guided assistant drafts gold without assuming its current value or saving it', () => {
  const result = guideMessage('I bought 20g of 22k gold for AED 5,000', null, 'USD');
  assert.equal(result.draft.category, 'gold');
  assert.equal(result.draft.currency, 'AED');
  assert.equal(result.draft.cost, 5000);
  assert.equal(result.draft.details.weightGrams, 20);
  assert.equal(result.draft.details.purity, 22 / 24);
  assert.equal(result.draft.value, undefined);
  assert.match(result.reply, /Nothing has been saved/);
});

test('guided assistant distinguishes a private investment and asks for agreement type', () => {
  const result = guideMessage('I invested AED 10,000 with my cousin', null, 'AED');
  assert.equal(result.draft.category, 'private');
  assert.equal(result.draft.cost, 10000);
  assert.match(result.reply, /ownership, a loan, or a gift/);
  const updated = guideMessage('It is a loan, value unknown, called Cousin business', result.draft, 'AED');
  assert.equal(updated.draft.details.agreementType, 'loan');
  assert.equal(updated.draft.value, null);
});

test('guided assistant keeps amounts finite, asks when category unclear, declines recommendations', () => {
  assert.equal(guideMessage('Hello', null, 'AED').draft, null);
  assert.equal(guideMessage('Should I buy bitcoin?', null, 'AED').draft, null);
  const result = guideMessage('I owe AED 2000 on a credit card', null, 'AED');
  assert.equal(result.draft.category, 'debt');
  assert.equal(result.draft.value, 2000);
});
