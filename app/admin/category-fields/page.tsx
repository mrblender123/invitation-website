'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type FieldRow = {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
  inTemplates: number;
  templateCount: number;
};

const FOLDERS = [
  "It's a girl",
  "It's a boy/Bris",
  "It's a boy/Pidyon Haben",
  "It's a boy/Shlishi L'milah",
  "It's a boy/Shulem Zucher",
  "It's a boy/Vach Nacht",
  "It's a boy/Vachnacht-Bris",
  "Bar mitzva/Bar Mitzvah",
  "Bavarfen/Chusen invite",
  "Bavarfen/Father",
  "Bavarfen/Schedule",
  "Sheva Brachos",
  "Tenoyim/Chusen Invite",
  "Tenoyim/Chusen side",
  "Tenoyim/English",
  "Upsherin",
  "wedding/Chusen ",
  "wedding/Invitation",
];

export default function CategoryFieldsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [folder, setFolder] = useState(FOLDERS[0]);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // drag state
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, []);

  const loadFolder = useCallback(async (f: string, tok: string) => {
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/category-fields?folder=${encodeURIComponent(f)}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFields(data.fields ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) loadFolder(folder, token);
  }, [folder, token, loadFolder]);

  const toggleRequired = (idx: number) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, required: !f.required } : f));
    setSaved(false);
  };

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/category-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          folder,
          fields: fields.map((f, i) => ({ id: f.id, required: f.required, order: i })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── drag-and-drop (mouse) ─────────────────────────────────────────────────
  const onDragStart = (e: React.DragEvent, idx: number) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOver(idx);
  };
  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === idx) { setDragOver(null); return; }
    setFields(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragIdx.current = null;
    setDragOver(null);
    setSaved(false);
  };
  const onDragEnd = () => { dragIdx.current = null; setDragOver(null); };

  return (
    <div style={{ minHeight: '100vh', background: '#f7f6f2', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <a href="/admin/template-editor" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← Admin</a>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Category Field Settings</h1>
        </div>

        {/* Folder selector */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Category / Folder</label>
          <select
            value={folder}
            onChange={e => setFolder(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, background: '#fff' }}
          >
            {FOLDERS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {loading && <div style={{ color: '#888', fontSize: 14 }}>Loading fields…</div>}
        {error && <div style={{ color: '#c00', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {!loading && fields.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
              Drag to reorder · Toggle Required / Optional · Changes apply to all templates in this folder
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {fields.map((field, idx) => (
                <div
                  key={field.id}
                  draggable
                  onDragStart={e => onDragStart(e, idx)}
                  onDragOver={e => onDragOver(e, idx)}
                  onDrop={e => onDrop(e, idx)}
                  onDragEnd={onDragEnd}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: dragOver === idx ? '#e8f0fe' : '#fff',
                    border: `1px solid ${dragOver === idx ? '#4a90e2' : '#e0ddd5'}`,
                    borderRadius: 8, padding: '10px 12px',
                    cursor: 'default', transition: 'background 0.1s, border-color 0.1s',
                    opacity: dragIdx.current === idx ? 0.4 : 1,
                  }}
                >
                  {/* drag handle */}
                  <span style={{ cursor: 'grab', color: '#bbb', fontSize: 16, userSelect: 'none', lineHeight: 1 }}>⠿</span>

                  {/* field info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{field.label}</span>
                      {field.placeholder && (
                        <span style={{ fontSize: 12, color: '#888', direction: 'rtl', fontFamily: 'serif' }}>
                          {field.placeholder}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#bbb' }}>
                      {field.id} · {field.inTemplates}/{field.templateCount} templates
                    </div>
                  </div>

                  {/* req/opt toggle */}
                  <button
                    onClick={() => toggleRequired(idx)}
                    style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', border: 'none', flexShrink: 0,
                      background: field.required ? '#1a1a1a' : '#f0ede5',
                      color: field.required ? '#fff' : '#888',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {field.required ? 'Required' : 'Optional'}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: '#1a1a1a', color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {saved && <span style={{ fontSize: 13, color: '#2a7a2a' }}>✓ Saved — changes are live immediately</span>}
            </div>
          </>
        )}

        {!loading && fields.length === 0 && !error && (
          <div style={{ color: '#999', fontSize: 14 }}>No fields found in this folder.</div>
        )}
      </div>
    </div>
  );
}
