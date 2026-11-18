'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Copy, Mail, RefreshCw, X } from 'lucide-react';
import { money, orderDate, statusLabel, type Order, type OrderDetail } from '@/lib/admin/orders';
import { type AdminApi, useAdminQuery } from './useAdminApi';

type OrderList = { orders: Order[]; total: number; page: number; pageSize: number; warning?: string };
export function EmailBadge({status}:{status:string}) {
  const tone = ['delivered','opened','clicked'].includes(status) ? 'good' : ['bounced','failed','complained'].includes(status) ? 'bad' : ['no_send_record','delivery_delayed'].includes(status) ? 'warn' : '';
  return <span className={`admin-badge admin-badge-${tone}`}>{statusLabel(status)}</span>;
}
function OrderDialog({id,api,onClose,onChange}:{id:string;api:AdminApi;onClose:()=>void;onChange:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const {data,error,loading,reload} = useAdminQuery<OrderDetail>(api,`/api/admin/orders/${encodeURIComponent(id)}`);
  const [busy,setBusy] = useState(''); const [message,setMessage] = useState('');
  const [actionError,setActionError] = useState(''); const [link,setLink] = useState('');
  const [confirm,setConfirm] = useState(false); const [sent,setSent] = useState(false);
  useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
  async function act(action:'link'|'resend') {
    if (busy) return;
    setBusy(action);setActionError('');setMessage('');
    try {
      const result = await api<{url?:string;message?:string;warning?:string;recipient?:string}>(`/api/admin/orders/${encodeURIComponent(id)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
      if(action==='link' && result.url) {
        setLink(result.url);
        try {await navigator.clipboard.writeText(result.url);setMessage('Download link copied. It expires in seven days.');}
        catch {setMessage('Your link is ready. Select and copy it below.');}
      } else {setMessage(`${result.message} ${result.warning??''}`.trim());setSent(true);setConfirm(false);reload();onChange();}
    } catch(e) {setActionError(e instanceof Error?e.message:'The action failed. Please retry.');}
    finally {setBusy('');}
  }
  return <dialog ref={dialog} className="admin-dialog" aria-labelledby="order-dialog-title" onCancel={onClose}>
    <div className="admin-dialog-header"><h2 id="order-dialog-title">Order details</h2><button className="admin-btn" aria-label="Close order details" onClick={onClose}><X size={16}/></button></div>
    <div className="admin-dialog-content">
      {loading&&<div className="admin-loading" role="status">Checking payment and delivery…</div>}
      {error&&<div className="admin-banner admin-banner-error" role="alert">{error} <button className="admin-text-btn" onClick={reload}>Retry</button></div>}
      {data&&<>
        {data.warnings.map(w=><div className="admin-banner" key={w}>{w}</div>)}
        <div className="admin-detail-grid">
          <div className="admin-detail-stat"><p>Payment · Stripe</p><strong>{statusLabel(data.payment)}</strong></div>
          <div className="admin-detail-stat"><p>Latest email</p><EmailBadge status={data.emailStatus}/></div>
          <div className="admin-detail-stat"><p>Edits remaining</p><strong>{data.order.type==='draft'?'Not purchased':data.order.edits_remaining??'Unavailable'}</strong></div>
        </div>
        <dl className="admin-detail-list"><dt>Customer</dt><dd>{data.order.email}</dd><dt>Template</dt><dd>{data.order.template_name||data.order.template_id}</dd><dt>Placed</dt><dd>{orderDate(data.order.created_at)} · New York time</dd><dt>Amount received</dt><dd>{money(data.amount,data.currency)}{data.refunded>0&&` · ${money(data.refunded,data.currency)} refunded`}</dd><dt>Order ID</dt><dd>{data.order.id}</dd>{data.emailSentAt&&<><dt>Latest email sent</dt><dd>{orderDate(data.emailSentAt)}</dd></>}{data.order.payment_intent_id&&<><dt>Payment ID</dt><dd>{data.order.payment_intent_id}</dd></>}</dl>
        <div className="admin-inline-actions">{data.stripeUrl&&<a href={data.stripeUrl} target="_blank" rel="noreferrer" className="admin-btn">Open in Stripe <ArrowUpRight size={14}/></a>}<button className="admin-btn" disabled={!!busy} onClick={reload}><RefreshCw size={14}/>Refresh status</button></div>
        {data.emailStatus==='claim_recorded'&&<p className="admin-muted" style={{marginTop:12}}>This older order has a send claim, but no provider message ID. Delivery cannot be confirmed from that record.</p>}
        <div className="admin-support-box"><strong>Download support</strong><p>{data.canRecover?'Create a fresh seven-day link using the saved invitation details. The existing edit allowance stays the same. The email contains a link, not file attachments.':data.recoveryReason}</p>
          <div className="admin-inline-actions"><button className="admin-btn" disabled={!data.canRecover||!!busy} onClick={()=>act('link')}><Copy size={14}/>{busy==='link'?'Creating link…':'Copy download link'}</button><button className="admin-btn admin-btn-primary" disabled={!data.canRecover||!data.recipient||!!busy||sent} onClick={()=>setConfirm(true)}><Mail size={14}/>{sent?'Email accepted':'Resend download email'}</button></div>
          {confirm&&<div className="admin-banner" style={{marginTop:16,marginBottom:0}}><p>Send a fresh download link to <strong>{data.recipient}</strong>?</p><div className="admin-inline-actions"><button className="admin-btn admin-btn-primary" disabled={!!busy} onClick={()=>act('resend')}>{busy==='resend'?'Sending…':'Send email'}</button><button className="admin-btn" disabled={!!busy} onClick={()=>setConfirm(false)}>Cancel</button></div></div>}
          {link&&<label className="admin-muted" style={{display:'block',marginTop:12}}>Private customer download link<input className="admin-input admin-link-output" aria-label="Private customer download link" readOnly value={link} onFocus={e=>e.target.select()}/></label>}
        </div>
        <details style={{marginTop:24}}><summary style={{cursor:'pointer',fontWeight:600}}>Saved invitation details</summary>{Object.keys(data.order.field_values??{}).length?<div className="admin-fields">{Object.entries(data.order.field_values??{}).map(([key,value])=><div className="admin-field" key={key}><small>{key}</small><span dir="auto">{value||'Empty'}</span></div>)}</div>:<p className="admin-muted" style={{marginTop:12}}>No saved fields available.</p>}</details>
      </>}
      {message&&<div role="status" className="admin-banner admin-banner-success" style={{marginTop:18}}>{message}</div>}
      {actionError&&<div role="alert" className="admin-banner admin-banner-error" style={{marginTop:18}}>{actionError}</div>}
    </div>
  </dialog>;
}
export default function AdminOrders({api,initialOrder=null}:{api:AdminApi;initialOrder?:string|null}) {
  const [search,setSearch]=useState('');const [query,setQuery]=useState('');const [type,setType]=useState('');
  const [period,setPeriod]=useState('');const [periodDays,setPeriodDays]=useState('');const [page,setPage]=useState(1);const [selected,setSelected]=useState(initialOrder);
  useEffect(()=>{const timer=setTimeout(()=>{setQuery(search);setPage(1);},300);return()=>clearTimeout(timer);},[search]);
  const params=new URLSearchParams({page:String(page),q:query,type});if(period)params.set('from',period);
  const {data,error,loading,reload}=useAdminQuery<OrderList>(api,`/api/admin/orders?${params}`);
  const pages=Math.max(1,Math.ceil((data?.total??0)/(data?.pageSize??25)));
  return <main className="admin-page">
    <header className="admin-page-header"><div><p className="admin-kicker">Customer support</p><h1>Orders</h1><p className="admin-subtitle">Find purchases, check delivery, and help customers download.</p></div><button className="admin-btn" onClick={reload} disabled={loading}><RefreshCw size={14}/>Refresh</button></header>
    {data?.warning&&<div className="admin-banner">{data.warning}</div>}
    <section className="admin-panel" aria-label="Orders list">
      <div className="admin-filters"><label className="admin-search">Search orders<input type="search" className="admin-input" placeholder="Email, template, or payment ID" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Order type<select className="admin-input" value={type} onChange={e=>{setType(e.target.value);setPage(1);}}><option value="">All orders</option><option value="purchase">Purchases</option><option value="draft">Saved drafts</option></select></label><label>Date range<select className="admin-input" value={periodDays} onChange={e=>{setPeriodDays(e.target.value);setPeriod(e.target.value?new Date(Date.now()-Number(e.target.value)*86400000).toISOString():'');setPage(1);}}><option value="">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label></div>
      {loading?<div className="admin-loading" role="status">Loading orders…</div>:error?<div className="admin-empty" role="alert"><strong>Orders could not be loaded</strong><p>{error}</p><button className="admin-btn" onClick={reload} style={{marginTop:16}}>Retry</button></div>:!data?.orders.length?<div className="admin-empty"><strong>No orders found</strong><p>Try another search or a wider date range.</p></div>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Template</th><th>Amount</th><th>Email record</th><th>Placed</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.orders.map(order=><tr key={order.id}><td><div className="admin-customer">{order.email}</div><div className="admin-cell-note">{order.type==='purchase'?'Purchase recorded':'Saved draft'}</div></td><td>{order.template_name||order.template_id}</td><td><strong>{order.type==='purchase'?money(order.amount_cents??0):'—'}</strong></td><td><EmailBadge status={order.type==='draft'?'untracked':order.email_claimed===true?'claim_recorded':order.email_claimed===false?'no_send_record':'unknown'}/></td><td>{orderDate(order.created_at)}</td><td><button className="admin-btn" onClick={()=>setSelected(order.id)} aria-label={`View order for ${order.email}`}>Details</button></td></tr>)}</tbody></table></div>}
      {data&&<div className="admin-pagination"><span>{data.total.toLocaleString()} {data.total===1?'order':'orders'} · New York time</span><div className="admin-inline-actions"><button className="admin-btn" disabled={page<=1||loading} onClick={()=>setPage(p=>p-1)}>Previous</button><span style={{alignSelf:'center'}}>Page {page} of {pages}</span><button className="admin-btn" disabled={page>=pages||loading} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>}
    </section><p className="admin-muted" style={{marginTop:14}}>Open an order to verify its payment with Stripe and check the latest available email delivery event.</p>
    {selected&&<OrderDialog key={selected} id={selected} api={api} onClose={()=>setSelected(null)} onChange={reload}/>}
  </main>;
}
