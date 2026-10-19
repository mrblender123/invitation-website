// Run with: node --test scripts/test-email-delivery.cjs
// Exercise the real tracking implementation with Supabase result/transport failures.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../lib/edit-tracking.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function tracking(...results) {
  const warnings = [];
  const query = new Proxy({}, {
    get: (_, key) => key === 'then'
      ? (resolve, reject) => {
        const result = results.shift();
        if (result === undefined) throw new Error('Unexpected database query');
        return (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)).then(resolve, reject);
      }
      : () => query,
  });
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: () => ({ createClient: () => ({ from: () => query }) }),
    process: { env: {} },
    console: { error: (...args) => warnings.push(args) },
  });
  return { ...exports, warnings };
}

test('a successful atomic claim allows delivery', async () => {
  const db = tracking({ data: [{ payment_intent_id: 'pi_test' }], error: null });
  assert.equal(await db.markEmailSent('pi_test'), true);
  assert.equal(db.warnings.length, 0);
});

test('a confirmed previous claim prevents duplicate delivery', async () => {
  const db = tracking({ data: [], error: null }, { data: { email_sent: true }, error: null });
  assert.equal(await db.markEmailSent('pi_test'), false);
});

test('a returned Supabase connection error must not skip the purchase email', async () => {
  const db = tracking({ data: null, error: { message: 'TypeError: fetch failed' } });
  assert.equal(await db.markEmailSent('pi_test'), true);
  assert.equal(db.warnings.length, 1);
});

test('a thrown connection error must not skip the purchase email', async () => {
  const db = tracking(new Error('connection failed'));
  assert.equal(await db.markEmailSent('pi_test'), true);
  assert.equal(db.warnings.length, 1);
});

test('a missing tracking row must not be mistaken for an email already sent', async () => {
  const db = tracking({ data: [], error: null }, { data: null, error: { message: 'No rows found' } });
  assert.equal(await db.markEmailSent('pi_test'), true);
});

test('an unconfirmed claim must not suppress delivery', async () => {
  const db = tracking({ data: [], error: null }, { data: { email_sent: false }, error: null });
  assert.equal(await db.markEmailSent('pi_test'), true);
});

test('the backup email runs on both returned and thrown database failures', async () => {
  for (const result of [{ data: null, error: { message: 'fetch failed' } }, new Error('fetch failed')]) {
    const db = tracking(result);
    assert.equal(await db.wasEmailSent('pi_test'), false);
    assert.equal(db.warnings.length, 1);
  }
});

test('the backup email still skips a confirmed prior delivery', async () => {
  const db = tracking({ data: { email_sent: true }, error: null });
  assert.equal(await db.wasEmailSent('pi_test'), true);
});

test('initialization failures are surfaced instead of silently ignored', async () => {
  const db = tracking({ error: { message: 'fetch failed' } });
  await assert.rejects(db.initEditRecord('pi_test', 'template'), /Failed to initialize edit record/);
});

test('failed claim releases are logged without hiding the original send failure', async () => {
  const db = tracking({ error: { message: 'fetch failed' } });
  await db.resetEmailSent('pi_test');
  assert.equal(db.warnings.length, 1);
});
