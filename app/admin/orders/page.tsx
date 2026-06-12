'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

type Order = {
  id: string;
  type: 'purchase' | 'draft';
  email: string;
  template_id: string;
  template_name: string | null;
  field_values: Record<string, string> | null;
  payment_intent_id: string | null;
  amount_cents: number | null;
  created_at: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function templateLabel(order: Order) {
  return order.template_name || order.template_id;
}

export default function OrdersPage() {
  const { user, loading, accessToken } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'purchase' | 'draft'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.email !== ADMIN_EMAIL) { router.replace('/'); return; }

    fetch('/api/admin/orders', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => { setOrders(Array.isArray(data) ? data : []); setDataLoading(false); })
      .catch(() => setDataLoading(false));
  }, [loading, user, accessToken, router]);

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return o.email.toLowerCase().includes(q) || o.template_id.toLowerCase().includes(q) || (o.template_name ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const purchases = orders.filter(o => o.type === 'purchase').length;
  const drafts = orders.filter(o => o.type === 'draft').length;
  const revenue = orders.filter(o => o.type === 'purchase' && o.amount_cents).reduce((s, o) => s + (o.amount_cents ?? 0), 0);

  const chartData = (() => {
    const days: { date: string; revenue: number; sales: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), revenue: 0, sales: 0 });
      const dayOrders = orders.filter(o => o.type === 'purchase' && o.created_at.slice(0, 10) === key);
      days[days.length - 1].revenue = dayOrders.reduce((s, o) => s + (o.amount_cents ?? 0), 0) / 100;
      days[days.length - 1].sales = dayOrders.length;
    }
    return days;
  })();

  if (loading || dataLoading) {
    return <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Loading…</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#94a3b8', fontSize: 13, padding: '6px 14px', cursor: 'pointer' }}>← Admin</button>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Orders & Drafts</h1>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Purchases', value: purchases, color: '#4ade80' },
          { label: 'Save for Later', value: drafts, color: '#60a5fa' },
          { label: 'Revenue', value: `$${(revenue / 100).toFixed(2)}`, color: '#fbbf24' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px 24px', minWidth: 140 }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 24px', marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 16 }}>Revenue — Last 30 Days</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
            <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(value, name) => [name === 'revenue' ? `$${Number(value).toFixed(2)}` : value, name === 'revenue' ? 'Revenue' : 'Sales']}
            />
            <Bar dataKey="revenue" fill="#fbbf24" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by email or template…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#e2e8f0', fontSize: 13, padding: '8px 14px', outline: 'none' }}
        />
        {(['all', 'purchase', 'draft'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', fontSize: 13, cursor: 'pointer', background: filter === f ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)', color: filter === f ? '#fff' : '#64748b', textTransform: 'capitalize' }}>
            {f === 'all' ? 'All' : f === 'purchase' ? '💳 Purchases' : '📋 Drafts'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 90px 110px', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '10px 20px', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <span>Type</span><span>Email</span><span>Template</span><span>Amount</span><span>Date</span>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: 14 }}>No records found</div>
        )}

        {filtered.map(order => (
          <div key={order.id}>
            <div
              onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 90px 110px', gap: 0, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.1s', background: expanded === order.id ? 'rgba(255,255,255,0.04)' : 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = expanded === order.id ? 'rgba(255,255,255,0.04)' : 'transparent')}
            >
              <span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: order.type === 'purchase' ? 'rgba(74,222,128,0.15)' : 'rgba(96,165,250,0.15)', color: order.type === 'purchase' ? '#4ade80' : '#60a5fa' }}>
                  {order.type === 'purchase' ? '💳 Purchase' : '📋 Draft'}
                </span>
              </span>
              <span style={{ fontSize: 13, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.email}</span>
              <span style={{ fontSize: 13, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{templateLabel(order)}</span>
              <span style={{ fontSize: 13, color: order.amount_cents ? '#fbbf24' : '#475569' }}>
                {order.amount_cents ? `$${(order.amount_cents / 100).toFixed(2)}` : '—'}
              </span>
              <span style={{ fontSize: 12, color: '#475569' }}>{formatDate(order.created_at)}</span>
            </div>

            {/* Expanded field values */}
            {expanded === order.id && (
              <div style={{ padding: '14px 20px 18px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Field Values</div>
                {order.field_values && Object.keys(order.field_values).length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {Object.entries(order.field_values).map(([k, v]) => (
                      <div key={k} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '5px 10px', fontSize: 12 }}>
                        <span style={{ color: '#64748b' }}>{k}: </span>
                        <span style={{ color: '#cbd5e1' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: '#475569' }}>No field data saved</span>
                )}
                {order.payment_intent_id && (
                  <div style={{ marginTop: 10, fontSize: 11, color: '#475569' }}>
                    PI: <span style={{ fontFamily: 'monospace', color: '#64748b' }}>{order.payment_intent_id}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: '#334155' }}>{filtered.length} of {orders.length} records</div>
    </div>
  );
}
