'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';

const ADMIN_EMAIL = 'bycheshin@gmail.com';

type Stats = { totalUsers: number; totalInvitations: number; invitationsThisWeek: number };
type AdminUser = { id: string; email: string; created_at: string; invitationCount: number };
type AdminInvitation = { id: string; name: string; event_title: string; host_name: string; date_time: string; created_at: string; user_id: string; user_email: string };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminPage() {
  const { user, loading, accessToken } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) {
      router.replace('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!accessToken || user?.email !== ADMIN_EMAIL) return;

    const headers = { Authorization: `Bearer ${accessToken}` };

    Promise.all([
      fetch('/api/admin/stats', { headers }).then(r => r.json()),
      fetch('/api/admin/users', { headers }).then(r => r.json()),
      fetch('/api/admin/invitations', { headers }).then(r => r.json()),
    ]).then(([s, u, i]) => {
      setStats(s);
      setUsers(u.users ?? []);
      setInvitations(i.invitations ?? []);
      setDataLoading(false);
    });
  }, [accessToken, user]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invitation?')) return;
    setDeletingId(id);
    const res = await fetch('/api/admin/invitations', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setInvitations(prev => prev.filter(i => i.id !== id));
    } else {
      alert('Failed to delete invitation.');
    }
    setDeletingId(null);
  };

  if (loading || !user || user.email !== ADMIN_EMAIL) return null;

  const cardStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '28px 32px',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left' as const,
    padding: '10px 16px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'rgba(255,255,255,0.35)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  };

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#fff', fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-playfair)', fontSize: 18, fontWeight: 700 }}>
            Invitia <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 400, fontFamily: 'var(--font-inter)' }}>/ Admin</span>
          </span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{user.email}</span>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Admin Panel
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 40 }}>
          Full visibility into users and invitations.
        </p>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 48 }}>
          {[
            { label: 'Total Users', value: stats?.totalUsers },
            { label: 'Total Invitations', value: stats?.totalInvitations },
            { label: 'This Week', value: stats?.invitationsThisWeek },
          ].map(({ label, value }) => (
            <div key={label} style={cardStyle}>
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px' }}>{label}</p>
              <p style={{ fontSize: 36, fontWeight: 700, margin: 0, fontFamily: 'var(--font-playfair)' }}>
                {dataLoading ? '—' : (value ?? 0)}
              </p>
            </div>
          ))}
        </div>

        {/* Users Table */}
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Users</h2>
        <div style={{ ...cardStyle, padding: 0, marginBottom: 48, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Joined</th>
                <th style={thStyle}>Invitations</th>
              </tr>
            </thead>
            <tbody>
              {dataLoading ? (
                <tr><td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>No users yet.</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td style={tdStyle}>{u.email}</td>
                  <td style={tdStyle}>{formatDate(u.created_at)}</td>
                  <td style={tdStyle}>{u.invitationCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Invitations Table */}
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>All Invitations</h2>
        <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Event</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {dataLoading ? (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>Loading…</td></tr>
              ) : invitations.length === 0 ? (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>No invitations yet.</td></tr>
              ) : invitations.map(inv => (
                <tr key={inv.id}>
                  <td style={{ ...tdStyle, color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{inv.user_email}</td>
                  <td style={tdStyle}>{inv.name}</td>
                  <td style={tdStyle}>{inv.event_title || '—'}</td>
                  <td style={{ ...tdStyle, color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{formatDate(inv.created_at)}</td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => handleDelete(inv.id)}
                      disabled={deletingId === inv.id}
                      style={{
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 6,
                        color: '#f87171',
                        fontSize: 12,
                        padding: '4px 12px',
                        cursor: 'pointer',
                        opacity: deletingId === inv.id ? 0.5 : 1,
                      }}
                    >
                      {deletingId === inv.id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
