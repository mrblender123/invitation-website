#!/usr/bin/env node
/**
 * reorder-fields.mjs
 *
 * Local GUI for reordering SVG field order across a template folder.
 * Rewrites <g id> block order in all SVGs in the selected folder.
 * Does NOT touch _schema.json — safe for add-template.mjs future runs.
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

function findMatchingClose(svg, start) {
  let depth = 0;
  let i = start;
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

  // Only reorder blocks whose id appears in newOrderFullIds
  const inOrder      = new Set(newOrderFullIds.filter(id => id in contentMap));
  const orderedBlocks = blocks.filter(b => inOrder.has(b.fullId));
  const filteredOrder = newOrderFullIds.filter(id => id in contentMap);

  if (orderedBlocks.length !== filteredOrder.length) return svg;

  // Each orderedBlock position gets content from filteredOrder at same index
  const replacements = orderedBlocks
    .map((b, i) => ({ start: b.start, end: b.end, newContent: contentMap[filteredOrder[i]] }))
    .sort((a, b) => b.start - a.start);

  let result = svg;
  for (const { start, end, newContent } of replacements) {
    result = result.slice(0, start) + newContent + result.slice(end);
  }
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

// ── HTML ──────────────────────────────────────────────────────────────────────

const HTML = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reorder Fields — Pintle</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#f8f9fa;color:#1e293b;display:flex;height:100vh;overflow:hidden}

/* Sidebar */
#sidebar{width:260px;background:white;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;flex-shrink:0}
#sidebar h2{padding:14px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;border-bottom:1px solid #f1f5f9;flex-shrink:0}
#folder-list{overflow-y:auto;flex:1}
.folder-item{padding:9px 16px;font-size:13px;cursor:pointer;border-left:3px solid transparent;transition:.12s}
.folder-item:hover{background:#f8fafc}
.folder-item.active{background:#eff6ff;border-left-color:#3b82f6;color:#1d4ed8;font-weight:600}
.folder-cat{font-size:11px;color:#94a3b8;margin-top:1px}

/* Main */
#main{flex:1;display:flex;flex-direction:column;overflow:hidden}
#toolbar{padding:14px 24px;background:white;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;flex-shrink:0}
#toolbar h1{font-size:16px;font-weight:700;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#status{font-size:13px;color:#64748b;white-space:nowrap}
#save-btn{padding:8px 22px;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:.12s;flex-shrink:0}
#save-btn:hover:not(:disabled){background:#2563eb}
#save-btn:disabled{background:#cbd5e1;cursor:not-allowed}

#content{flex:1;overflow-y:auto;padding:24px}
#empty{display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:15px}

/* Field list */
#field-list{max-width:540px;margin:0 auto;display:flex;flex-direction:column;gap:8px}
.field-item{
  background:white;border:1.5px solid #e2e8f0;border-radius:12px;
  padding:12px 14px;display:flex;align-items:center;gap:10px;
  cursor:grab;transition:.15s;user-select:none
}
.field-item:active{cursor:grabbing}
.field-item:hover{border-color:#cbd5e1;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.field-item.dragging{opacity:.35;border-style:dashed}
.field-item.over{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
.drag-handle{color:#cbd5e1;flex-shrink:0}
.badge{font-size:10px;font-weight:700;padding:3px 7px;border-radius:99px;flex-shrink:0;letter-spacing:.04em}
.req{background:#dbeafe;color:#1d4ed8}
.opt{background:#f1f5f9;color:#64748b}
.field-id{font-size:13px;font-weight:600;font-family:monospace;flex:1}
.field-preview{font-size:12px;color:#94a3b8;direction:rtl;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px}
</style>
</head>
<body>

<div id="sidebar">
  <h2>Folders</h2>
  <div id="folder-list"><div style="padding:16px;color:#94a3b8;font-size:13px">Loading…</div></div>
</div>

<div id="main">
  <div id="toolbar">
    <h1 id="folder-title">Reorder Fields</h1>
    <span id="status"></span>
    <button id="save-btn" disabled>Save order</button>
  </div>
  <div id="content">
    <div id="empty">← Select a folder to reorder its fields</div>
    <div id="field-list" style="display:none"></div>
  </div>
</div>

<script>
let dragSrc = null;
let dirty   = false;

// ── Load folders ──────────────────────────────────────────────────────────
fetch('/api/folders').then(r=>r.json()).then(folders=>{
  const el = document.getElementById('folder-list');
  el.innerHTML = '';
  folders.forEach(f=>{
    const parts = f.replace('public/templates/','').split('/');
    const d = document.createElement('div');
    d.className = 'folder-item';
    d.innerHTML = '<div>'+escHtml(parts[parts.length-1])+'</div>'
      +(parts.length>1?'<div class="folder-cat">'+escHtml(parts[0])+'</div>':'');
    d.onclick = ()=>loadFolder(f,d);
    el.appendChild(d);
  });
});

// ── Load a folder ─────────────────────────────────────────────────────────
function loadFolder(path, el){
  document.querySelectorAll('.folder-item').forEach(e=>e.classList.remove('active'));
  el.classList.add('active');
  setStatus('');
  setSaveEnabled(false);
  dirty = false;
  document.getElementById('folder-title').textContent = path.split('/').pop();

  fetch('/api/fields?folder='+encodeURIComponent(path)).then(r=>r.json()).then(fields=>{
    renderFields(fields, path);
  });
}

// ── Render drag list ──────────────────────────────────────────────────────
function renderFields(fields, folderPath){
  const list  = document.getElementById('field-list');
  const empty = document.getElementById('empty');

  if(!fields.length){
    empty.textContent = 'No editable fields found in this folder.';
    empty.style.display = 'flex';
    list.style.display  = 'none';
    return;
  }
  empty.style.display = 'none';
  list.style.display  = 'flex';
  list.innerHTML = '';

  fields.forEach(f=>{
    const div = document.createElement('div');
    div.className   = 'field-item';
    div.draggable   = true;
    div.dataset.id  = f.fullId;
    div.dataset.folder = folderPath;
    div.innerHTML = \`
      <svg class="drag-handle" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <rect x="3" y="2" width="10" height="2" rx="1"/>
        <rect x="3" y="7" width="10" height="2" rx="1"/>
        <rect x="3" y="12" width="10" height="2" rx="1"/>
      </svg>
      <span class="badge \${f.required?'req':'opt'}">\${f.required?'required':'optional'}</span>
      <span class="field-id">\${escHtml(f.id)}</span>
      <span class="field-preview">\${escHtml(f.placeholder)}</span>
    \`;

    div.addEventListener('dragstart', e=>{
      dragSrc = div;
      requestAnimationFrame(()=>div.classList.add('dragging'));
      e.dataTransfer.effectAllowed = 'move';
    });
    div.addEventListener('dragend', ()=>{
      div.classList.remove('dragging');
      list.querySelectorAll('.field-item').forEach(el=>el.classList.remove('over'));
    });
    div.addEventListener('dragover', e=>{
      e.preventDefault();
      if(dragSrc===div) return;
      list.querySelectorAll('.field-item').forEach(el=>el.classList.remove('over'));
      div.classList.add('over');
    });
    div.addEventListener('dragleave', ()=>div.classList.remove('over'));
    div.addEventListener('drop', e=>{
      e.preventDefault();
      div.classList.remove('over');
      if(!dragSrc||dragSrc===div) return;
      const items = [...list.querySelectorAll('.field-item')];
      const si = items.indexOf(dragSrc), di = items.indexOf(div);
      list.insertBefore(dragSrc, si<di ? div.nextSibling : div);
      dirty = true;
      setStatus('Unsaved changes');
      setSaveEnabled(true);
    });

    list.appendChild(div);
  });
}

// ── Save ──────────────────────────────────────────────────────────────────
document.getElementById('save-btn').onclick = async ()=>{
  const items     = [...document.querySelectorAll('.field-item')];
  const newOrder  = items.map(el=>el.dataset.id);
  const folder    = items[0]?.dataset.folder;
  if(!folder) return;

  setSaveEnabled(false);
  document.getElementById('save-btn').textContent = 'Saving…';

  const res  = await fetch('/api/reorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({folder,newOrder})});
  const data = await res.json();

  document.getElementById('save-btn').textContent = 'Save order';
  if(data.ok){
    dirty = false;
    setStatus('✓ Saved '+data.count+' file'+(data.count===1?'':'s'));
  } else {
    setSaveEnabled(true);
    setStatus('✗ '+data.error);
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────
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
    // GET /api/folders
    if (url.pathname === '/api/folders') {
      const folders = await getSvgFolders();
      return json(res, folders);
    }

    // GET /api/fields?folder=...
    if (url.pathname === '/api/fields') {
      const folder = url.searchParams.get('folder');
      if (!folder) return json(res, []);
      return json(res, await getFieldsForFolder(folder));
    }

    // POST /api/reorder  { folder, newOrder }
    if (url.pathname === '/api/reorder' && req.method === 'POST') {
      const body = await readBody(req);
      const { folder, newOrder } = JSON.parse(body);

      const entries  = await readdir(folder);
      const svgFiles = entries.filter(f => f.toLowerCase().endsWith('.svg') && !f.startsWith('_'));

      let count = 0;
      for (const file of svgFiles) {
        const filePath = join(folder, file);
        const svg      = await readFile(filePath, 'utf-8');
        const newSvg   = applyNewOrder(svg, newOrder);
        if (newSvg !== svg) { await writeFile(filePath, newSvg); count++; }
      }
      return json(res, { ok: true, count });
    }

    // Serve HTML
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
  console.log(`\n  Reorder Fields — Pintle`);
  console.log(`  ─────────────────────────`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`\n  Ctrl+C to stop\n`);
});
