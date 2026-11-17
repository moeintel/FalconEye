import assert from 'node:assert/strict';
import test from 'node:test';
import { hasForbiddenAssistantAdvice } from '../artifacts/api-server/src/lib/assistant-safety.ts';

test('assistant response screen rejects bounded Arabic recommendations and guarantees without network access', () => {
  assert.equal(hasForbiddenAssistantAdvice('أنصحك بشراء الأسهم.'), true);
  assert.equal(hasForbiddenAssistantAdvice('يجب عليك بيع الذهب.'), true);
  assert.equal(hasForbiddenAssistantAdvice('عوائد مضمونة.'), true);
  assert.equal(hasForbiddenAssistantAdvice('هذه أرباح مضمونة لك.'), true);
});

test('assistant response screen allows Arabic safety explanations that negate recommendations or guarantees', () => {
  assert.equal(hasForbiddenAssistantAdvice('لا أستطيع أن أنصحك بشراء الأسهم أو بيعها.'), false);
  assert.equal(hasForbiddenAssistantAdvice('لا توجد عوائد مضمونة.'), false);
  assert.equal(hasForbiddenAssistantAdvice('العوائد ليست مضمونة.'), false);
  assert.equal(hasForbiddenAssistantAdvice('I cannot recommend buying or selling.'), false);
});

test('existing English recommendation and guarantee screening remains active', () => {
  assert.equal(hasForbiddenAssistantAdvice('I recommend buying this asset.'), true);
  assert.equal(hasForbiddenAssistantAdvice('You should sell.'), true);
  assert.equal(hasForbiddenAssistantAdvice('Guaranteed returns are available.'), true);
  assert.equal(hasForbiddenAssistantAdvice('I can help record an asset.'), false);
});
