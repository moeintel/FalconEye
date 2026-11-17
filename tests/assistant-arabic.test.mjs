import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assistantCommand, guideMessage } from '../artifacts/falcon-eye/src/lib/assistant-guide.ts';

function assistantCatalog(language) {
  return JSON.parse(readFileSync(new URL(`../artifacts/falcon-eye/src/locales/${language}/assistant.json`, import.meta.url), 'utf8'));
}

test('Arabic guided entry normalizes Arabic digits and drafts gold without inventing a value', () => {
  const result = guideMessage('اشتريت ٢٠ جرامًا من الذهب عيار ٢٢ مقابل ٥٬٠٠٠ درهم', null, 'USD', 'ar');
  assert.equal(result.draft.category, 'gold');
  assert.equal(result.draft.currency, 'AED');
  assert.equal(result.draft.cost, 5000);
  assert.equal(result.draft.details.weightGrams, 20);
  assert.equal(result.draft.details.purity, 22 / 24);
  assert.equal(result.draft.name, 'ذهب مادي');
  assert.equal(result.draft.value, undefined);
  assert.match(result.reply, /القيمة الحالية/);
  assert.match(result.reply, /لم يُحفظ أي شيء/);
});

test('Arabic vocabulary drafts debts, lent money, currencies, value, date, and names', () => {
  const debt = guideMessage('عليّ دين بطاقة ائتمان رصيده ١٬٢٥٠ ريال سعودي اليوم، اسمه بطاقتي', null, 'AED', 'ar');
  assert.equal(debt.draft.category, 'debt');
  assert.equal(debt.draft.currency, 'SAR');
  assert.equal(debt.draft.value, 1250);
  assert.equal(debt.draft.valuationDate, new Date().toISOString().slice(0, 10));
  assert.equal(debt.draft.name, 'بطاقتي');

  const lent = guideMessage('أقرضت قريبي ٣٬٠٠٠ درهم إماراتي، قيمته ٢٬٠٠٠ درهم', null, 'USD', 'ar');
  assert.equal(lent.draft.category, 'lent');
  assert.equal(lent.draft.currency, 'AED');
  assert.equal(lent.draft.cost, 3000);
  assert.equal(lent.draft.value, 2000);
});

test('Arabic علي followed by an amount identifies a debt without relying on a later debt noun', () => {
  const result = guideMessage('علي ١٬٢٥٠ درهم', null, 'AED', 'ar');
  assert.equal(result.draft.category, 'debt');
  assert.equal(result.draft.value, 1250);
});

test('Arabic GBP values and ألف scaling survive hamza canonicalization', () => {
  const result = guideMessage('أسهم قيمتها ٥ ألف جنيه إسترليني اليوم، اسمها محفظتي', null, 'AED', 'ar');
  assert.equal(result.draft.category, 'stocks');
  assert.equal(result.draft.currency, 'GBP');
  assert.equal(result.draft.value, 5000);
  assert.equal(result.draft.valuationDate, new Date().toISOString().slice(0, 10));
});

test('Arabic category matching uses word boundaries and does not treat a name as a debt', () => {
  const namedAli = guideMessage('استثمرت مع قريبي اسمه علي في مشروع خاص، والقيمة غير معروفة', null, 'AED', 'ar');
  assert.equal(namedAli.draft.category, 'private');
  assert.equal(namedAli.draft.value, null);

  const ordinaryWords = guideMessage('لدي نقدًا وقطعة أرضية اسمها سهمي القديم', null, 'AED', 'ar');
  assert.equal(ordinaryWords.draft.category, 'cash');
});

test('Arabic private investment agreement and unknown value stay explicit', () => {
  const initial = guideMessage('استثمرت ١٠٬٠٠٠ درهم مع قريبي، وهذه ملكية في المشروع، والقيمة غير معروفة', null, 'USD', 'ar');
  assert.equal(initial.draft.category, 'private');
  assert.equal(initial.draft.cost, 10000);
  assert.equal(initial.draft.value, null);
  assert.equal(initial.draft.details.agreementType, 'equity');
  assert.match(initial.reply, /اسمًا للسجل/);
});

test('Arabic commands require exact explicit phrases and never accept a generic yes', () => {
  assert.equal(assistantCommand('نعم', 'ar'), null);
  assert.equal(assistantCommand('نعم، احفظه', 'ar'), null);
  assert.equal(assistantCommand('yes, save it', 'ar'), null);
  assert.equal(assistantCommand('أؤكد حفظ هذا السجل', 'ar'), 'save');
  assert.equal(assistantCommand('ابدأ سجلاتي الشخصية', 'ar'), 'start');
  assert.equal(assistantCommand('أؤكد بدء سجلاتي الشخصية', 'ar'), 'confirmStart');
  assert.equal(assistantCommand('أؤكد بدء سجلاتي الشخصية', 'en'), null);
});

test('confirmation phrases stay in sync with the bilingual assistant catalog', () => {
  for (const language of ['en', 'ar']) {
    const { commands } = assistantCatalog(language);
    assert.equal(assistantCommand(commands.save, language), 'save');
    assert.equal(assistantCommand(commands.start, language), 'start');
    assert.equal(assistantCommand(commands.confirmStart, language), 'confirmStart');
  }
  assert.equal(assistantCommand('yes', 'ar'), null);
});

test('Arabic recommendation requests are declined without changing the previous draft', () => {
  const previous = { category: 'gold', name: 'ذهب العائلة' };
  const result = guideMessage('هل أشتري أسهمًا الآن؟', previous, 'AED', 'ar');
  assert.equal(result.draft, previous);
  assert.match(result.reply, /لا أقدم توصيات/);
});
