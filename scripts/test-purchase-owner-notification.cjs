// No network requests or real emails: exercise notification logic and the signed webhook boundary.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, overrides) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    exports, require: name => { if (!(name in overrides)) throw Error(`Unexpected dependency: ${name}`); return overrides[name]; },
    process: { env: { RESEND_FROM: 'Share Your Simcha <info@example.test>' } },
    console: { error() {}, log() {} }, Response, Date, Intl, Buffer, encodeURIComponent,
    setTimeout() {}, // Buyer backup waits must not send emails or create real timers in tests.
  }, { filename: file });
  return exports;
}
const payment = {
  id: 'pi_owner_test', status: 'succeeded', livemode: true, amount: 1999, amount_received: 999,
  currency: 'usd', created: 1794916800,
  metadata: { templateId: "It's a boy-Bris-EB-06", email: 'customer@example.test' },
};
function notification({ alreadySent = false, sendError = false, saveError = false, readError = false } = {}) {
  const sent = [], updates = []; let reads = 0;
  const mod = load('lib/purchase-owner-notification.ts', {
    stripe: class {
      paymentIntents = {
        retrieve: async () => { reads++; if (readError) throw Error('offline'); return { ...payment, metadata: alreadySent ? { owner_purchase_email_id: 'existing' } : {} }; },
        update: async (id, data) => { updates.push({ id, data }); if (saveError) throw Error('offline'); alreadySent = true; },
      };
    },
    resend: { Resend: class { emails = { send: async (body, options) => {
      sent.push({ body, options }); return sendError ? { error: { message: 'rejected' } } : { data: { id: 'owner-email-1' } };
    } }; } },
  });
  return { notify: mod.notifyOwnerOfPurchase, sent, updates, reads: () => reads };
}
test('a real purchase sends the owner actual amount, customer, template and links', async () => {
  const h = notification(); await h.notify(payment);
  assert.equal(h.sent.length, 1);
  const { body, options } = h.sent[0];
  assert.equal(body.to, 'bycheshin@gmail.com');
  assert.match(body.subject, /\$9\.99/);
  assert.ok(body.text.includes(payment.metadata.templateId));
  assert.ok(body.text.includes('customer@example.test'));
  assert.ok(body.text.includes('https://dashboard.stripe.com/payments/pi_owner_test'));
  assert.equal(options.idempotencyKey, 'owner-purchase/pi_owner_test');
  assert.equal(Object.keys(h.updates[0].data.metadata).join(','), 'owner_purchase_email_id');
});
test('test mode, incomplete, zero-amount and unrelated payments never send owner alerts', async () => {
  const h = notification();
  for (const changes of [{livemode:false}, {status:'processing'}, {amount_received:0}, {metadata:{}}]) {
    await h.notify({ ...payment, ...changes });
  }
  assert.equal(h.sent.length, 0); assert.equal(h.reads(), 0);
});
test('webhook replay checks current Stripe metadata, not the stale event snapshot', async () => {
  const h = notification(); await h.notify(payment); await h.notify(payment);
  assert.equal(h.sent.length, 1); assert.equal(h.reads(), 2);
  const previous = notification({alreadySent:true}); await previous.notify(payment); assert.equal(previous.sent.length, 0);
});
test('failed sends are retriable and never marked as delivered', async () => {
  const h = notification({sendError:true});
  await assert.rejects(h.notify(payment), /not accepted/); assert.equal(h.updates.length, 0);
});
test('metadata save failure retries use an identical email key and payload', async () => {
  const h = notification({saveError:true});
  await assert.rejects(h.notify(payment), /offline/); await assert.rejects(h.notify(payment), /offline/);
  assert.deepEqual(h.sent[0], h.sent[1]);
});
test('unavailable deduplication data does not risk an unguarded send', async () => {
  const h = notification({readError:true}); await assert.rejects(h.notify(payment), /offline/);
  assert.equal(h.sent.length, 0);
});
function webhook({ invalidSignature=false, eventType='payment_intent.succeeded', notificationFails=false }={}) {
  const notices=[], background=[];
  const route=load('app/api/stripe/webhook/route.ts', {
    stripe: class {
      webhooks={constructEvent:()=>{if(invalidSignature)throw Error('signature');return {type:eventType,data:{object:payment}};}};
      checkout={sessions:{list:async()=>({data:[]})}};
    },
    resend:{Resend:class{}},
    '@/lib/purchase-owner-notification':{notifyOwnerOfPurchase:async pi=>{notices.push(pi);if(notificationFails)throw Error('offline');}},
    '@/lib/purchase-email-status':{recordPurchaseEmail:async()=>true},
    '@vercel/functions':{waitUntil:promise=>background.push(promise)},
    '@/lib/edit-tracking':{initEditRecord:async()=>{},wasEmailSent:async()=>true,markEmailSent:async()=>true,resetEmailSent:async()=>{}},
    '@/lib/download-token':{createDownloadToken:()=> 'test'},
    '@/lib/supabase':{createServiceClient:()=>({from:()=>({upsert:async()=>({error:null})})})},
  });
  return {notices,background,post:(signature='signature')=>route.POST(new Request('https://example.test/api/stripe/webhook',{method:'POST',headers:signature?{'stripe-signature':signature}:{},body:'test event'}))};
}
test('unsigned or invalid webhooks cannot trigger owner emails',async()=>{
  const missing=webhook(); assert.equal((await missing.post('')).status,400);assert.equal(missing.notices.length,0);
  const invalid=webhook({invalidSignature:true});assert.equal((await invalid.post()).status,400);assert.equal(invalid.notices.length,0);
});
test('only a successful-payment webhook triggers an alert',async()=>{
  const ignored=webhook({eventType:'payment_intent.payment_failed'});assert.equal((await ignored.post()).status,200);assert.equal(ignored.notices.length,0);
  const success=webhook();assert.equal((await success.post()).status,200);assert.equal(success.notices.length,1);assert.equal(success.background.length,1);
});
test('notification failure requests a Stripe retry while retaining buyer backup delivery',async()=>{
  const h=webhook({notificationFails:true});assert.equal((await h.post()).status,503);assert.equal(h.background.length,1);
});
