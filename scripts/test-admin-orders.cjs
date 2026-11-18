// Run with: node --test scripts/test-admin-orders.cjs
// Real support handlers, with database/payment/email boundaries mocked. No email is sent.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ts=require('typescript');
function load(file,overrides={}) {
  const exports={};
  const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(source,{exports,require:name=>name in overrides?overrides[name]:require(name),process:{env:{DOWNLOAD_TOKEN_SECRET:'test-only-secret',NEXT_PUBLIC_APP_URL:'https://example.test',RESEND_FROM:'Test <test@example.test>'}},console:{error(){}},Date,Intl,Buffer,URL,URLSearchParams,Response,Request,setTimeout},{filename:file});
  return exports;
}
const orders=load('lib/admin/orders.ts');
const tokens=load('lib/download-token.ts');
const base={id:'order-1',type:'purchase',email:'customer@example.test',template_id:'Tenoyim-CS-08',template_name:'Tenoyim',field_values:{name:'משה',date:'Monday'},payment_intent_id:'pi_test_1',amount_cents:999,created_at:'2026-11-17T15:00:00Z',email_claimed:false,edits_remaining:2};
const paid={id:'pi_test_1',status:'succeeded',currency:'usd',amount_received:999,livemode:false,metadata:{templateId:base.template_id,email:base.email},latest_charge:{refunded:false,amount_refunded:0}};
function query(result) {
  const calls=[];
  const q=new Proxy({}, {get:(_,key)=>key==='then'?(resolve,reject)=>Promise.resolve(result).then(resolve,reject):(...args)=>{calls.push([key,...args]);return q;}});
  return {q,calls};
}
function support({order=base,pi=paid,dbError=null,stripeError=false,emailEvent='delivered',emailError=false}={}) {
  const {q}=query({data:order,error:dbError});
  return load('lib/admin/order-support.ts',{
    stripe:class{paymentIntents={retrieve:async()=>{if(stripeError)throw Error('offline');return pi;}};},
    resend:{Resend:class{emails={get:async()=>emailError?{error:{message:'offline'}}:{data:{last_event:emailEvent}}};}},
    '@/lib/supabase':{createServiceClient:()=>({from:()=>q})},
    '@/lib/download-token':tokens,
    './order-data':{ORDER_COLUMNS:'id',addTracking:async rows=>({orders:rows})},
    './orders':orders,
  });
}
function handler({admin=true,detail,pi=paid,sendError=false,tracking=true,claimError=false}={}) {
  const sends=[];const claims=query({data:claimError?null:[{payment_intent_id:paid.id}],error:claimError?{}:null});
  const instance=support();
  const route=load('app/api/admin/orders/[id]/route.ts',{
    'next/server':{NextResponse:{json:(data,options)=>Response.json(data,options)}},
    resend:{Resend:class{emails={send:async(payload,options)=>{sends.push({payload,options});return sendError?{error:{message:'offline'}}:{data:{id:'message-1'}};}}}},
    '@/lib/admin/auth':{requireAdmin:async()=>admin,privateHeaders:{'Cache-Control':'private, no-store'}},
    '@/lib/admin/order-support':{...instance,inspectOrder:async()=>({detail:detail??{order:base,canRecover:true},pi})},
    '@/lib/checkout-email':load('lib/checkout-email.ts'),
    '@/lib/purchase-email-status':{recordPurchaseEmail:async()=>tracking},
    '@/lib/supabase':{createServiceClient:()=>({from:()=>claims.q})},
  });
  const post=action=>route.POST(new Request('https://example.test/api/admin/orders/order-1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,to:'attacker@example.test'})}),{params:Promise.resolve({id:base.id})});
  return {post,sends,claims};
}

test('New York day boundaries and DST do not double-count revenue or drafts',()=>{
  const result=orders.summarizeOrders([
    {...base,created_at:'2026-11-02T04:59:00Z'}, // Nov 1 NY
    {...base,created_at:'2026-11-02T05:01:00Z'}, // Nov 2 NY
    {...base,type:'draft',amount_cents:0,created_at:'2026-11-02T07:00:00Z'},
    {...base,created_at:'2026-09-01T12:00:00Z'},
  ],new Date('2026-11-02T15:00:00Z'));
  assert.equal(result.days.length,30);assert.equal(new Set(result.days.map(d=>d.date)).size,30);
  assert.equal(result.today.revenue,999);assert.equal(result.revenue,1998);assert.equal(result.drafts,1);
});
test('failed, refunded, disputed, unknown, exhausted, or missing saved details cannot recover',()=>{
  for(const status of ['refunded','disputed','processing','unknown','canceled'])assert.ok(orders.recoveryReason(status,2,true));
  for(const remaining of [null,0,-1])assert.ok(orders.recoveryReason('succeeded',remaining,true));
  assert.ok(orders.recoveryReason('succeeded',2,false));assert.equal(orders.recoveryReason('succeeded',2,true),null);
  assert.equal(orders.paymentState({status:'succeeded'},{refunded:true}),'refunded');
  assert.equal(orders.paymentState({status:'succeeded'},{disputed:true}),'disputed');
});
test('send claims alone never count as verified delivery',async()=>{
  const {detail}=await support({order:{...base,email_claimed:true}}).inspectOrder(base.id);
  assert.equal(detail.emailStatus,'claim_recorded');assert.equal(detail.canRecover,true);
});
test('provider event is retrieved for tracked emails, provider failure remains unverified',async()=>{
  const pi={...paid,metadata:{...paid.metadata,purchase_email_id:'message-1'}};
  assert.equal((await support({pi}).inspectOrder(base.id)).detail.emailStatus,'delivered');
  const failed=(await support({pi,emailError:true}).inspectOrder(base.id)).detail;
  assert.equal(failed.emailStatus,'accepted');assert.equal(failed.warnings.length,1);
});
test('payment template mismatch and Stripe outage disable support links',async()=>{
  for(const config of [{pi:{...paid,metadata:{templateId:'wrong'}}},{stripeError:true}]) {
    const {detail}=await support(config).inspectOrder(base.id);assert.equal(detail.canRecover,false);assert.equal(detail.payment,'unknown');
  }
});
test('missing order and database outage are distinct failures',async()=>{
  await assert.rejects(support({order:null}).inspectOrder(base.id),e=>e.status===404);
  await assert.rejects(support({dbError:{message:'offline'}}).inspectOrder(base.id),e=>e.status===503);
});
test('download link restores Hebrew fields, verifies its template and retains payment ID',()=>{
  const url=new URL(support().supportLink(base,Date.now()+86400000));
  assert.equal(url.searchParams.get('pi'),paid.id);
  assert.equal(tokens.verifyDownloadToken(url.searchParams.get('token'),base.template_id),true);
  assert.equal(tokens.verifyDownloadToken(url.searchParams.get('token'),'wrong'),false);
  assert.deepEqual(JSON.parse(Buffer.from(url.searchParams.get('restore'),'base64').toString()),base.field_values);
});
test('admin authentication rejects absent and non-admin sessions',async()=>{
  const auth=load('lib/admin/auth.ts',{'@/lib/supabase':{createAuthenticatedClient:()=>({auth:{getUser:async()=>({data:{user:{email:'customer@example.test'}}})}})}});
  assert.equal(await auth.requireAdmin(new Request('https://example.test')),false);
  assert.equal(await auth.requireAdmin(new Request('https://example.test',{headers:{Authorization:'Bearer test'}})),false);
  const h=handler({admin:false});assert.equal((await h.post('resend')).status,403);assert.equal(h.sends.length,0);
});
test('support refuses invalid actions and unverified payments before calling email',async()=>{
  const h=handler({detail:{order:base,canRecover:false,recoveryReason:'Payment unavailable'}});
  assert.equal((await h.post('resend')).status,409);assert.equal((await h.post('delete')).status,400);assert.equal(h.sends.length,0);
});
test('copy link sends no email and does not change edit allowance',async()=>{
  const h=handler();const response=await h.post('link');assert.equal(response.status,200);
  assert.ok((await response.json()).url.includes('token='));assert.equal(h.sends.length,0);assert.equal(h.claims.calls.length,0);
});
test('resend uses verified recipient and stable idempotency payload on retries',async()=>{
  const h=handler();assert.equal((await h.post('resend')).status,200);assert.equal((await h.post('resend')).status,200);
  assert.equal(h.sends[0].payload.to,base.email);
  assert.deepEqual(h.sends[0],h.sends[1]);
  assert.ok(h.sends[0].options.idempotencyKey.startsWith('admin-order-link/pi_test_1/'));
  assert.ok(h.claims.calls.every(([key,payload])=>key!=='update'||Object.keys(payload).join(',')==='email_sent'));
});
test('email rejection is an error; accepted email with tracking failure remains a success',async()=>{
  const fail=handler({sendError:true});assert.equal((await fail.post('resend')).status,502);assert.equal(fail.claims.calls.length,0);
  const accepted=handler({tracking:false,claimError:true});const res=await accepted.post('resend');
  assert.equal(res.status,200);assert.ok((await res.json()).warning);
});
test('recording provider IDs cannot turn a successful send into failure',async()=>{
  const recorder=load('lib/purchase-email-status.ts',{stripe:class{paymentIntents={update:async()=>{throw Error('metadata offline');}};}});
  assert.equal(await recorder.recordPurchaseEmail('pi_test','message-1','support_link'),false);
});
function listHandler({admin=true,error=null,warning}={}) {
  const db=query({data:error?null:[base],count:26,error});
  const route=load('app/api/admin/orders/route.ts',{
    'next/server':{NextResponse:{json:(data,options)=>Response.json(data,options)}},
    '@/lib/supabase':{createServiceClient:()=>({from:()=>db.q})},
    '@/lib/admin/auth':{requireAdmin:async()=>admin,privateHeaders:{'Cache-Control':'private, no-store'}},
    '@/lib/admin/order-data':{ORDER_COLUMNS:'id,type,email,created_at',addTracking:async rows=>({orders:rows,warning})},
    '@/lib/admin/orders':orders,
  });
  return {...db,get:queryString=>route.GET({nextUrl:new URL(`https://example.test/api/admin/orders?${queryString}`)})};
}
test('order search preserves apostrophes and literal payment ID underscores',async()=>{
  for(const search of ["It's a boy",'pi_test_1']) {
    const h=listHandler();const res=await h.get(new URLSearchParams({q:search,page:'2'}));
    assert.equal(res.status,200);
    const filter=h.calls.find(([method])=>method==='or')[1];
    assert.ok(filter.includes(search.replaceAll('_','\\_')));
    assert.deepEqual(h.calls.find(([method])=>method==='range'),['range',25,49]);
  }
});
test('orders API surfaces outages instead of claiming there are zero orders',async()=>{
  assert.equal((await listHandler({error:{message:'database offline'}}).get('')).status,503);
  const h=listHandler({warning:'Tracking unavailable'});const res=await h.get('');const result=await res.json();
  assert.equal(result.orders.length,1);assert.equal(result.warning,'Tracking unavailable');
  assert.equal(res.headers.get('cache-control'),'private, no-store');
});
test('orders API rejects unsigned users and invalid date filters',async()=>{
  const h=listHandler({admin:false});assert.equal((await h.get('')).status,403);assert.equal(h.calls.length,0);
  assert.equal((await listHandler().get('from=invalid-date')).status,400);
});
