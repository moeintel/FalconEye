import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadFinanceBackup } from '../artifacts/falcon-eye/src/lib/finance-backup.ts';
import { sampleDocument } from '../artifacts/falcon-eye/src/lib/finance-model.ts';

test('backup download preserves the full language-neutral document and sample flag without mutation', async () => {
  const originalDocument = globalThis.document;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const doc = sampleDocument();
  const raw = JSON.stringify(doc);
  let blob, clicked = false, revoked;
  const anchor = { click() { clicked = true; } };
  try {
    globalThis.document = { createElement(tag) { assert.equal(tag, 'a'); return anchor; } };
    URL.createObjectURL = (value) => { blob = value; return 'blob:test'; };
    URL.revokeObjectURL = (value) => { revoked = value; };
    downloadFinanceBackup(doc);
    assert.equal(clicked, true);
    assert.equal(anchor.download, 'falcon-eye-backup.json');
    assert.equal(anchor.href, 'blob:test');
    assert.equal(revoked, 'blob:test');
    assert.equal(blob.type, 'application/json');
    assert.deepEqual(JSON.parse(await blob.text()), doc);
    assert.equal(JSON.stringify(doc), raw);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
