import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { createRequire } from 'node:module';
import {
  direction, formatDate, formatMoney, getLocale, normalizeArabicNumbers, resolveLanguage, setActiveLanguage,
} from '../artifacts/falcon-eye/src/lib/locale.ts';
import { CATEGORIES, sampleDocument, summarizeFinance } from '../artifacts/falcon-eye/src/lib/finance-model.ts';

const root = new URL('../artifacts/falcon-eye/src/locales/', import.meta.url);
function flatten(value, prefix = '', result = {}) {
  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === 'object') flatten(item, path, result);
    else result[path] = item;
  }
  return result;
}
const plural = /_(zero|one|two|few|many|other)$/;
const parameters = (value) => [...value.matchAll(/{{\s*([\w]+)(?:,[^}]*)?\s*}}/g)].map((match) => match[1]).sort();
const slots = (value) => [...value.matchAll(/<\/?([A-Za-z][\w]*)\s*\/?>/g)].map((match) => match[0]).sort();

test('every namespace has complete English and Arabic messages and matching parameters', () => {
  const englishFiles = readdirSync(new URL('en/', root)).filter((name) => name.endsWith('.json')).sort();
  const arabicFiles = readdirSync(new URL('ar/', root)).filter((name) => name.endsWith('.json')).sort();
  assert.deepEqual(arabicFiles, englishFiles);
  for (const name of englishFiles) {
    const en = flatten(JSON.parse(readFileSync(new URL(`en/${name}`, root), 'utf8')));
    const ar = flatten(JSON.parse(readFileSync(new URL(`ar/${name}`, root), 'utf8')));
    const bases = (catalog) => [...new Set(Object.keys(catalog).map((key) => key.replace(plural, '')))].sort();
    assert.deepEqual(bases(ar), bases(en), `Missing translation in ${name}`);
    for (const [key, value] of Object.entries(ar)) {
      assert.equal(typeof value, 'string', `${name}:${key}`);
      assert.ok(value.trim().length, `Empty Arabic message ${name}:${key}`);
      const counterpart = en[key] ?? en[`${key.replace(plural, '')}_other`];
      assert.equal(typeof counterpart, 'string', `Unexpected Arabic key ${name}:${key}`);
      const actual = parameters(value).filter((parameter) => !(plural.test(key) && parameter === 'count'));
      const expected = parameters(counterpart).filter((parameter) => !(plural.test(key) && parameter === 'count'));
      assert.deepEqual(actual, expected, `Interpolation mismatch ${name}:${key}`);
      assert.deepEqual(slots(value), slots(counterpart), `Rich-text slot mismatch ${name}:${key}`);
      if (plural.test(key)) for (const suffix of ['zero', 'one', 'two', 'few', 'many', 'other']) {
        assert.ok(`${key.replace(plural, '')}_${suffix}` in ar, `Missing Arabic plural ${name}:${key}:${suffix}`);
      }
    }
  }
});

test('language selection is predictable and independent of financial currency', () => {
  assert.equal(resolveLanguage('ar', 'en', 'en-GB'), 'ar');
  assert.equal(resolveLanguage(null, 'ar', 'en-US'), 'ar');
  assert.equal(resolveLanguage(null, null, 'ar-EG'), 'ar');
  assert.equal(resolveLanguage('fr', 'broken', 'fr-FR'), 'en');
  assert.equal(direction('ar'), 'rtl');
  assert.equal(direction('en'), 'ltr');
});

test('every financial category has translated metadata without changing its stored identifier', () => {
  for (const language of ['en', 'ar']) {
    const catalog = JSON.parse(readFileSync(new URL(`${language}/common.json`, root), 'utf8'));
    assert.deepEqual(Object.keys(catalog.categories).sort(), CATEGORIES.map((category) => category.id).sort());
    assert.deepEqual(Object.keys(catalog.categoryDescriptions).sort(), CATEGORIES.map((category) => category.id).sort());
  }
});

test('i18next selects all six Arabic plural forms correctly', async () => {
  const require = createRequire(new URL('../artifacts/falcon-eye/package.json', import.meta.url));
  const instance = require('i18next').createInstance();
  const messages = JSON.parse(readFileSync(new URL('ar/common.json', root), 'utf8'));
  await instance.init({ lng: 'ar', fallbackLng: false, resources: { ar: { translation: messages } } });
  for (const [count, expected] of [[0, 'لا توجد سجلات'], [1, 'سجل واحد'], [2, 'سجلان'], [3, '3 سجلات'], [11, '11 سجلًا'], [100, '100 سجل']]) {
    assert.equal(instance.t('records', { count }), expected);
  }
});

test('Arabic formatting never changes financial documents, calculations, or precision', () => {
  const document = sampleDocument();
  const raw = JSON.stringify(document);
  const summary = summarizeFinance(document);
  setActiveLanguage('ar');
  try {
    assert.equal(getLocale(), 'ar-AE-u-nu-latn');
    assert.match(formatMoney(1.234, 'KWD'), /1[.,]234/);
    assert.ok(!formatMoney(1, 'JPY').includes('.00'));
    assert.ok(formatDate('2026-11-14').includes('2026'));
    assert.equal(JSON.stringify(document), raw);
    assert.deepEqual(summarizeFinance(document), summary);
  } finally { setActiveLanguage('en'); }
});

test('Arabic and Persian conversational digits normalize without interpreting amounts', () => {
  assert.equal(normalizeArabicNumbers('٥٬٠٠٠٫٥'), '5,000.5');
  assert.equal(normalizeArabicNumbers('۱۲۳٫۴۵'), '123.45');
  assert.equal(normalizeArabicNumbers('ذهب ٢٠ جرام BTC'), 'ذهب 20 جرام BTC');
});

test('translated screens have valid message keys and no uncatalogued literal UI copy', () => {
  const sourceRoot = new URL('../artifacts/falcon-eye/src/', import.meta.url);
  const catalogs = Object.fromEntries(['en', 'ar'].map((language) => [language,
    Object.fromEntries(readdirSync(new URL(`${language}/`, root)).map((name) => [
      name.replace(/\.json$/, ''), flatten(JSON.parse(readFileSync(new URL(`${language}/${name}`, root), 'utf8'))),
    ])),
  ]));
  function checkFile(file) {
    const source = ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const aliases = new Map();
    function visitBindings(node) {
      if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)
        && node.initializer && ts.isCallExpression(node.initializer)
        && node.initializer.expression.getText(source) === 'useTranslation') {
        const first = node.initializer.arguments[0];
        const namespace = first && ts.isStringLiteral(first) ? first.text : 'common';
        for (const element of node.name.elements) {
          if ((element.propertyName?.getText(source) ?? element.name.getText(source)) === 't') {
            aliases.set(element.name.getText(source), namespace);
          }
        }
      }
      ts.forEachChild(node, visitBindings);
    }
    visitBindings(source);
    function isVerbatim(node) {
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isJsxElement(parent) && ['code', 'pre'].includes(parent.openingElement.tagName.getText(source))) return true;
      }
      return false;
    }
    function literalKeys(node) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
      return ts.isConditionalExpression(node) ? [...literalKeys(node.whenTrue), ...literalKeys(node.whenFalse)] : [];
    }
    function visitCalls(node) {
      if (aliases.size && ts.isJsxText(node)) {
        const text = node.getText(source).trim();
        const endonym = file.pathname.endsWith('/components/language-switcher.tsx') && ['English', 'العربية'].includes(text);
        const brandMark = file.pathname.endsWith('/components/finance-shell.tsx') && text === 'F';
        assert.ok(!/\p{L}/u.test(text) || endonym || brandMark || isVerbatim(node),
          `${file.pathname}: literal UI copy must use a message ID: ${text}`);
      }
      if (aliases.size && ts.isJsxAttribute(node) && ['aria-label', 'placeholder', 'title', 'alt'].includes(node.name.getText(source))
        && node.initializer && ts.isStringLiteral(node.initializer)) {
        assert.ok(!/\p{L}/u.test(node.initializer.text),
          `${file.pathname}: literal ${node.name.getText(source)} must use a message ID: ${node.initializer.text}`);
      }
      if (aliases.size && ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent) && !isVerbatim(node)) {
        for (const text of literalKeys(node.expression)) {
          assert.ok(!/\p{L}/u.test(text), `${file.pathname}: literal UI expression must use a message ID: ${text}`);
        }
      }
      if (ts.isCallExpression(node) && node.arguments[0]) {
        const expression = node.expression.getText(source);
        const namespace = aliases.get(expression);
        if (namespace || expression === 'i18n.t') for (const input of literalKeys(node.arguments[0])) {
          const [ns, key] = input.includes(':') ? input.split(':', 2) : [namespace ?? 'common', input];
          for (const language of ['en', 'ar']) {
            const catalog = catalogs[language][ns] ?? {};
            assert.ok(key in catalog || `${key}_other` in catalog,
              `${file.pathname}: missing ${language} ${ns}:${key}`);
          }
        }
      }
      ts.forEachChild(node, visitCalls);
    }
    visitCalls(source);
  }
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) walk(file);
      else if (/\.tsx?$/.test(entry.name)) checkFile(file);
    }
  }
  walk(sourceRoot);
});

test('all app pages and shared feature components participate in localization', () => {
  const sourceRoot = new URL('../artifacts/falcon-eye/src/', import.meta.url);
  const pages = readdirSync(new URL('pages/', sourceRoot)).filter((name) => name.endsWith('.tsx')).map((name) => `pages/${name}`);
  const components = ['allocation', 'data-controls', 'error-boundary', 'falc-assistant', 'falc-mascot',
    'finance-account', 'finance-editor', 'finance-shell', 'holding-form', 'shell'].map((name) => `components/${name}.tsx`);
  for (const path of [...pages, ...components]) {
    assert.match(readFileSync(new URL(path, sourceRoot), 'utf8'), /useTranslation\(/, `Unmigrated screen: ${path}`);
  }
});
