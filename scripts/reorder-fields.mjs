#!/usr/bin/env node
/**
 * reorder-fields.mjs
 *
 * GUI tool for managing SVG template fields across folders.
 *
 * Features:
 *   - Drag to reorder fields (applied to all SVGs in folder)
 *   - Click REQ/OPT badge to toggle required state (applied to all SVGs in folder)
 *   - Overview tab: see all categories at a glance, click badges to toggle instantly
 *
 * Usage:
 *   node scripts/reorder-fields.mjs
 *   Then open http://localhost:3333
 */

import { createServer } from 'http';
import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join } from 'path';

const PORT = 3333;
const TEMPLATES_DIR = 'public/templates';

// ── SVG utilities ─────────────────────────────────────────────────────────────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatchingClose(svg, start) {
  let depth = 0, i = start;
  while (i < svg.length) {
    const open  = svg.indexOf('<g', i);
    const close = svg.indexOf('</g>', i);
    if (close === -1) return -1;
    if (open !== -1 && open < close) {
      const c = svg[open + 2];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '>') depth++;
      i = open + 2;
    } else {
      if (--depth === 0) return close + 4;
      i = close + 4;
    }
  }
  return -1;
}

function extractFieldBlocks(svg) {
  const blocks = [];
  const re = /<g\b[^>]*\bid="([A-Za-z][^"]*)"/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    const fullId = m[1];
    const start  = m.index;
    const end    = findMatchingClose(svg, start);
    if (end === -1) continue;
    const content = svg.slice(start, end);
    const tspan   = content.match(/<tspan[^>]*>([^<]+)</);
    blocks.push({
      fullId,
      id:          fullId.replace(/\*$/, ''),
      required:    fullId.endsWith('*'),
      placeholder: tspan ? tspan[1].trim() : '',
      start, end, content,
    });
  }
  return blocks;
}

function applyNewOrder(svg, newOrderFullIds) {
  const blocks = extractFieldBlocks(svg);
  if (!blocks.length) return svg;
  const contentMap = Object.fromEntries(blocks.map(b => [b.fullId, b.content]));
  const inOrder      = new Set(newOrderFullIds.filter(id => id in contentMap));
  const orderedBlocks = blocks.filter(b => inOrder.has(b.fullId));
  const filteredOrder = newOrderFullIds.filter(id => id in contentMap);
  if (orderedBlocks.length !== filteredOrder.length) return svg;
  const replacements = orderedBlocks
    .map((b, i) => ({ start: b.start, end: b.end, newContent: contentMap[filteredOrder[i]] }))
    .sort((a, b) => b.start - a.start);
  let result = svg;
  for (const { start, end, newContent } of replacements) {
    result = result.slice(0, start) + newContent + result.slice(end);
  }
  return result;
}

// Apply required toggles + reorder in one pass
function applyFieldChanges(svg, fields) {
  // fields: [{ id, required }, ...] in desired order
  let result = svg;

  // Step 1: apply required changes (add/remove * from g id)
  for (const { id, required } of fields) {
    const e = escapeRegex(id);
    if (required) {
      // id="X" → id="X*"  (only if not already starred)
      result = result.replace(new RegExp(`\\bid="${e}"`, 'g'), `id="${id}*"`);
    } else {
      // id="X*" → id="X"
      result = result.replace(new RegExp(`\\bid="${e}\\*"`, 'g'), `id="${id}"`);
    }
  }

  // Step 2: reorder using the now-updated fullIds
  const desiredFullIds = fields.map(f => f.required ? `${f.id}*` : f.id);
  result = applyNewOrder(result, desiredFullIds);

  return result;
}

// ── Folder discovery ──────────────────────────────────────────────────────────

async function getSvgFolders() {
  const folders = [];
  async function scan(dir, depth = 0) {
    if (depth > 2) return;
    let entries;
    try { entries = await readdir(dir); } catch { return; }
    const hasSvg = entries.some(f => f.toLowerCase().endsWith('.svg') && !f.startsWith('_'));
    if (hasSvg) { folders.push(dir); return; }
    for (const e of entries) {
      try {
        const s = await stat(join(dir, e));
        if (s.isDirectory()) await scan(join(dir, e), depth + 1);
      } catch {}
    }
  }
  await scan(TEMPLATES_DIR);
  return folders.sort();
}

async function getFieldsForFolder(folderPath) {
  const entries = await readdir(folderPath);
  const svgFile = entries.find(f => f.toLowerCase().endsWith('.svg') && !f.startsWith('_'));
  if (!svgFile) return [];
  const svg = await readFile(join(folderPath, svgFile), 'utf-8');
  return extractFieldBlocks(svg).map(({ fullId, id, required, placeholder }) =>
    ({ fullId, id, required, placeholder }));
}

async function getOverview() {
  const folders = await getSvgFolders();
  const result = [];
  for (const folder of folders) {
    const fields = await getFieldsForFolder(folder);
    const parts  = folder.replace(TEMPLATES_DIR + '/', '').split('/');
    result.push({ folder, category: parts[0], name: parts[parts.length - 1], fields });
  }
  return result;
}

// ── HTML ──────────────────────────────────────────────────────────────────────

const HTML = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Field Manager — Share Your Simcha</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#f8f9fa;color:#1e293b;display:flex;height:100vh;overflow:hidden}

/* Sidebar */
#sidebar{width:240px;background:white;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;flex-shrink:0}
#sidebar-header{padding:12px 16px;border-bottom:1px solid #f1f5f9;flex-shrink:0;display:flex;flex-direction:column;gap:8px}
#sidebar-header h2{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8}
.tab-bar{display:flex;gap:4px}
.tab{padding:5px 10px;font-size:12px;font-weight:600;border-radius:6px;cursor:pointer;border:none;background:transparent;color:#64748b;transition:.12s}
.tab.active{background:#eff6ff;color:#1d4ed8}
#folder-list{overflow-y:auto;flex:1}
.folder-item{padding:8px 16px;font-size:13px;cursor:pointer;border-left:3px solid transparent;transition:.12s}
.folder-item:hover{background:#f8fafc}
.folder-item.active{background:#eff6ff;border-left-color:#3b82f6;color:#1d4ed8;font-weight:600}
.folder-cat{font-size:11px;color:#94a3b8;margin-top:1px}

/* Main */
#main{flex:1;display:flex;flex-direction:column;overflow:hidden}
#toolbar{padding:12px 24px;background:white;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;flex-shrink:0}
#toolbar h1{font-size:16px;font-weight:700;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#status{font-size:13px;color:#64748b;white-space:nowrap}
#save-btn{padding:7px 20px;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:.12s;flex-shrink:0}
#save-btn:hover:not(:disabled){background:#2563eb}
#save-btn:disabled{background:#cbd5e1;cursor:not-allowed}

#content{flex:1;overflow-y:auto;padding:24px}
#empty{display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:15px}

/* Field editor */
#field-list{max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:8px}
.field-item{background:white;border:1.5px solid #e2e8f0;border-radius:12px;padding:11px 14px;display:flex;align-items:center;gap:10px;cursor:grab;transition:.15s;user-select:none}
.field-item:active{cursor:grabbing}
.field-item:hover{border-color:#cbd5e1;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.field-item.dragging{opacity:.35;border-style:dashed}
.field-item.over{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
.drag-handle{color:#cbd5e1;flex-shrink:0}
.field-id{font-size:13px;font-weight:600;font-family:monospace;flex:1}
.field-preview{font-size:12px;color:#94a3b8;direction:rtl;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}

/* Badges — clickable */
.badge{font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;flex-shrink:0;letter-spacing:.04em;cursor:pointer;border:none;transition:.12s}
.badge:hover{opacity:.8}
.badge.req{background:#dbeafe;color:#1d4ed8}
.badge.opt{background:#f1f5f9;color:#64748b}

/* Overview */
#overview{display:flex;flex-direction:column;gap:0}
.ov-category{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;padding:20px 0 8px}
.ov-row{background:white;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;display:flex;align-items:flex-start;gap:14px;margin-bottom:8px}
.ov-name{font-size:13px;font-weight:600;color:#374151;width:120px;flex-shrink:0;padding-top:2px}
.ov-fields{display:flex;flex-wrap:wrap;gap:5px;flex:1}
.ov-badge{font-size:11px;font-weight:600;padding:3px 8px;border-radius:99px;cursor:pointer;border:none;transition:.12s;display:flex;align-items:center;gap:4px}
.ov-badge:hover{opacity:.75}
.ov-badge.req{background:#dbeafe;color:#1d4ed8}
.ov-badge.opt{background:#f1f5f9;color:#64748b}
.ov-badge .ov-id{font-family:monospace;font-size:10px}
.ov-saving{opacity:.5;pointer-events:none}
</style>
</head>
<body>

<div id="sidebar">
  <div id="sidebar-header">
    <h2>Share Your Simcha Fields</h2>
    <div class="tab-bar">
      <button class="tab active" onclick="showTab('editor')">Editor</button>
      <button class="tab" onclick="showTab('overview')">Overview</button>
    </div>
  </div>
  <div id="folder-list"><div style="padding:16px;color:#94a3b8;font-size:13px">Loading…</div></div>
</div>

<div id="main">
  <div id="toolbar">
    <h1 id="folder-title">Field Manager</h1>
    <span id="status"></span>
    <button id="save-btn" disabled>Save changes</button>
  </div>
  <div id="content">
    <div id="empty">← Select a folder to manage its fields</div>
    <div id="field-list" style="display:none"></div>
    <div id="overview" style="display:none"></div>
  </div>
</div>

<script>
let dragSrc    = null;
let dirty      = false;
let activeTab  = 'editor';
let allFolders = [];

// ── Tabs ──────────────────────────────────────────────────────────────────
function showTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.textContent.toLowerCase() === tab));
  if (tab === 'editor') {
    document.getElementById('overview').style.display = 'none';
    document.getElementById('folder-title').textContent = 'Field Manager';
    document.getElementById('save-btn').style.display = '';
    setStatus('');
    setSaveEnabled(false);
    dirty = false;
    showEmpty('← Select a folder to manage its fields');
  } else {
    document.getElementById('field-list').style.display  = 'none';
    document.getElementById('save-btn').style.display    = 'none';
    showEmpty('');
    loadOverview();
  }
}

// ── Load folders ──────────────────────────────────────────────────────────
fetch('/api/folders').then(r=>r.json()).then(folders=>{
  allFolders = folders;
  const el = document.getElementById('folder-list');
  el.innerHTML = '';
  folders.forEach(f=>{
    const parts = f.replace('public/templates/','').split('/');
    const d = document.createElement('div');
    d.className = 'folder-item';
    d.innerHTML = '<div>'+escHtml(parts[parts.length-1])+'</div>'
      +(parts.length>1?'<div class="folder-cat">'+escHtml(parts[0])+'</div>':'');
    d.onclick = ()=>{ if(activeTab!=='editor') showTab('editor'); loadFolder(f,d); };
    el.appendChild(d);
  });
});

// ── Editor: load folder ───────────────────────────────────────────────────
function loadFolder(path, el){
  document.querySelectorAll('.folder-item').forEach(e=>e.classList.remove('active'));
  el.classList.add('active');
  setStatus('');
  setSaveEnabled(false);
  dirty = false;
  document.getElementById('folder-title').textContent = path.split('/').pop();
  fetch('/api/fields?folder='+encodeURIComponent(path)).then(r=>r.json()).then(fields=>{
    renderEditor(fields, path);
  });
}

// ── Editor: render ────────────────────────────────────────────────────────
function renderEditor(fields, folderPath){
  const list  = document.getElementById('field-list');
  const empty = document.getElementById('empty');
  if(!fields.length){
    showEmpty('No editable fields found in this folder.');
    return;
  }
  empty.style.display = 'none';
  list.style.display  = 'flex';
  list.innerHTML = '';

  fields.forEach(f=>{
    const div = document.createElement('div');
    div.className      = 'field-item';
    div.draggable      = true;
    div.dataset.id     = f.id;
    div.dataset.req    = f.required ? '1' : '0';
    div.dataset.folder = folderPath;

    const badge = document.createElement('button');
    badge.className = 'badge ' + (f.required ? 'req' : 'opt');
    badge.textContent = f.required ? 'required' : 'optional';
    badge.title = 'Click to toggle';
    badge.onclick = (e)=>{
      e.stopPropagation();
      const isReq = div.dataset.req === '1';
      div.dataset.req = isReq ? '0' : '1';
      badge.className   = 'badge ' + (!isReq ? 'req' : 'opt');
      badge.textContent = !isReq ? 'required' : 'optional';
      div.dataset.id    = f.id; // keep base id (no *)
      markDirty();
    };

    div.innerHTML = \`
      <svg class="drag-handle" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <rect x="3" y="2" width="10" height="2" rx="1"/>
        <rect x="3" y="7" width="10" height="2" rx="1"/>
        <rect x="3" y="12" width="10" height="2" rx="1"/>
      </svg>
    \`;
    div.appendChild(badge);

    const idSpan = document.createElement('span');
    idSpan.className = 'field-id';
    idSpan.textContent = f.id;
    div.appendChild(idSpan);

    const prev = document.createElement('span');
    prev.className = 'field-preview';
    prev.textContent = f.placeholder;
    div.appendChild(prev);

    div.addEventListener('dragstart', e=>{ dragSrc=div; requestAnimationFrame(()=>div.classList.add('dragging')); e.dataTransfer.effectAllowed='move'; });
    div.addEventListener('dragend', ()=>{ div.classList.remove('dragging'); list.querySelectorAll('.field-item').forEach(el=>el.classList.remove('over')); });
    div.addEventListener('dragover', e=>{ e.preventDefault(); if(dragSrc===div) return; list.querySelectorAll('.field-item').forEach(el=>el.classList.remove('over')); div.classList.add('over'); });
    div.addEventListener('dragleave', ()=>div.classList.remove('over'));
    div.addEventListener('drop', e=>{ e.preventDefault(); div.classList.remove('over'); if(!dragSrc||dragSrc===div) return; const items=[...list.querySelectorAll('.field-item')]; const si=items.indexOf(dragSrc),di=items.indexOf(div); list.insertBefore(dragSrc, si<di?div.nextSibling:div); markDirty(); });

    list.appendChild(div);
  });
}

function markDirty(){ dirty=true; setStatus('Unsaved changes'); setSaveEnabled(true); }

// ── Editor: save ──────────────────────────────────────────────────────────
document.getElementById('save-btn').onclick = async ()=>{
  const items  = [...document.querySelectorAll('.field-item')];
  const folder = items[0]?.dataset.folder;
  if(!folder) return;
  const fields = items.map(el=>({ id: el.dataset.id, required: el.dataset.req==='1' }));

  setSaveEnabled(false);
  document.getElementById('save-btn').textContent = 'Saving…';
  const res  = await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({folder,fields})});
  const data = await res.json();
  document.getElementById('save-btn').textContent = 'Save changes';
  if(data.ok){ dirty=false; setStatus('✓ Saved to '+data.count+' file'+(data.count===1?'':'s')); }
  else { setSaveEnabled(true); setStatus('✗ '+data.error); }
};

// ── Overview ──────────────────────────────────────────────────────────────
async function loadOverview(){
  const ov = document.getElementById('overview');
  ov.innerHTML = '<div style="color:#94a3b8;padding:8px 0">Loading…</div>';
  ov.style.display = 'flex';
  ov.style.flexDirection = 'column';

  const data = await fetch('/api/overview').then(r=>r.json());

  // Group by category
  const cats = {};
  for (const row of data) {
    if(!cats[row.category]) cats[row.category] = [];
    cats[row.category].push(row);
  }

  ov.innerHTML = '';
  document.getElementById('folder-title').textContent = 'Overview — All Categories';

  for (const [cat, rows] of Object.entries(cats)) {
    const catLabel = document.createElement('div');
    catLabel.className = 'ov-category';
    catLabel.textContent = cat;
    ov.appendChild(catLabel);

    for (const row of rows) {
      const r = document.createElement('div');
      r.className = 'ov-row';

      const name = document.createElement('div');
      name.className = 'ov-name';
      name.textContent = row.name;
      r.appendChild(name);

      const fields = document.createElement('div');
      fields.className = 'ov-fields';

      for (const f of row.fields) {
        const b = document.createElement('button');
        b.className = 'ov-badge ' + (f.required ? 'req' : 'opt');
        b.innerHTML = \`<span class="ov-id">\${escHtml(f.id)}</span>\`;
        b.title = (f.required ? 'required' : 'optional') + ' — click to toggle';
        b.dataset.folder   = row.folder;
        b.dataset.id       = f.id;
        b.dataset.required = f.required ? '1' : '0';

        b.onclick = async ()=>{
          const wasReq = b.dataset.required === '1';
          const nowReq = !wasReq;
          b.classList.add('ov-saving');

          const res  = await fetch('/api/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({folder:b.dataset.folder,id:b.dataset.id,required:nowReq})});
          const data = await res.json();
          b.classList.remove('ov-saving');

          if(data.ok){
            b.dataset.required = nowReq ? '1' : '0';
            b.className = 'ov-badge ' + (nowReq ? 'req' : 'opt');
            b.title = (nowReq ? 'required' : 'optional') + ' — click to toggle';
            setStatus('✓ '+escHtml(f.id)+' → '+(nowReq?'required':'optional')+' in '+row.name);
          } else {
            setStatus('✗ '+data.error);
          }
        };
        fields.appendChild(b);
      }

      r.appendChild(fields);
      ov.appendChild(r);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function showEmpty(msg){ const e=document.getElementById('empty'); e.textContent=msg; e.style.display=msg?'flex':'none'; document.getElementById('field-list').style.display='none'; }
function setStatus(msg){ document.getElementById('status').textContent = msg; }
function setSaveEnabled(on){ document.getElementById('save-btn').disabled = !on; }
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

window.addEventListener('beforeunload', e=>{ if(dirty){ e.preventDefault(); e.returnValue=''; } });
</script>
</body>
</html>`;

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);

  try {
    if (url.pathname === '/api/folders') {
      return json(res, await getSvgFolders());
    }

    if (url.pathname === '/api/fields') {
      const folder = url.searchParams.get('folder');
      if (!folder) return json(res, []);
      return json(res, await getFieldsForFolder(folder));
    }

    if (url.pathname === '/api/overview') {
      return json(res, await getOverview());
    }

    // POST /api/save  { folder, fields: [{ id, required }] }
    if (url.pathname === '/api/save' && req.method === 'POST') {
      const { folder, fields } = JSON.parse(await readBody(req));
      const entries  = await readdir(folder);
      const svgFiles = entries.filter(f => f.toLowerCase().endsWith('.svg') && !f.startsWith('_'));
      let count = 0;
      for (const file of svgFiles) {
        const filePath = join(folder, file);
        const svg      = await readFile(filePath, 'utf-8');
        const newSvg   = applyFieldChanges(svg, fields);
        if (newSvg !== svg) { await writeFile(filePath, newSvg); count++; }
      }
      return json(res, { ok: true, count });
    }

    // POST /api/toggle  { folder, id, required }  — toggle one field in all SVGs
    if (url.pathname === '/api/toggle' && req.method === 'POST') {
      const { folder, id, required } = JSON.parse(await readBody(req));
      const entries  = await readdir(folder);
      const svgFiles = entries.filter(f => f.toLowerCase().endsWith('.svg') && !f.startsWith('_'));
      const e = escapeRegex(id);
      let count = 0;
      for (const file of svgFiles) {
        const filePath = join(folder, file);
        let svg = await readFile(filePath, 'utf-8');
        const newSvg = required
          ? svg.replace(new RegExp(`\\bid="${e}"`, 'g'), `id="${id}*"`)
          : svg.replace(new RegExp(`\\bid="${e}\\*"`, 'g'), `id="${id}"`);
        if (newSvg !== svg) { await writeFile(filePath, newSvg); count++; }
      }
      return json(res, { ok: true, count });
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);

  } catch (e) {
    json(res, { ok: false, error: e.message }, 500);
  }
});

function json(res, data, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => s += c);
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
}

server.listen(PORT, () => {
  console.log(`\n  Field Manager — Share Your Simcha`);
  console.log(`  ────────────────────────`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`\n  Ctrl+C to stop\n`);
});
