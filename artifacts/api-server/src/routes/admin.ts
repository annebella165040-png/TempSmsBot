import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/admin", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(HTML);
});

export default router;

const HTML = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AnneBella Admin Panel</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --cyan:#00e5c8;--cyan2:#00b8ff;--dark:#020910;--card:#050f1f;
  --border:rgba(0,229,200,.18);--glow:rgba(0,229,200,.08);
  --text:#c8e8f0;--dim:#5a8090;--red:#ff3a5c;--green:#00e5c8;
}
html,body{height:100%;overflow:hidden}
body{
  font-family:'Share Tech Mono',monospace;
  background:var(--dark);color:var(--text);
  display:flex;height:100vh;overflow:hidden;
}

/* ── Starfield canvas ── */
#stars{position:fixed;inset:0;z-index:0;pointer-events:none}

/* ── Sidebar ── */
#sidebar{
  position:relative;z-index:10;width:72px;min-width:72px;
  background:rgba(2,9,16,.9);border-right:1px solid var(--border);
  display:flex;flex-direction:column;align-items:center;
  padding:16px 0;gap:6px;backdrop-filter:blur(12px);
  transition:width .3s;overflow:hidden;
}
#sidebar:hover{width:200px}
.brand{
  display:flex;align-items:center;gap:10px;
  padding:0 16px 16px;border-bottom:1px solid var(--border);
  width:100%;white-space:nowrap;margin-bottom:6px;
}
.brand-icon{
  width:36px;height:36px;min-width:36px;
  background:linear-gradient(135deg,var(--cyan),var(--cyan2));
  border-radius:8px;display:flex;align-items:center;justify-content:center;
  font-size:18px;font-weight:900;color:#020910;font-family:'Orbitron',sans-serif;
}
.brand-name{
  font-family:'Orbitron',sans-serif;font-size:.75rem;font-weight:700;
  color:var(--cyan);letter-spacing:2px;text-transform:uppercase;
  white-space:nowrap;overflow:hidden;
}

.nav-item{
  width:100%;display:flex;align-items:center;gap:12px;
  padding:11px 18px;cursor:pointer;border-radius:0;
  transition:.2s;position:relative;white-space:nowrap;
  border-left:3px solid transparent;
}
.nav-item:hover{background:var(--glow);color:var(--cyan)}
.nav-item.active{
  background:rgba(0,229,200,.1);color:var(--cyan);
  border-left-color:var(--cyan);
}
.nav-item.active::after{
  content:'';position:absolute;right:0;top:50%;transform:translateY(-50%);
  width:4px;height:60%;background:var(--cyan);border-radius:2px 0 0 2px;
  box-shadow:0 0 8px var(--cyan);
}
.nav-icon{font-size:1.1rem;min-width:20px;text-align:center}
.nav-label{font-size:.78rem;letter-spacing:1px;text-transform:uppercase;overflow:hidden}

/* ── Main ── */
#main{
  flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;z-index:5;
}

/* ── Header ── */
#header{
  height:56px;display:flex;align-items:center;justify-content:space-between;
  padding:0 24px;border-bottom:1px solid var(--border);
  background:rgba(2,9,16,.85);backdrop-filter:blur(12px);flex-shrink:0;
}
.header-title{
  font-family:'Orbitron',sans-serif;font-size:.95rem;font-weight:700;
  color:var(--cyan);letter-spacing:2px;text-transform:uppercase;
}
.live-badge{
  display:flex;align-items:center;gap:6px;
  background:rgba(0,229,200,.1);border:1px solid var(--border);
  border-radius:20px;padding:4px 12px;font-size:.72rem;letter-spacing:2px;
  text-transform:uppercase;color:var(--cyan);
}
.live-dot{
  width:8px;height:8px;border-radius:50%;background:var(--cyan);
  animation:pulse 1.5s ease-in-out infinite;box-shadow:0 0 6px var(--cyan);
}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

/* ── Content ── */
#content{flex:1;overflow-y:auto;padding:24px;scrollbar-width:thin;scrollbar-color:var(--border) transparent}
#content::-webkit-scrollbar{width:4px}
#content::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

/* ── Sections ── */
.section{display:none}
.section.active{display:block}

/* ── Stats grid ── */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px}
.stat-card{
  background:var(--card);border:1px solid var(--border);border-radius:10px;
  padding:16px;position:relative;overflow:hidden;
}
.stat-card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,var(--cyan),transparent);
}
.stat-label{font-size:.68rem;color:var(--dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px}
.stat-val{
  font-family:'Orbitron',sans-serif;font-size:2rem;font-weight:700;color:var(--cyan);
  text-shadow:0 0 20px rgba(0,229,200,.5);line-height:1;
}
.stat-icon{position:absolute;right:12px;top:12px;font-size:1.1rem;opacity:.4}

/* ── Panel breakdown ── */
.panel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px}
.panel-stat-card{
  background:var(--card);border:1px solid var(--border);border-radius:8px;
  padding:14px;display:flex;gap:12px;align-items:center;
}
.panel-icon-box{
  width:40px;height:40px;border-radius:8px;
  background:rgba(0,229,200,.08);border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;
}
.panel-stat-name{font-size:.78rem;color:var(--dim);margin-bottom:4px}
.panel-stat-nums{font-size:.82rem}
.panel-stat-nums span{color:var(--cyan);font-weight:700}

/* ── Cards ── */
.card{
  background:var(--card);border:1px solid var(--border);border-radius:10px;
  margin-bottom:16px;overflow:hidden;
}
.card-header{
  padding:14px 18px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
  background:rgba(0,229,200,.03);
}
.card-title{font-size:.82rem;color:var(--cyan);letter-spacing:1.5px;text-transform:uppercase;font-weight:700}
.card-body{padding:18px}

/* ── Form ── */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form-grid.cols3{grid-template-columns:1fr 1fr 1fr}
.form-grid.cols1{grid-template-columns:1fr}
@media(max-width:600px){.form-grid,.form-grid.cols3{grid-template-columns:1fr}}
.form-group{display:flex;flex-direction:column;gap:5px}
label{font-size:.72rem;color:var(--dim);letter-spacing:1px;text-transform:uppercase}
input,select,textarea{
  background:rgba(0,10,20,.8);border:1px solid var(--border);border-radius:6px;
  color:var(--text);font-family:'Share Tech Mono',monospace;font-size:.85rem;
  padding:9px 12px;outline:none;transition:.2s;width:100%;
}
input:focus,select:focus,textarea:focus{border-color:var(--cyan);box-shadow:0 0 0 2px rgba(0,229,200,.1)}
textarea{resize:vertical;min-height:100px}
select option{background:#050f1f}

/* ── Buttons ── */
.btn{
  display:inline-flex;align-items:center;gap:6px;
  padding:9px 18px;border:none;border-radius:6px;
  font-family:'Share Tech Mono',monospace;font-size:.82rem;
  font-weight:600;cursor:pointer;transition:.15s;letter-spacing:.5px;
  text-transform:uppercase;
}
.btn-primary{background:rgba(0,229,200,.12);border:1px solid var(--cyan);color:var(--cyan)}
.btn-primary:hover{background:rgba(0,229,200,.22);box-shadow:0 0 12px rgba(0,229,200,.2)}
.btn-danger{background:rgba(255,58,92,.1);border:1px solid var(--red);color:var(--red)}
.btn-danger:hover{background:rgba(255,58,92,.22)}
.btn-success{background:rgba(0,229,200,.1);border:1px solid var(--green);color:var(--green)}
.btn-sm{padding:5px 10px;font-size:.72rem}
.btn-full{width:100%;justify-content:center;margin-top:12px}

/* ── Table ── */
.tbl-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.8rem}
thead th{
  padding:10px 12px;text-align:left;color:var(--dim);
  border-bottom:1px solid var(--border);letter-spacing:1px;text-transform:uppercase;font-size:.72rem;
}
tbody td{padding:10px 12px;border-bottom:1px solid rgba(0,229,200,.06);vertical-align:middle}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover{background:var(--glow)}
.mono{font-family:'Share Tech Mono',monospace;color:#79c0ff;font-size:.78rem}

/* ── Badges ── */
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:.7rem;font-weight:700;letter-spacing:.5px}
.badge-online{background:rgba(0,229,200,.12);color:var(--cyan);border:1px solid rgba(0,229,200,.25)}
.badge-offline{background:rgba(90,128,144,.1);color:var(--dim);border:1px solid rgba(90,128,144,.2)}
.badge-active{background:rgba(0,229,200,.1);color:var(--cyan);border:1px solid rgba(0,229,200,.2)}
.badge-banned{background:rgba(255,58,92,.1);color:var(--red);border:1px solid rgba(255,58,92,.2)}
.badge-used{background:rgba(90,128,144,.1);color:var(--dim);border:1px solid rgba(90,128,144,.2)}
.badge-free{background:rgba(0,229,200,.1);color:var(--cyan);border:1px solid rgba(0,229,200,.2)}

/* ── Toast ── */
#toast{
  position:fixed;top:70px;right:20px;z-index:9999;
  padding:12px 20px;border-radius:8px;font-size:.82rem;
  transform:translateX(120%);transition:.3s;max-width:320px;
  border:1px solid;backdrop-filter:blur(12px);
}
#toast.show-ok{transform:translateX(0);background:rgba(0,229,200,.15);border-color:var(--cyan);color:var(--cyan)}
#toast.show-err{transform:translateX(0);background:rgba(255,58,92,.15);border-color:var(--red);color:var(--red)}

/* ── Search ── */
.search-wrap{display:flex;gap:10px;margin-bottom:14px}
.search-wrap input{flex:1}

/* ── Channel list ── */
.ch-item{
  display:flex;align-items:center;gap:12px;
  padding:12px 16px;border-bottom:1px solid rgba(0,229,200,.06);
}
.ch-item:last-child{border-bottom:none}
.ch-icon{
  width:36px;height:36px;border-radius:8px;
  background:rgba(0,229,200,.08);border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;
}
.ch-info{flex:1;min-width:0}
.ch-name{font-size:.85rem;color:var(--text);margin-bottom:2px}
.ch-id{font-size:.72rem;color:var(--dim)}

/* ── Broadcast ── */
.bcast-stats{display:flex;gap:16px;padding:14px 0;border-top:1px solid var(--border);margin-top:12px;font-size:.82rem}
.bcast-stat{text-align:center}
.bcast-stat-val{font-family:'Orbitron',sans-serif;font-size:1.4rem;color:var(--cyan);display:block}
.bcast-stat-label{color:var(--dim);font-size:.7rem;text-transform:uppercase;letter-spacing:1px}

/* ── Progress bar ── */
.progress-wrap{margin-top:8px;background:rgba(0,229,200,.05);border:1px solid var(--border);border-radius:4px;height:4px;overflow:hidden}
.progress-bar{height:100%;background:linear-gradient(90deg,var(--cyan2),var(--cyan));transition:width .3s;width:0}

.empty{color:var(--dim);text-align:center;padding:24px;font-size:.82rem}
.spin{display:inline-block;width:12px;height:12px;border:2px solid rgba(0,229,200,.3);border-top-color:var(--cyan);border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>

<!-- Starfield Canvas -->
<canvas id="stars"></canvas>

<!-- Sidebar -->
<nav id="sidebar">
  <div class="brand">
    <div class="brand-icon">A</div>
    <span class="brand-name">AnneBella</span>
  </div>
  <div class="nav-item active" data-tab="dashboard"><span class="nav-icon">⚡</span><span class="nav-label">Dashboard</span></div>
  <div class="nav-item" data-tab="panels"><span class="nav-icon">🖥️</span><span class="nav-label">Panels</span></div>
  <div class="nav-item" data-tab="users"><span class="nav-icon">👥</span><span class="nav-label">Users</span></div>
  <div class="nav-item" data-tab="giftcards"><span class="nav-icon">🎁</span><span class="nav-label">Gift Cards</span></div>
  <div class="nav-item" data-tab="broadcast"><span class="nav-icon">📢</span><span class="nav-label">Broadcast</span></div>
  <div class="nav-item" data-tab="channels"><span class="nav-icon">🔗</span><span class="nav-label">Channels</span></div>
</nav>

<!-- Main -->
<div id="main">
  <!-- Header -->
  <div id="header">
    <div class="header-title" id="page-title">⚡ Dashboard</div>
    <div style="display:flex;align-items:center;gap:12px">
      <div class="live-badge"><div class="live-dot"></div> LIVE</div>
    </div>
  </div>

  <!-- Content -->
  <div id="content">

    <!-- ── DASHBOARD ── -->
    <div class="section active" id="tab-dashboard">
      <div class="stats-grid" id="stats-grid">
        <div class="stat-card"><div class="stat-label">Total Devices</div><div class="stat-val" id="s-devices">—</div><div class="stat-icon">🖥️</div></div>
        <div class="stat-card"><div class="stat-label">Online</div><div class="stat-val" id="s-online">—</div><div class="stat-icon">🟢</div></div>
        <div class="stat-card"><div class="stat-label">Offline</div><div class="stat-val" id="s-offline">—</div><div class="stat-icon">🔴</div></div>
        <div class="stat-card"><div class="stat-label">Total Users</div><div class="stat-val" id="s-users">—</div><div class="stat-icon">👥</div></div>
        <div class="stat-card"><div class="stat-label">Active Users</div><div class="stat-val" id="s-active">—</div><div class="stat-icon">⚡</div></div>
        <div class="stat-card"><div class="stat-label">Gift Cards</div><div class="stat-val" id="s-gifts">—</div><div class="stat-icon">🎁</div></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">🖥️ Panel Breakdown</span><button class="btn btn-primary btn-sm" onclick="loadDashboard()">↺ Refresh</button></div>
        <div class="card-body">
          <div class="tbl-wrap">
            <table>
              <thead><tr><th>#</th><th>Panel Name</th><th>Total</th><th>Online</th><th>Offline</th></tr></thead>
              <tbody id="panel-breakdown"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ── PANELS ── -->
    <div class="section" id="tab-panels">
      <div class="card">
        <div class="card-header"><span class="card-title">➕ Add Firebase Panel</span></div>
        <div class="card-body">
          <div class="form-grid cols1">
            <div class="form-group"><label>Panel Name</label><input id="p-name" placeholder="e.g. Main Panel"/></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label>Firebase Realtime DB URL</label><input id="p-url" placeholder="https://your-project-rtdb.firebaseio.com"/></div>
            <div class="form-group"><label>Secret Key / Auth Token</label><input id="p-secret" type="password" placeholder="Firebase Database Secret"/></div>
          </div>
          <button class="btn btn-primary btn-full" onclick="addPanel()"><span id="p-spin" style="display:none" class="spin"></span>Add Panel</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">📋 Registered Panels</span></div>
        <div class="card-body">
          <div class="tbl-wrap">
            <table>
              <thead><tr><th>#</th><th>Name</th><th>Firebase URL</th><th>Added</th><th>Action</th></tr></thead>
              <tbody id="panels-tbody"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ── USERS ── -->
    <div class="section" id="tab-users">
      <div class="search-wrap">
        <input id="u-search" placeholder="Search by name, username or Telegram ID…" oninput="searchUsers()"/>
        <button class="btn btn-primary" onclick="loadUsers()">↺</button>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">👥 Bot Users</span><span id="user-count" style="color:var(--dim);font-size:.75rem"></span></div>
        <div class="card-body" style="padding:0">
          <div class="tbl-wrap">
            <table>
              <thead><tr><th>#</th><th>User</th><th>Telegram ID</th><th>Credits</th><th>Referrals</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody id="users-tbody"><tr><td colspan="8" class="empty">Loading…</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ── GIFT CARDS ── -->
    <div class="section" id="tab-giftcards">
      <div class="card">
        <div class="card-header"><span class="card-title">🎁 Generate Gift Card</span></div>
        <div class="card-body">
          <div class="form-grid cols3">
            <div class="form-group">
              <label>Code</label>
              <div style="display:flex;gap:8px">
                <input id="gc-code" placeholder="AUTO or custom"/>
                <button class="btn btn-primary btn-sm" onclick="genCode()">Gen</button>
              </div>
            </div>
            <div class="form-group">
              <label>Type</label>
              <select id="gc-type">
                <option value="hours">Hours (Get Number)</option>
                <option value="credits">SMS Credits</option>
              </select>
            </div>
            <div class="form-group">
              <label>Value</label>
              <input id="gc-value" type="number" placeholder="e.g. 12 (hours) or 500 (credits)"/>
            </div>
          </div>
          <button class="btn btn-primary btn-full" onclick="createGiftCard()"><span id="gc-spin" style="display:none" class="spin"></span>Create Gift Card</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">📋 All Gift Cards</span><button class="btn btn-primary btn-sm" onclick="loadGiftCards()">↺</button></div>
        <div class="card-body" style="padding:0">
          <div class="tbl-wrap">
            <table>
              <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Status</th><th>Used By</th><th>Created</th><th>Action</th></tr></thead>
              <tbody id="gc-tbody"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ── BROADCAST ── -->
    <div class="section" id="tab-broadcast">
      <div class="card">
        <div class="card-header"><span class="card-title">📢 Broadcast Message</span></div>
        <div class="card-body">
          <div class="form-group" style="margin-bottom:12px">
            <label>Message (HTML supported: &lt;b&gt;, &lt;i&gt;, &lt;code&gt;, &lt;a href&gt;)</label>
            <textarea id="bc-msg" placeholder="Aapka message yahan type karo…"></textarea>
          </div>
          <div style="font-size:.75rem;color:var(--dim);margin-bottom:12px">⚠️ Banned users ko skip kiya jayega. Rate limit: 50ms delay per message.</div>
          <button class="btn btn-primary btn-full" id="bc-btn" onclick="doBroadcast()">📢 Send to All Users</button>
          <div class="progress-wrap" id="bc-progress" style="display:none"><div class="progress-bar" id="bc-bar"></div></div>
          <div class="bcast-stats" id="bc-stats" style="display:none">
            <div class="bcast-stat"><span class="bcast-stat-val" id="bc-sent">0</span><span class="bcast-stat-label">Sent</span></div>
            <div class="bcast-stat"><span class="bcast-stat-val" id="bc-failed">0</span><span class="bcast-stat-label">Failed</span></div>
            <div class="bcast-stat"><span class="bcast-stat-val" id="bc-total">0</span><span class="bcast-stat-label">Total</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── CHANNELS ── -->
    <div class="section" id="tab-channels">
      <div class="card">
        <div class="card-header"><span class="card-title">➕ Add Force-Join Channel</span></div>
        <div class="card-body">
          <div class="form-grid cols3">
            <div class="form-group"><label>Channel ID / Username</label><input id="ch-id" placeholder="@channelname"/></div>
            <div class="form-group"><label>Display Label</label><input id="ch-label" placeholder="e.g. AnneBella Network"/></div>
            <div class="form-group"><label>Invite URL</label><input id="ch-url" placeholder="https://t.me/channelname"/></div>
          </div>
          <button class="btn btn-primary btn-full" onclick="addChannel()">Add Channel</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">🔗 Force-Join Channels</span><button class="btn btn-primary btn-sm" onclick="loadChannels()">↺</button></div>
        <div class="card-body" style="padding:0">
          <div id="ch-list"><div class="empty">Loading…</div></div>
        </div>
      </div>
    </div>

  </div><!-- /content -->
</div><!-- /main -->

<div id="toast"></div>

<script>
const B = window.location.origin;
let _toastTimer;

// ── Toast ──
function toast(msg, ok=true){
  clearTimeout(_toastTimer);
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = ok ? 'show-ok' : 'show-err';
  _toastTimer = setTimeout(()=>t.className='', 3500);
}

// ── Navigation ──
const titles = {
  dashboard:'⚡ Dashboard', panels:'🖥️ Firebase Panels',
  users:'👥 Bot Users', giftcards:'🎁 Gift Cards',
  broadcast:'📢 Broadcast', channels:'🔗 Force-Join Channels'
};
document.querySelectorAll('.nav-item').forEach(item=>{
  item.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    item.classList.add('active');
    const tab = item.dataset.tab;
    document.getElementById('tab-'+tab).classList.add('active');
    document.getElementById('page-title').textContent = titles[tab];
    if(tab==='dashboard') loadDashboard();
    if(tab==='panels') loadPanels();
    if(tab==='users') loadUsers();
    if(tab==='giftcards') loadGiftCards();
    if(tab==='channels') loadChannels();
  });
});

function esc(s){ const d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }

// ── DASHBOARD ──
async function loadDashboard(){
  try{
    const d = await (await fetch(B+'/api/dashboard')).json();
    document.getElementById('s-devices').textContent = d.totalDevices ?? '—';
    document.getElementById('s-online').textContent  = d.onlineDevices ?? '—';
    document.getElementById('s-offline').textContent = d.offlineDevices ?? '—';
    document.getElementById('s-users').textContent   = d.totalUsers ?? '—';
    document.getElementById('s-active').textContent  = d.activeUsers ?? '—';
    document.getElementById('s-gifts').textContent   = d.totalGiftCards ?? '—';
    const tb = document.getElementById('panel-breakdown');
    if(!d.panelBreakdown?.length){tb.innerHTML='<tr><td colspan="5" class="empty">No panels yet</td></tr>';return;}
    tb.innerHTML = d.panelBreakdown.map((p,i)=>\`
      <tr>
        <td class="mono">\${i+1}</td>
        <td><b>\${esc(p.panelName)}</b></td>
        <td>\${p.total}</td>
        <td><span class="badge badge-online">\${p.online}</span></td>
        <td><span class="badge badge-offline">\${p.offline}</span></td>
      </tr>
    \`).join('');
  }catch(e){ toast('Dashboard load failed', false); }
}

// ── PANELS ──
async function loadPanels(){
  try{
    const panels = await (await fetch(B+'/api/panels')).json();
    const tb = document.getElementById('panels-tbody');
    if(!panels.length){tb.innerHTML='<tr><td colspan="5" class="empty">No panels yet</td></tr>';return;}
    tb.innerHTML = panels.map((p,i)=>\`
      <tr>
        <td class="mono">\${i+1}</td>
        <td><b>\${esc(p.name)}</b></td>
        <td class="mono" style="max-width:220px;overflow:hidden;text-overflow:ellipsis">\${esc(p.firebaseUrl)}</td>
        <td style="color:var(--dim);font-size:.75rem">\${new Date(p.createdAt).toLocaleDateString()}</td>
        <td><button class="btn btn-danger btn-sm" onclick="delPanel(\${p.id},this)">🗑 Delete</button></td>
      </tr>
    \`).join('');
  }catch(e){ toast('Panels load failed', false); }
}

async function addPanel(){
  const name=document.getElementById('p-name').value.trim();
  const url=document.getElementById('p-url').value.trim();
  const secret=document.getElementById('p-secret').value.trim();
  if(!name||!url||!secret){toast('All fields required',false);return;}
  const sp=document.getElementById('p-spin'); sp.style.display='inline-block';
  try{
    const r = await fetch(B+'/api/panels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,firebaseUrl:url,secretKey:secret})});
    if(r.ok){toast('Panel added ✅'); document.getElementById('p-name').value=''; document.getElementById('p-url').value=''; document.getElementById('p-secret').value=''; loadPanels(); loadDashboard();}
    else{const e=await r.json();toast('Error: '+(e.error||r.status),false);}
  }catch{toast('Network error',false);}
  finally{sp.style.display='none';}
}

async function delPanel(id,btn){
  if(!confirm('Delete this panel?'))return;
  btn.disabled=true;btn.textContent='…';
  try{
    const r=await fetch(B+'/api/panels/'+id,{method:'DELETE'});
    if(r.ok){toast('Panel deleted');loadPanels();loadDashboard();}
    else{toast('Delete failed',false);btn.disabled=false;btn.textContent='🗑 Delete';}
  }catch{toast('Network error',false);btn.disabled=false;btn.textContent='🗑 Delete';}
}

// ── USERS ──
let _allUsers=[];
async function loadUsers(){
  try{
    _allUsers = await (await fetch(B+'/api/users')).json();
    renderUsers(_allUsers);
  }catch{toast('Users load failed',false);}
}
function searchUsers(){
  const q=document.getElementById('u-search').value.toLowerCase();
  const f=_allUsers.filter(u=>(u.firstName||'').toLowerCase().includes(q)||(u.username||'').toLowerCase().includes(q)||(u.telegramId||'').includes(q));
  renderUsers(f);
}
function renderUsers(users){
  document.getElementById('user-count').textContent = users.length+' users';
  const tb=document.getElementById('users-tbody');
  if(!users.length){tb.innerHTML='<tr><td colspan="8" class="empty">No users found</td></tr>';return;}
  tb.innerHTML=users.map((u,i)=>{
    const banned=u.isBanned;
    const active=u.getNumberExpiresAt && new Date(u.getNumberExpiresAt)>new Date();
    return \`<tr>
      <td class="mono" style="color:var(--dim)">\${i+1}</td>
      <td>
        <div style="font-size:.85rem">\${esc(u.firstName)}</div>
        <div style="color:var(--dim);font-size:.72rem">\${u.username?'@'+esc(u.username):''}</div>
      </td>
      <td class="mono">\${esc(u.telegramId)}</td>
      <td style="color:var(--cyan);font-weight:700">\${u.smsCredits||0}</td>
      <td style="color:var(--dim)">\${u.referralCount||0}</td>
      <td><span class="badge \${banned?'badge-banned':active?'badge-active':'badge-offline'}">\${banned?'Banned':active?'Active':'Inactive'}</span></td>
      <td style="color:var(--dim);font-size:.75rem">\${new Date(u.createdAt).toLocaleDateString()}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm \${banned?'btn-success':'btn-danger'}" onclick="toggleBan(\${u.id},\${banned},this)">\${banned?'Unban':'Ban'}</button>
          <button class="btn btn-primary btn-sm" onclick="addCredits(\${u.id})">+Credits</button>
        </div>
      </td>
    </tr>\`;
  }).join('');
}

async function toggleBan(id,isBanned,btn){
  btn.disabled=true;
  try{
    const r=await fetch(B+'/api/users/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({isBanned:!isBanned})});
    if(r.ok){toast(isBanned?'User unbanned':'User banned');loadUsers();}
    else{toast('Action failed',false);}
  }catch{toast('Network error',false);}
  finally{btn.disabled=false;}
}

async function addCredits(id){
  const amt=parseInt(prompt('Add SMS Credits (number):'));
  if(isNaN(amt)||amt<=0)return;
  const u=_allUsers.find(x=>x.id===id);
  const newCredits=(u?.smsCredits||0)+amt;
  try{
    const r=await fetch(B+'/api/users/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({smsCredits:newCredits})});
    if(r.ok){toast(\`+\${amt} credits added ✅\`);loadUsers();}
    else{toast('Failed',false);}
  }catch{toast('Network error',false);}
}

// ── GIFT CARDS ──
function genCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='';
  for(let i=0;i<12;i++){if(i&&i%4===0)code+='-'; code+=chars[Math.floor(Math.random()*chars.length)];}
  document.getElementById('gc-code').value=code;
}

async function createGiftCard(){
  let code=document.getElementById('gc-code').value.trim();
  const type=document.getElementById('gc-type').value;
  const value=parseInt(document.getElementById('gc-value').value);
  if(!code||!type||isNaN(value)||value<=0){toast('All fields required',false);return;}
  if(code.toUpperCase()==='AUTO')genCode(),code=document.getElementById('gc-code').value;
  const sp=document.getElementById('gc-spin');sp.style.display='inline-block';
  try{
    const r=await fetch(B+'/api/gift-cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,type,value})});
    if(r.ok){const c=await r.json();toast('Gift card created: '+c.code+' ✅');document.getElementById('gc-code').value='';document.getElementById('gc-value').value='';loadGiftCards();}
    else{const e=await r.json();toast('Error: '+(e.error||r.status),false);}
  }catch{toast('Network error',false);}
  finally{sp.style.display='none';}
}

async function loadGiftCards(){
  try{
    const cards=await (await fetch(B+'/api/gift-cards')).json();
    const tb=document.getElementById('gc-tbody');
    if(!cards.length){tb.innerHTML='<tr><td colspan="7" class="empty">No gift cards yet</td></tr>';return;}
    tb.innerHTML=cards.map(c=>\`
      <tr>
        <td class="mono" style="color:var(--cyan);font-weight:700;letter-spacing:2px">\${esc(c.code)}</td>
        <td><span class="badge badge-active">\${c.type}</span></td>
        <td>\${c.value} \${c.type==='hours'?'hrs':'credits'}</td>
        <td><span class="badge \${c.usedBy?'badge-used':'badge-free'}">\${c.usedBy?'Used':'Available'}</span></td>
        <td class="mono" style="font-size:.72rem;color:var(--dim)">\${c.usedBy?esc(c.usedBy):'—'}</td>
        <td style="color:var(--dim);font-size:.75rem">\${new Date(c.createdAt).toLocaleDateString()}</td>
        <td>\${!c.usedBy?'<button class="btn btn-danger btn-sm" onclick="delCard('+c.id+',this)">🗑</button>':'—'}</td>
      </tr>
    \`).join('');
  }catch{toast('Gift cards load failed',false);}
}

async function delCard(id,btn){
  if(!confirm('Delete this gift card?'))return;
  btn.disabled=true;
  try{
    const r=await fetch(B+'/api/gift-cards/'+id,{method:'DELETE'});
    if(r.ok){toast('Gift card deleted');loadGiftCards();}
    else{toast('Delete failed',false);}
  }catch{toast('Network error',false);}
  finally{btn.disabled=false;}
}

// ── BROADCAST ──
async function doBroadcast(){
  const msg=document.getElementById('bc-msg').value.trim();
  if(!msg){toast('Message is required',false);return;}
  if(!confirm('Sabhi active users ko message bhejein?'))return;
  const btn=document.getElementById('bc-btn');
  btn.disabled=true;btn.textContent='Sending…';
  document.getElementById('bc-progress').style.display='block';
  document.getElementById('bc-bar').style.width='30%';
  document.getElementById('bc-stats').style.display='none';
  try{
    const r=await fetch(B+'/api/broadcast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
    document.getElementById('bc-bar').style.width='100%';
    if(r.ok){
      const d=await r.json();
      document.getElementById('bc-sent').textContent=d.sent;
      document.getElementById('bc-failed').textContent=d.failed;
      document.getElementById('bc-total').textContent=d.total;
      document.getElementById('bc-stats').style.display='flex';
      toast(\`Broadcast done: \${d.sent} sent, \${d.failed} failed\`);
    }else{toast('Broadcast failed',false);}
  }catch{toast('Network error',false);}
  finally{btn.disabled=false;btn.textContent='📢 Send to All Users';}
}

// ── CHANNELS ──
async function loadChannels(){
  try{
    const chs=await (await fetch(B+'/api/channels')).json();
    const el=document.getElementById('ch-list');
    if(!chs.length){el.innerHTML='<div class="empty">No channels configured</div>';return;}
    el.innerHTML=chs.map(c=>\`
      <div class="ch-item">
        <div class="ch-icon">📢</div>
        <div class="ch-info">
          <div class="ch-name">\${esc(c.label)}</div>
          <div class="ch-id">\${esc(c.id)} · <a href="\${esc(c.url)}" target="_blank" style="color:var(--cyan)">\${esc(c.url)}</a></div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="delChannel('\${esc(c.id)}',this)">🗑</button>
      </div>
    \`).join('');
  }catch{toast('Channels load failed',false);}
}

async function addChannel(){
  const id=document.getElementById('ch-id').value.trim();
  const label=document.getElementById('ch-label').value.trim();
  const url=document.getElementById('ch-url').value.trim();
  if(!id||!label||!url){toast('All fields required',false);return;}
  try{
    const r=await fetch(B+'/api/channels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,label,url})});
    if(r.ok){toast('Channel added ✅');document.getElementById('ch-id').value='';document.getElementById('ch-label').value='';document.getElementById('ch-url').value='';loadChannels();}
    else{const e=await r.json();toast(e.error||'Error',false);}
  }catch{toast('Network error',false);}
}

async function delChannel(id,btn){
  if(!confirm('Remove this channel from force-join?'))return;
  btn.disabled=true;
  try{
    const r=await fetch(B+'/api/channels/'+encodeURIComponent(id),{method:'DELETE'});
    if(r.ok){toast('Channel removed');loadChannels();}
    else{toast('Failed',false);btn.disabled=false;}
  }catch{toast('Network error',false);btn.disabled=false;}
}

// ── Starfield ──
(function(){
  const canvas=document.getElementById('stars');
  const ctx=canvas.getContext('2d');
  let W,H,stars=[],shooting=[];

  function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}
  window.addEventListener('resize',resize);resize();

  // Create twinkling stars
  for(let i=0;i<220;i++){
    stars.push({
      x:Math.random()*W,y:Math.random()*H,
      r:Math.random()*1.4+.2,
      alpha:Math.random(),
      da:(.003+Math.random()*.008)*(Math.random()<.5?1:-1)
    });
  }

  // Nebula blobs (static, drawn once)
  function drawNebula(){
    const blobs=[
      {x:W*.15,y:H*.2,r:260,c:'rgba(0,60,120,.18)'},
      {x:W*.8, y:H*.7,r:300,c:'rgba(0,80,100,.14)'},
      {x:W*.5, y:H*.5,r:400,c:'rgba(0,30,60,.10)'},
    ];
    blobs.forEach(b=>{
      const g=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);
      g.addColorStop(0,b.c);g.addColorStop(1,'transparent');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
    });
  }

  function spawnShooting(){
    if(Math.random()<.015&&shooting.length<5){
      const x=Math.random()*W*.8;const y=Math.random()*H*.4;
      shooting.push({x,y,len:80+Math.random()*100,dx:4+Math.random()*6,dy:2+Math.random()*3,alpha:1,trail:[]});
    }
  }

  function draw(){
    ctx.clearRect(0,0,W,H);

    // Nebula
    drawNebula();

    // Twinkling stars
    stars.forEach(s=>{
      s.alpha+=s.da;
      if(s.alpha>=1||s.alpha<=0){s.da*=-1;s.alpha=Math.max(0,Math.min(1,s.alpha));}
      ctx.globalAlpha=s.alpha*.8+.1;
      ctx.fillStyle='#a8d8f0';
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
    });

    // Shooting stars
    spawnShooting();
    shooting=shooting.filter(s=>{
      s.x+=s.dx;s.y+=s.dy;s.alpha-=.018;
      if(s.alpha<=0)return false;
      ctx.save();
      const g=ctx.createLinearGradient(s.x-s.dx*s.len/6,s.y-s.dy*s.len/6,s.x,s.y);
      g.addColorStop(0,'transparent');
      g.addColorStop(1,\`rgba(0,229,200,\${s.alpha})\`);
      ctx.strokeStyle=g;ctx.lineWidth=1.5;
      ctx.globalAlpha=s.alpha;
      ctx.beginPath();ctx.moveTo(s.x-s.dx*12,s.y-s.dy*12);ctx.lineTo(s.x,s.y);ctx.stroke();
      // Head glow
      ctx.globalAlpha=s.alpha*.8;
      const glow=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,5);
      glow.addColorStop(0,\`rgba(0,229,200,\${s.alpha})\`);glow.addColorStop(1,'transparent');
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(s.x,s.y,5,0,Math.PI*2);ctx.fill();
      ctx.restore();
      return true;
    });

    ctx.globalAlpha=1;
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── Init ──
loadDashboard();
</script>
</body>
</html>`;
