// Run with: node --test scripts/test-checkout-email.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relativePath, requireMock) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: requireMock, process: { env: { STRIPE_SECRET_KEY: 'test-only' } }, Response, console });
  return exports;
}
const validation = load('lib/checkout-email.ts');
function paymentRoute() {
  const calls = [];
  class Stripe {
    paymentIntents = { create: async data => { calls.push(data); return { client_secret: 'mock-secret' }; } };
  }
  const route = load('app/api/stripe/payment-intent/route.ts', name => {
    if (name === 'stripe') return Stripe;
    if (name === '@/lib/checkout-email') return validation;
    throw new Error(`Unexpected dependency: ${name}`);
  });
  return { ...route, calls };
}

test('invalid checkout emails are rejected before contacting Stripe', async () => {
  const { POST, calls } = paymentRoute();
  for (const email of [undefined, null, 123, {}, '', ' ', 'not-an-email', 'name@', '@example.com', 'name@example', 'a b@example.com', '.name@example.com', 'name..two@example.com', 'a@@example.com', 'a@-example.com', 'a@example..com', 'a'.repeat(65) + '@example.com']) {
    const response = await POST({ json: async () => ({ templateId: 'test', templateName: 'Test', email }) });
    assert.equal(response.status, 400, JSON.stringify(email));
    assert.equal((await response.json()).error, validation.CHECKOUT_EMAIL_ERROR);
  }
  assert.equal(calls.length, 0);
});

test('valid email is normalized and sent with the existing purchase metadata', async () => {
  const { POST, calls } = paymentRoute();
  const response = await POST({ json: async () => ({ templateId: 'test', templateName: 'Test', email: '  Test+invite@EXAMPLE.COM  ', fieldValues: { day: 'Tuesday' } }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).clientSecret, 'mock-secret');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].metadata.email, 'Test+invite@example.com');
  assert.equal(calls[0].metadata.templateId, 'test');
  assert.deepEqual(JSON.parse(calls[0].metadata.fv0), { day: 'Tuesday' });
});
