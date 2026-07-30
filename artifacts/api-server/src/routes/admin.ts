import { Router, type IRouter } from "express";
import { db, panelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/admin", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>TBH VIP Bot — Admin Panel</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',sans-serif;background:#0d1117;color:#e6edf3;min-height:100vh;padding:20px}
  h1{font-size:1.6rem;margin-bottom:4px;color:#58a6ff}
  .sub{color:#8b949e;font-size:.85rem;margin-bottom:24px}
  .card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:20px;margin-bottom:20px}
  .card h2{font-size:1rem;color:#f0f6fc;margin-bottom:16px;border-bottom:1px solid #21262d;padding-bottom:10px}
  label{display:block;font-size:.8rem;color:#8b949e;margin-bottom:4px}
  input{width:100%;padding:9px 12px;background:#0d1117;border:1px solid #30363d;border-radius:6px;
        color:#e6edf3;font-size:.9rem;margin-bottom:12px;outline:none;transition:.2s}
  input:focus{border-color:#58a6ff;box-shadow:0 0 0 3px rgba(88,166,255,.15)}
  .btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border:none;border-radius:6px;
       font-size:.9rem;font-weight:600;cursor:pointer;transition:.15s}
  .btn-add{background:#238636;color:#fff}.btn-add:hover{background:#2ea043}
  .btn-del{background:#da3633;color:#fff;padding:6px 12px;font-size:.8rem}.btn-del:hover{background:#f85149}
  table{width:100%;border-collapse:collapse;font-size:.85rem}
  th{text-align:left;padding:8px 12px;color:#8b949e;border-bottom:1px solid #21262d}
  td{padding:8px 12px;border-bottom:1px solid #21262d;word-break:break-all}
  tr:last-child td{border-bottom:none}
  .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:.75rem;font-weight:600}
  .badge-ok{background:rgba(35,134,54,.2);color:#3fb950}
  .toast{position:fixed;top:16px;right:16px;padding:10px 18px;border-radius:8px;font-size:.875rem;
         font-weight:600;z-index:999;transform:translateY(-80px);opacity:0;transition:.3s}
  .toast.show{transform:translateY(0);opacity:1}
  .toast-ok{background:#238636;color:#fff}
  .toast-err{background:#da3633;color:#fff}
  #panels-body tr td:last-child{white-space:nowrap}
  .empty{color:#8b949e;font-size:.85rem;padding:20px 0;text-align:center}
  .spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);
        border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<h1>⚙️ TBH VIP Bot — Admin Panel</h1>
<p class="sub">Firebase Panel Manager · Bot API Dashboard</p>

<!-- Add Panel -->
<div class="card">
  <h2>➕ Add Firebase Panel</h2>
  <label>Panel Name</label>
  <input id="pname" placeholder="e.g. Main Panel" />
  <label>Firebase Realtime DB URL</label>
  <input id="purl" placeholder="https://your-project-default-rtdb.firebaseio.com" />
  <label>Secret Key / Auth Token</label>
  <input id="psecret" type="password" placeholder="Firebase Database Secret" />
  <button class="btn btn-add" onclick="addPanel()">
    <span id="add-spin" style="display:none" class="spin"></span>
    Add Panel
  </button>
</div>

<!-- Panels List -->
<div class="card">
  <h2>📋 Registered Panels</h2>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Firebase URL</th><th>Added</th><th>Action</th></tr></thead>
    <tbody id="panels-body"><tr><td colspan="5" class="empty">Loading...</td></tr></tbody>
  </table>
</div>

<!-- Stats -->
<div class="card">
  <h2>📊 Quick Stats</h2>
  <div id="stats" style="color:#8b949e;font-size:.85rem">Loading...</div>
</div>

<div id="toast" class="toast"></div>

<script>
const BASE = window.location.origin;

function toast(msg, ok=true){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (ok ? 'toast-ok' : 'toast-err');
  setTimeout(()=>{ t.className='toast'; }, 3000);
}

async function loadPanels(){
  try{
    const r = await fetch(BASE + '/api/panels');
    const panels = await r.json();
    const tb = document.getElementById('panels-body');
    if(!panels.length){ tb.innerHTML = '<tr><td colspan="5" class="empty">No panels yet. Add your first Firebase panel above.</td></tr>'; return; }
    tb.innerHTML = panels.map((p,i) => \`
      <tr>
        <td><span class="badge badge-ok">\${i+1}</span></td>
        <td><b>\${esc(p.name)}</b></td>
        <td style="font-family:monospace;color:#79c0ff">\${esc(p.firebaseUrl)}</td>
        <td>\${new Date(p.createdAt).toLocaleDateString()}</td>
        <td><button class="btn btn-del" onclick="delPanel(\${p.id},this)">🗑 Delete</button></td>
      </tr>
    \`).join('');
  }catch(e){ document.getElementById('panels-body').innerHTML='<tr><td colspan="5" class="empty">Error loading panels</td></tr>'; }
}

async function loadStats(){
  try{
    const r = await fetch(BASE + '/api/dashboard');
    const d = await r.json();
    document.getElementById('stats').innerHTML = \`
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:4px">
        \${stat('📱 Total Devices', d.totalDevices ?? '—')}
        \${stat('🟢 Online', d.onlineDevices ?? '—')}
        \${stat('👥 Total Users', d.totalUsers ?? '—')}
        \${stat('🎁 Gift Cards', d.totalGiftCards ?? '—')}
      </div>
    \`;
  }catch(e){ document.getElementById('stats').textContent = 'Dashboard data unavailable.'; }
}

function stat(label, val){
  return \`<div style="background:#0d1117;padding:12px;border-radius:8px;border:1px solid #21262d">
    <div style="color:#8b949e;font-size:.75rem">\${label}</div>
    <div style="font-size:1.4rem;font-weight:700;color:#f0f6fc;margin-top:4px">\${val}</div>
  </div>\`;
}

async function addPanel(){
  const name   = document.getElementById('pname').value.trim();
  const url    = document.getElementById('purl').value.trim();
  const secret = document.getElementById('psecret').value.trim();
  if(!name || !url || !secret){ toast('All fields are required!', false); return; }
  const sp = document.getElementById('add-spin');
  sp.style.display='inline-block';
  try{
    const r = await fetch(BASE + '/api/panels', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, firebaseUrl: url, secretKey: secret })
    });
    if(r.ok){
      toast('Panel added successfully!');
      document.getElementById('pname').value='';
      document.getElementById('purl').value='';
      document.getElementById('psecret').value='';
      loadPanels(); loadStats();
    } else {
      const err = await r.json();
      toast('Error: ' + (err.error || r.status), false);
    }
  }catch(e){ toast('Network error', false); }
  finally{ sp.style.display='none'; }
}

async function delPanel(id, btn){
  if(!confirm('Delete this panel?')) return;
  btn.disabled=true; btn.textContent='...';
  try{
    const r = await fetch(BASE + '/api/panels/' + id, { method:'DELETE' });
    if(r.ok){ toast('Panel deleted.'); loadPanels(); loadStats(); }
    else { toast('Delete failed', false); btn.disabled=false; btn.textContent='🗑 Delete'; }
  }catch(e){ toast('Network error', false); btn.disabled=false; btn.textContent='🗑 Delete'; }
}

function esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

loadPanels();
loadStats();
</script>
</body>
</html>`);
});

export default router;
