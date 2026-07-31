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
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<title>AnneBella — Admin Panel</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{
  --c:#00e5c8;--c2:#00b8ff;--dark:#020910;--card:#060e1c;
  --border:rgba(0,229,200,.16);--glow:rgba(0,229,200,.06);
  --text:#cce8f0;--dim:#5a8090;--red:#ff3b5c;--warn:#ffad00;
  --sidebar:68px;--header:58px;--footer:44px;--bnav:64px;
}
html,body{height:100%;overflow:hidden}
body{font-family:'Share Tech Mono',monospace;background:var(--dark);color:var(--text);display:flex;flex-direction:column}

/* ── Canvas ── */
#stars{position:fixed;inset:0;z-index:0;pointer-events:none}

/* ══════════════════════════════
   HEADER
══════════════════════════════ */
#header{
  position:relative;z-index:40;height:var(--header);flex-shrink:0;
  background:rgba(2,9,16,.92);backdrop-filter:blur(14px);
  border-bottom:1px solid var(--border);
  display:flex;align-items:center;padding:0 16px;gap:14px;
}
/* animated logo mark */
.logo-wrap{position:relative;width:36px;height:36px;flex-shrink:0}
.logo-hex{
  width:36px;height:36px;
  background:linear-gradient(135deg,var(--c),var(--c2));
  clip-path:polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%);
  display:flex;align-items:center;justify-content:center;
  animation:logo-pulse 3s ease-in-out infinite;
}
@keyframes logo-pulse{
  0%,100%{box-shadow:0 0 0 0 rgba(0,229,200,.4)}
  50%{box-shadow:0 0 0 8px rgba(0,229,200,0)}
}
.logo-letter{font-family:'Orbitron',sans-serif;font-size:14px;font-weight:900;color:#020910}
.logo-ring{
  position:absolute;inset:-4px;
  clip-path:polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%);
  background:conic-gradient(from 0deg,transparent 60%,var(--c) 80%,transparent 100%);
  animation:ring-spin 4s linear infinite;
}
@keyframes ring-spin{to{transform:rotate(360deg)}}

.brand-col{flex:1;min-width:0}
.brand-name{
  font-family:'Orbitron',sans-serif;font-size:.78rem;font-weight:900;
  color:transparent;
  background:linear-gradient(90deg,var(--c),var(--c2),var(--c));
  background-size:200% 100%;
  -webkit-background-clip:text;background-clip:text;
  animation:gradient-shift 4s linear infinite;
  letter-spacing:2px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
@keyframes gradient-shift{0%{background-position:0% 50%}100%{background-position:200% 50%}}
.brand-sub{font-size:.6rem;color:var(--dim);letter-spacing:1px;text-transform:uppercase;margin-top:1px}

.live-pill{
  display:flex;align-items:center;gap:5px;
  background:rgba(0,229,200,.08);border:1px solid rgba(0,229,200,.25);
  border-radius:20px;padding:4px 10px;flex-shrink:0;
}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--c);animation:dot-pulse 1.4s ease-in-out infinite;box-shadow:0 0 5px var(--c)}
@keyframes dot-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
.live-txt{font-size:.62rem;color:var(--c);letter-spacing:2px;font-weight:700}

/* ── page-title chip ── */
.page-chip{
  display:none;align-items:center;gap:6px;
  background:rgba(0,229,200,.06);border:1px solid var(--border);
  border-radius:6px;padding:4px 10px;font-size:.7rem;color:var(--c);letter-spacing:1px;
  white-space:nowrap;
}
@media(min-width:600px){.page-chip{display:flex}}

/* ══════════════════════════════
   BODY WRAPPER
══════════════════════════════ */
#body-wrap{flex:1;display:flex;overflow:hidden;position:relative;z-index:5}

/* ══════════════════════════════
   SIDEBAR  (desktop ≥700px)
══════════════════════════════ */
#sidebar{
  position:relative;z-index:20;
  width:var(--sidebar);min-width:var(--sidebar);
  background:rgba(2,9,16,.88);backdrop-filter:blur(14px);
  border-right:1px solid var(--border);
  display:flex;flex-direction:column;align-items:center;
  padding-top:10px;gap:2px;overflow:hidden;
  transition:width .28s cubic-bezier(.4,0,.2,1);
  flex-shrink:0;
}
#sidebar:hover{width:210px}
.nav-item{
  width:100%;display:flex;align-items:center;gap:12px;
  padding:12px 20px;cursor:pointer;position:relative;
  border-left:3px solid transparent;transition:.2s;white-space:nowrap;
}
.nav-item svg{flex-shrink:0}
.nav-item:hover{background:var(--glow);color:var(--c)}
.nav-item:hover svg{stroke:var(--c)}
.nav-item.active{background:rgba(0,229,200,.08);color:var(--c);border-left-color:var(--c)}
.nav-item.active svg{stroke:var(--c)}
.nav-item.active::after{
  content:'';position:absolute;right:0;top:20%;height:60%;width:3px;
  background:var(--c);border-radius:2px 0 0 2px;box-shadow:0 0 8px var(--c);
}
.nav-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nav-icon svg{width:18px;height:18px;stroke:var(--dim);stroke-width:1.6;fill:none;transition:.2s;stroke-linecap:round;stroke-linejoin:round}
.nav-label{font-size:.75rem;letter-spacing:1px;text-transform:uppercase;overflow:hidden;color:inherit}
.nav-divider{width:80%;height:1px;background:var(--border);margin:6px 0;flex-shrink:0}

@media(max-width:699px){#sidebar{display:none}}

/* ══════════════════════════════
   MAIN CONTENT
══════════════════════════════ */
#main{flex:1;display:flex;flex-direction:column;overflow:hidden}
#content{
  flex:1;overflow-y:auto;padding:18px;
  padding-bottom:calc(18px + var(--bnav));
  scrollbar-width:thin;scrollbar-color:var(--border) transparent;
}
@media(min-width:700px){
  #content{padding-bottom:calc(18px + var(--footer))}
}
#content::-webkit-scrollbar{width:3px}
#content::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

/* ══════════════════════════════
   BOTTOM NAV  (mobile <700px)
══════════════════════════════ */
#bnav{
  display:none;position:fixed;bottom:0;left:0;right:0;z-index:50;
  height:var(--bnav);
  background:rgba(2,9,16,.96);backdrop-filter:blur(18px);
  border-top:1px solid var(--border);
  display:none;align-items:center;justify-content:space-around;
  padding:0 4px;
}
@media(max-width:699px){#bnav{display:flex}}
.bnav-item{
  display:flex;flex-direction:column;align-items:center;gap:3px;
  flex:1;padding:6px 4px;cursor:pointer;position:relative;transition:.2s;
  border-radius:10px;margin:4px 2px;
}
.bnav-item.active{background:rgba(0,229,200,.08)}
.bnav-item.active .bnav-icon svg{stroke:var(--c)}
.bnav-item.active .bnav-label{color:var(--c)}
.bnav-item.active::before{
  content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:24px;height:2px;background:var(--c);border-radius:0 0 2px 2px;
  box-shadow:0 0 6px var(--c);
}
.bnav-icon svg{width:20px;height:20px;stroke:var(--dim);stroke-width:1.6;fill:none;stroke-linecap:round;stroke-linejoin:round;transition:.2s}
.bnav-label{font-size:.52rem;color:var(--dim);letter-spacing:.8px;text-transform:uppercase;transition:.2s}

/* ══════════════════════════════
   FOOTER  (desktop)
══════════════════════════════ */
#footer{
  display:none;height:var(--footer);flex-shrink:0;
  background:rgba(2,9,16,.88);backdrop-filter:blur(12px);
  border-top:1px solid var(--border);z-index:20;
  align-items:center;justify-content:space-between;
  padding:0 20px;font-size:.65rem;color:var(--dim);letter-spacing:.5px;
  position:relative;
}
@media(min-width:700px){#footer{display:flex}}
.footer-left{display:flex;align-items:center;gap:14px}
.footer-sep{width:1px;height:12px;background:var(--border)}
.footer-right{display:flex;align-items:center;gap:12px}
.footer-status{display:flex;align-items:center;gap:5px}
.footer-dot{width:6px;height:6px;border-radius:50%;background:var(--c);box-shadow:0 0 4px var(--c);animation:dot-pulse 2s ease-in-out infinite}
.footer-ver{
  font-family:'Orbitron',sans-serif;font-size:.58rem;letter-spacing:1px;
  color:transparent;background:linear-gradient(90deg,var(--c),var(--c2));
  -webkit-background-clip:text;background-clip:text;
}

/* ══════════════════════════════
   SECTION TABS
══════════════════════════════ */
.section{display:none;animation:fade-in .25s ease}
.section.active{display:block}
@keyframes fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

/* ══════════════════════════════
   STATS GRID
══════════════════════════════ */
.stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
@media(min-width:600px){.stats-grid{grid-template-columns:repeat(6,1fr)}}
.stat-card{
  background:var(--card);border:1px solid var(--border);border-radius:10px;
  padding:14px 12px;position:relative;overflow:hidden;cursor:default;
  transition:border-color .2s,box-shadow .2s;
}
.stat-card:hover{border-color:rgba(0,229,200,.35);box-shadow:0 0 18px rgba(0,229,200,.07)}
.stat-card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,var(--c) 50%,transparent);
  opacity:.6;
}
/* animated shimmer on shimmer border */
.stat-card::after{
  content:'';position:absolute;inset:0;border-radius:10px;
  background:linear-gradient(120deg,transparent 30%,rgba(0,229,200,.04) 50%,transparent 70%);
  background-size:200% 100%;
  animation:shimmer 3s linear infinite;
  pointer-events:none;
}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.stat-icon{position:absolute;right:10px;top:10px;opacity:.25}
.stat-icon svg{width:18px;height:18px;stroke:var(--c);stroke-width:1.6;fill:none;stroke-linecap:round;stroke-linejoin:round}
.stat-label{font-size:.6rem;color:var(--dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px}
.stat-val{
  font-family:'Orbitron',sans-serif;font-size:1.65rem;font-weight:700;
  color:var(--c);line-height:1;
  text-shadow:0 0 16px rgba(0,229,200,.45);
}

/* ══════════════════════════════
   CARDS
══════════════════════════════ */
.card{
  background:var(--card);border:1px solid var(--border);border-radius:12px;
  margin-bottom:14px;overflow:hidden;
}
.card-header{
  padding:13px 16px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
  background:rgba(0,229,200,.025);
}
.card-title{
  display:flex;align-items:center;gap:7px;
  font-size:.75rem;color:var(--c);letter-spacing:1.5px;text-transform:uppercase;font-weight:700;
}
.card-title svg{width:15px;height:15px;stroke:var(--c);stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
.card-body{padding:16px}

/* ══════════════════════════════
   FORM
══════════════════════════════ */
.form-grid{display:grid;gap:10px;grid-template-columns:1fr}
@media(min-width:500px){.form-grid.c2{grid-template-columns:1fr 1fr}}
@media(min-width:700px){.form-grid.c3{grid-template-columns:1fr 1fr 1fr}}
.form-group{display:flex;flex-direction:column;gap:5px}
label{font-size:.65rem;color:var(--dim);letter-spacing:1px;text-transform:uppercase}
input,select,textarea{
  background:rgba(0,10,22,.8);border:1px solid var(--border);border-radius:7px;
  color:var(--text);font-family:'Share Tech Mono',monospace;font-size:.85rem;
  padding:9px 12px;outline:none;transition:.2s;width:100%;
}
input:focus,select:focus,textarea:focus{border-color:var(--c);box-shadow:0 0 0 2px rgba(0,229,200,.08)}
textarea{resize:vertical;min-height:100px}
select option{background:#060e1c}

/* ══════════════════════════════
   BUTTONS
══════════════════════════════ */
.btn{
  display:inline-flex;align-items:center;gap:6px;
  padding:9px 16px;border:none;border-radius:7px;
  font-family:'Share Tech Mono',monospace;font-size:.78rem;
  cursor:pointer;transition:.15s;letter-spacing:.5px;text-transform:uppercase;
  position:relative;overflow:hidden;
}
.btn::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.06) 50%,transparent 70%);
  background-size:200% 100%;background-position:200% 0;transition:.4s;
}
.btn:hover::after{background-position:-200% 0}
.btn svg{width:14px;height:14px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
.btn-primary{background:rgba(0,229,200,.1);border:1px solid rgba(0,229,200,.35);color:var(--c)}
.btn-primary:hover{background:rgba(0,229,200,.18);border-color:var(--c);box-shadow:0 0 12px rgba(0,229,200,.18)}
.btn-danger{background:rgba(255,59,92,.08);border:1px solid rgba(255,59,92,.3);color:var(--red)}
.btn-danger:hover{background:rgba(255,59,92,.18)}
.btn-success{background:rgba(0,229,200,.08);border:1px solid rgba(0,229,200,.3);color:var(--c)}
.btn-sm{padding:5px 10px;font-size:.7rem}
.btn-full{width:100%;justify-content:center;margin-top:10px}
.spin{display:inline-block;width:12px;height:12px;border:2px solid rgba(0,229,200,.25);border-top-color:var(--c);border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* ══════════════════════════════
   TABLE
══════════════════════════════ */
.tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:.78rem;min-width:500px}
thead th{
  padding:9px 11px;text-align:left;color:var(--dim);
  border-bottom:1px solid var(--border);font-size:.65rem;letter-spacing:1.2px;text-transform:uppercase;white-space:nowrap;
}
tbody td{padding:9px 11px;border-bottom:1px solid rgba(0,229,200,.05);vertical-align:middle}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover{background:rgba(0,229,200,.04)}
.mono{font-family:'Share Tech Mono',monospace;color:#79c0ff;font-size:.76rem}

/* ══════════════════════════════
   BADGES
══════════════════════════════ */
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:.65rem;font-weight:700;letter-spacing:.5px;white-space:nowrap}
.b-on{background:rgba(0,229,200,.1);color:var(--c);border:1px solid rgba(0,229,200,.22)}
.b-off{background:rgba(90,128,144,.08);color:var(--dim);border:1px solid rgba(90,128,144,.18)}
.b-active{background:rgba(0,229,200,.08);color:var(--c);border:1px solid rgba(0,229,200,.18)}
.b-ban{background:rgba(255,59,92,.1);color:var(--red);border:1px solid rgba(255,59,92,.22)}
.b-warn{background:rgba(255,173,0,.08);color:var(--warn);border:1px solid rgba(255,173,0,.2)}
.b-used{background:rgba(90,128,144,.08);color:var(--dim);border:1px solid rgba(90,128,144,.15)}
.b-free{background:rgba(0,229,200,.08);color:var(--c);border:1px solid rgba(0,229,200,.18)}

/* ══════════════════════════════
   TOAST
══════════════════════════════ */
#toast{
  position:fixed;top:70px;right:14px;z-index:9999;
  padding:11px 16px;border-radius:8px;font-size:.78rem;
  transform:translateX(130%);transition:transform .3s cubic-bezier(.4,0,.2,1);
  max-width:300px;border:1px solid;backdrop-filter:blur(14px);
  display:flex;align-items:center;gap:8px;
}
#toast svg{width:15px;height:15px;flex-shrink:0;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}
#toast.ok{transform:translateX(0);background:rgba(0,229,200,.12);border-color:rgba(0,229,200,.35);color:var(--c)}
#toast.ok svg{stroke:var(--c)}
#toast.err{transform:translateX(0);background:rgba(255,59,92,.12);border-color:rgba(255,59,92,.35);color:var(--red)}
#toast.err svg{stroke:var(--red)}

/* ══════════════════════════════
   MISC
══════════════════════════════ */
.search-row{display:flex;gap:8px;margin-bottom:12px}
.search-row input{flex:1}
.empty{color:var(--dim);text-align:center;padding:28px 0;font-size:.78rem}
.ch-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid rgba(0,229,200,.05)}
.ch-item:last-child{border-bottom:none}
.ch-icon-box{width:36px;height:36px;border-radius:8px;background:rgba(0,229,200,.06);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ch-icon-box svg{width:16px;height:16px;stroke:var(--c);stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
.ch-info{flex:1;min-width:0}
.ch-name{font-size:.82rem;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch-id{font-size:.68rem;color:var(--dim)}
.bc-result{display:flex;gap:24px;padding:14px 0;border-top:1px solid var(--border);margin-top:10px}
.bc-stat{text-align:center;flex:1}
.bc-stat-val{font-family:'Orbitron',sans-serif;font-size:1.5rem;color:var(--c);display:block}
.bc-stat-label{font-size:.65rem;color:var(--dim);text-transform:uppercase;letter-spacing:1px}
.prog-wrap{margin-top:8px;background:rgba(0,229,200,.04);border:1px solid var(--border);border-radius:4px;height:3px;overflow:hidden}
.prog-bar{height:100%;background:linear-gradient(90deg,var(--c2),var(--c));transition:width .4s;width:0}
.panel-row-stat{display:flex;gap:4px;align-items:center}
</style>
</head>
<body>

<canvas id="stars"></canvas>

<!-- ══ HEADER ══ -->
<div id="header">
  <div class="logo-wrap">
    <div class="logo-hex"><span class="logo-letter">A</span></div>
    <div class="logo-ring"></div>
  </div>
  <div class="brand-col">
    <div class="brand-name">AnneBella Panel</div>
    <div class="brand-sub">Admin Control Centre</div>
  </div>
  <div class="page-chip" id="desk-title">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    Dashboard
  </div>
  <div class="live-pill"><div class="live-dot"></div><span class="live-txt">LIVE</span></div>
</div>

<!-- ══ BODY ══ -->
<div id="body-wrap">

  <!-- Sidebar (desktop) -->
  <nav id="sidebar">
    <div class="nav-item active" data-tab="dashboard">
      <div class="nav-icon"><svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
      <span class="nav-label">Dashboard</span>
    </div>
    <div class="nav-item" data-tab="panels">
      <div class="nav-icon"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>
      <span class="nav-label">Panels</span>
    </div>
    <div class="nav-divider"></div>
    <div class="nav-item" data-tab="users">
      <div class="nav-icon"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
      <span class="nav-label">Users</span>
    </div>
    <div class="nav-item" data-tab="giftcards">
      <div class="nav-icon"><svg viewBox="0 0 24 24"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg></div>
      <span class="nav-label">Gift Cards</span>
    </div>
    <div class="nav-divider"></div>
    <div class="nav-item" data-tab="broadcast">
      <div class="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.5 5.5l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15.35z"/></svg></div>
      <span class="nav-label">Broadcast</span>
    </div>
    <div class="nav-item" data-tab="channels">
      <div class="nav-icon"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>
      <span class="nav-label">Channels</span>
    </div>
  </nav>

  <!-- Main -->
  <div id="main">
    <div id="content">

      <!-- ── DASHBOARD ── -->
      <div class="section active" id="tab-dashboard">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>
            <div class="stat-label">Total Devices</div><div class="stat-val" id="s-devices">—</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
            <div class="stat-label">Online</div><div class="stat-val" id="s-online">—</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div>
            <div class="stat-label">Offline</div><div class="stat-val" id="s-offline">—</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
            <div class="stat-label">Total Users</div><div class="stat-val" id="s-users">—</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
            <div class="stat-label">Active Users</div><div class="stat-val" id="s-active">—</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><svg viewBox="0 0 24 24"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/></svg></div>
            <div class="stat-label">Gift Cards</div><div class="stat-val" id="s-gifts">—</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">
              <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              Panel Breakdown
            </span>
            <button class="btn btn-primary btn-sm" onclick="loadDashboard()">
              <svg viewBox="0 0 24 24" width="13" height="13"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Refresh
            </button>
          </div>
          <div class="card-body" style="padding:0">
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>#</th><th>Panel</th><th>Total</th><th>Online</th><th>Offline</th></tr></thead>
                <tbody id="panel-tbody"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- ── PANELS ── -->
      <div class="section" id="tab-panels">
        <div class="card">
          <div class="card-header">
            <span class="card-title"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Firebase Panel</span>
          </div>
          <div class="card-body">
            <div class="form-grid c2">
              <div class="form-group" style="grid-column:1/-1"><label>Panel Name</label><input id="p-name" placeholder="e.g. Main Panel"/></div>
              <div class="form-group"><label>Firebase Realtime DB URL</label><input id="p-url" placeholder="https://project-rtdb.firebaseio.com"/></div>
              <div class="form-group"><label>Secret / Auth Token</label><input id="p-secret" type="password" placeholder="Firebase Database Secret"/></div>
            </div>
            <button class="btn btn-primary btn-full" onclick="addPanel()">
              <span id="p-spin" style="display:none" class="spin"></span>
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Panel
            </button>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title"><svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>Registered Panels</span>
          </div>
          <div class="card-body" style="padding:0">
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
        <div class="search-row">
          <input id="u-search" placeholder="Search by name, @username or Telegram ID…" oninput="searchUsers()"/>
          <button class="btn btn-primary" onclick="loadUsers()"><svg viewBox="0 0 24 24" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Bot Users</span>
            <span id="user-count" style="color:var(--dim);font-size:.7rem"></span>
          </div>
          <div class="card-body" style="padding:0">
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>#</th><th>Name</th><th>TG ID</th><th>Credits</th><th>Refs</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody id="users-tbody"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- ── GIFT CARDS ── -->
      <div class="section" id="tab-giftcards">
        <div class="card">
          <div class="card-header"><span class="card-title"><svg viewBox="0 0 24 24"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>Generate Gift Card</span></div>
          <div class="card-body">
            <div class="form-grid c3">
              <div class="form-group">
                <label>Code</label>
                <div style="display:flex;gap:6px">
                  <input id="gc-code" placeholder="AUTO or custom" style="flex:1"/>
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
                <input id="gc-value" type="number" placeholder="12 hours / 500 credits"/>
              </div>
            </div>
            <button class="btn btn-primary btn-full" onclick="createGiftCard()">
              <span id="gc-spin" style="display:none" class="spin"></span>
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create Gift Card
            </button>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title"><svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>All Gift Cards</span>
            <button class="btn btn-primary btn-sm" onclick="loadGiftCards()"><svg viewBox="0 0 24 24" width="13" height="13"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
          </div>
          <div class="card-body" style="padding:0">
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Status</th><th>Used By</th><th>Created</th><th></th></tr></thead>
                <tbody id="gc-tbody"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- ── BROADCAST ── -->
      <div class="section" id="tab-broadcast">
        <div class="card">
          <div class="card-header"><span class="card-title"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.5 5.5l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15.35z"/></svg>Send Broadcast</span></div>
          <div class="card-body">
            <div class="form-group" style="margin-bottom:10px">
              <label>Message — HTML supported (&lt;b&gt; &lt;i&gt; &lt;code&gt; &lt;a href&gt;)</label>
              <textarea id="bc-msg" placeholder="Yahan apna message type karo…"></textarea>
            </div>
            <div style="font-size:.68rem;color:var(--dim);margin-bottom:10px">
              ⚠️ Banned users skip honge • Rate limit: 50ms/msg
            </div>
            <button class="btn btn-primary btn-full" id="bc-btn" onclick="doBroadcast()">
              <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Send to All Users
            </button>
            <div class="prog-wrap" id="bc-prog" style="display:none"><div class="prog-bar" id="bc-bar"></div></div>
            <div class="bc-result" id="bc-result" style="display:none">
              <div class="bc-stat"><span class="bc-stat-val" id="bc-sent">0</span><span class="bc-stat-label">Sent</span></div>
              <div class="bc-stat"><span class="bc-stat-val" id="bc-failed" style="color:var(--red)">0</span><span class="bc-stat-label">Failed</span></div>
              <div class="bc-stat"><span class="bc-stat-val" id="bc-total">0</span><span class="bc-stat-label">Total</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── CHANNELS ── -->
      <div class="section" id="tab-channels">
        <div class="card">
          <div class="card-header"><span class="card-title"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Force-Join Channel</span></div>
          <div class="card-body">
            <div class="form-grid c3">
              <div class="form-group"><label>Channel ID / @username</label><input id="ch-id" placeholder="@channelname"/></div>
              <div class="form-group"><label>Display Label</label><input id="ch-label" placeholder="AnneBella Network"/></div>
              <div class="form-group"><label>Invite URL</label><input id="ch-url" placeholder="https://t.me/channelname"/></div>
            </div>
            <button class="btn btn-primary btn-full" onclick="addChannel()">
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Channel
            </button>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Force-Join Channels</span>
            <button class="btn btn-primary btn-sm" onclick="loadChannels()"><svg viewBox="0 0 24 24" width="13" height="13"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
          </div>
          <div class="card-body" style="padding:0">
            <div id="ch-list"><div class="empty">Loading…</div></div>
          </div>
        </div>
      </div>

    </div><!-- /content -->
  </div><!-- /main -->
</div><!-- /body-wrap -->

<!-- ══ FOOTER (desktop) ══ -->
<div id="footer">
  <div class="footer-left">
    <span class="footer-ver">v2.1.0</span>
    <div class="footer-sep"></div>
    <span>AnneBella Sms Panel</span>
    <div class="footer-sep"></div>
    <span id="foot-time" style="font-family:'Share Tech Mono',monospace;letter-spacing:.5px"></span>
  </div>
  <div class="footer-right">
    <div class="footer-status"><div class="footer-dot"></div><span>Bot Online</span></div>
    <div class="footer-sep"></div>
    <span>© 2025 AnneBella</span>
  </div>
</div>

<!-- ══ BOTTOM NAV (mobile) ══ -->
<div id="bnav">
  <div class="bnav-item active" data-tab="dashboard">
    <div class="bnav-icon"><svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
    <span class="bnav-label">Stats</span>
  </div>
  <div class="bnav-item" data-tab="panels">
    <div class="bnav-icon"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div>
    <span class="bnav-label">Panels</span>
  </div>
  <div class="bnav-item" data-tab="users">
    <div class="bnav-icon"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
    <span class="bnav-label">Users</span>
  </div>
  <div class="bnav-item" data-tab="giftcards">
    <div class="bnav-icon"><svg viewBox="0 0 24 24"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/></svg></div>
    <span class="bnav-label">Gifts</span>
  </div>
  <div class="bnav-item" data-tab="broadcast">
    <div class="bnav-icon"><svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></div>
    <span class="bnav-label">Broadcast</span>
  </div>
  <div class="bnav-item" data-tab="channels">
    <div class="bnav-icon"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>
    <span class="bnav-label">Channels</span>
  </div>
</div>

<div id="toast">
  <svg id="toast-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
  <span id="toast-msg"></span>
</div>

<script>
const B=window.location.origin;
let _tt;

/* ── Toast ── */
function toast(msg,ok=true){
  clearTimeout(_tt);
  const t=document.getElementById('toast');
  const ico=document.getElementById('toast-icon');
  document.getElementById('toast-msg').textContent=msg;
  t.className=ok?'ok':'err';
  // swap icon
  ico.innerHTML=ok
    ?'<polyline points="20 6 9 17 4 12"/>'
    :'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';
  _tt=setTimeout(()=>t.className='',3500);
}

/* ── Footer clock ── */
function tick(){
  const n=new Date();
  document.getElementById('foot-time').textContent=n.toLocaleTimeString('en-GB');
}
setInterval(tick,1000);tick();

/* ── Navigation ── */
const TAB_TITLES={
  dashboard:'Dashboard',panels:'Firebase Panels',
  users:'Bot Users',giftcards:'Gift Cards',
  broadcast:'Broadcast',channels:'Channels'
};
const TAB_ICONS={
  dashboard:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  panels:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
  giftcards:'<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/>',
  broadcast:'<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  channels:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
};
function switchTab(tab){
  document.querySelectorAll('.nav-item,.bnav-item').forEach(n=>{
    n.classList.toggle('active', n.dataset.tab===tab);
  });
  document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active',s.id==='tab-'+tab));
  const dc=document.getElementById('desk-title');
  dc.innerHTML=\`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\${TAB_ICONS[tab]}</svg>\${TAB_TITLES[tab]}\`;
  if(tab==='dashboard') loadDashboard();
  if(tab==='panels')    loadPanels();
  if(tab==='users')     loadUsers();
  if(tab==='giftcards') loadGiftCards();
  if(tab==='channels')  loadChannels();
}
document.querySelectorAll('.nav-item,.bnav-item').forEach(n=>{
  n.addEventListener('click',()=>switchTab(n.dataset.tab));
});

function esc(s){const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML;}

/* ──────────────────────
   COUNT-UP ANIMATION
────────────────────── */
function countUp(el,target,dur=800){
  const start=performance.now();
  const from=parseInt(el.textContent)||0;
  function step(now){
    const p=Math.min((now-start)/dur,1);
    const ease=1-Math.pow(1-p,3);
    el.textContent=Math.round(from+(target-from)*ease);
    if(p<1)requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── DASHBOARD ── */
async function loadDashboard(){
  try{
    const d=await(await fetch(B+'/api/dashboard')).json();
    countUp(document.getElementById('s-devices'),d.totalDevices??0);
    countUp(document.getElementById('s-online'),d.onlineDevices??0);
    countUp(document.getElementById('s-offline'),d.offlineDevices??0);
    countUp(document.getElementById('s-users'),d.totalUsers??0);
    countUp(document.getElementById('s-active'),d.activeUsers??0);
    countUp(document.getElementById('s-gifts'),d.totalGiftCards??0);
    const tb=document.getElementById('panel-tbody');
    if(!d.panelBreakdown?.length){tb.innerHTML='<tr><td colspan="5" class="empty">No panels configured</td></tr>';return;}
    tb.innerHTML=d.panelBreakdown.map((p,i)=>\`
      <tr>
        <td class="mono" style="color:var(--dim)">\${i+1}</td>
        <td><b>\${esc(p.panelName)}</b></td>
        <td>\${p.total}</td>
        <td><span class="badge b-on">\${p.online}</span></td>
        <td><span class="badge b-off">\${p.offline}</span></td>
      </tr>
    \`).join('');
  }catch(e){toast('Dashboard load failed',false);}
}

/* ── PANELS ── */
async function loadPanels(){
  try{
    const panels=await(await fetch(B+'/api/panels')).json();
    const tb=document.getElementById('panels-tbody');
    if(!panels.length){tb.innerHTML='<tr><td colspan="5" class="empty">No panels yet</td></tr>';return;}
    tb.innerHTML=panels.map((p,i)=>\`
      <tr>
        <td class="mono" style="color:var(--dim)">\${i+1}</td>
        <td><b>\${esc(p.name)}</b></td>
        <td class="mono" style="max-width:180px;overflow:hidden;text-overflow:ellipsis">\${esc(p.firebaseUrl)}</td>
        <td style="color:var(--dim);font-size:.72rem">\${new Date(p.createdAt).toLocaleDateString()}</td>
        <td><button class="btn btn-danger btn-sm" onclick="delPanel(\${p.id},this)">
          <svg viewBox="0 0 24 24" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Del</button></td>
      </tr>
    \`).join('');
  }catch{toast('Panels load failed',false);}
}
async function addPanel(){
  const name=document.getElementById('p-name').value.trim();
  const url=document.getElementById('p-url').value.trim();
  const secret=document.getElementById('p-secret').value.trim();
  if(!name||!url||!secret){toast('All fields required',false);return;}
  const sp=document.getElementById('p-spin');sp.style.display='';
  try{
    const r=await fetch(B+'/api/panels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,firebaseUrl:url,secretKey:secret})});
    if(r.ok){toast('Panel added ✓');['p-name','p-url','p-secret'].forEach(id=>document.getElementById(id).value='');loadPanels();loadDashboard();}
    else{const e=await r.json();toast('Error: '+(e.error||r.status),false);}
  }catch{toast('Network error',false);}
  finally{sp.style.display='none';}
}
async function delPanel(id,btn){
  if(!confirm('Delete this panel?'))return;
  btn.disabled=true;
  try{
    const r=await fetch(B+'/api/panels/'+id,{method:'DELETE'});
    if(r.ok){toast('Panel deleted');loadPanels();loadDashboard();}
    else{toast('Delete failed',false);}
  }catch{toast('Network error',false);}
  finally{btn.disabled=false;}
}

/* ── USERS ── */
let _all=[];
async function loadUsers(){
  try{
    _all=await(await fetch(B+'/api/users')).json();
    renderUsers(_all);
  }catch{toast('Users load failed',false);}
}
function searchUsers(){
  const q=document.getElementById('u-search').value.toLowerCase();
  renderUsers(_all.filter(u=>(u.firstName||'').toLowerCase().includes(q)||(u.username||'').toLowerCase().includes(q)||(u.telegramId||'').includes(q)));
}
function renderUsers(users){
  document.getElementById('user-count').textContent=users.length+' users';
  const tb=document.getElementById('users-tbody');
  if(!users.length){tb.innerHTML='<tr><td colspan="7" class="empty">No users</td></tr>';return;}
  tb.innerHTML=users.map((u,i)=>{
    const banned=u.isBanned;
    const active=u.getNumberExpiresAt&&new Date(u.getNumberExpiresAt)>new Date();
    return \`<tr>
      <td class="mono" style="color:var(--dim)">\${i+1}</td>
      <td>
        <div style="font-size:.82rem;font-weight:700">\${esc(u.firstName)}</div>
        <div style="color:var(--dim);font-size:.68rem">\${u.username?'@'+esc(u.username):''}</div>
      </td>
      <td class="mono">\${esc(u.telegramId)}</td>
      <td style="color:var(--c);font-weight:700">\${u.smsCredits||0}</td>
      <td style="color:var(--dim)">\${u.referralCount||0}</td>
      <td><span class="badge \${banned?'b-ban':active?'b-active':'b-off'}">\${banned?'Banned':active?'Active':'Inactive'}</span></td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn-sm \${banned?'btn-success':'btn-danger'}" onclick="toggleBan(\${u.id},\${!!banned},this)">\${banned?'Unban':'Ban'}</button>
          <button class="btn btn-primary btn-sm" onclick="addCredits(\${u.id})">+Cr</button>
        </div>
      </td>
    </tr>\`;
  }).join('');
}
async function toggleBan(id,isBanned,btn){
  btn.disabled=true;
  try{
    const r=await fetch(B+'/api/users/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({isBanned:!isBanned})});
    if(r.ok){toast(isBanned?'User unbanned':'User banned ✓');loadUsers();}
    else toast('Action failed',false);
  }catch{toast('Network error',false);}
  finally{btn.disabled=false;}
}
async function addCredits(id){
  const amt=parseInt(prompt('Add SMS Credits:'));
  if(isNaN(amt)||amt<=0)return;
  const u=_all.find(x=>x.id===id);
  try{
    const r=await fetch(B+'/api/users/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({smsCredits:(u?.smsCredits||0)+amt})});
    if(r.ok){toast(\`+\${amt} credits added\`);loadUsers();}
    else toast('Failed',false);
  }catch{toast('Network error',false);}
}

/* ── GIFT CARDS ── */
function genCode(){
  const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s='';
  for(let i=0;i<12;i++){if(i&&i%4===0)s+='-';s+=c[Math.floor(Math.random()*c.length)];}
  document.getElementById('gc-code').value=s;
}
async function createGiftCard(){
  let code=document.getElementById('gc-code').value.trim();
  const type=document.getElementById('gc-type').value;
  const value=parseInt(document.getElementById('gc-value').value);
  if(!code||isNaN(value)||value<=0){toast('Fill all fields',false);return;}
  if(code.toUpperCase()==='AUTO'){genCode();code=document.getElementById('gc-code').value;}
  const sp=document.getElementById('gc-spin');sp.style.display='';
  try{
    const r=await fetch(B+'/api/gift-cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,type,value})});
    if(r.ok){const c2=await r.json();toast('Card created: '+c2.code);['gc-code','gc-value'].forEach(id=>document.getElementById(id).value='');loadGiftCards();}
    else{const e=await r.json();toast(e.error||'Error',false);}
  }catch{toast('Network error',false);}
  finally{sp.style.display='none';}
}
async function loadGiftCards(){
  try{
    const cards=await(await fetch(B+'/api/gift-cards')).json();
    const tb=document.getElementById('gc-tbody');
    if(!cards.length){tb.innerHTML='<tr><td colspan="7" class="empty">No gift cards</td></tr>';return;}
    tb.innerHTML=cards.map(c=>\`
      <tr>
        <td class="mono" style="color:var(--c);letter-spacing:2px">\${esc(c.code)}</td>
        <td><span class="badge b-active">\${c.type}</span></td>
        <td>\${c.value} \${c.type==='hours'?'hrs':'cr'}</td>
        <td><span class="badge \${c.usedBy?'b-used':'b-free'}">\${c.usedBy?'Used':'Free'}</span></td>
        <td class="mono" style="color:var(--dim);font-size:.7rem">\${esc(c.usedBy||'—')}</td>
        <td style="color:var(--dim);font-size:.72rem">\${new Date(c.createdAt).toLocaleDateString()}</td>
        <td>\${!c.usedBy?'<button class="btn btn-danger btn-sm" onclick="delCard('+c.id+',this)"><svg viewBox="0 0 24 24" width="11" height="11"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>':'—'}</td>
      </tr>
    \`).join('');
  }catch{toast('Gift cards load failed',false);}
}
async function delCard(id,btn){
  if(!confirm('Delete this card?'))return;
  btn.disabled=true;
  try{
    const r=await fetch(B+'/api/gift-cards/'+id,{method:'DELETE'});
    if(r.ok){toast('Card deleted');loadGiftCards();}
    else toast('Failed',false);
  }catch{toast('Network error',false);}
  finally{btn.disabled=false;}
}

/* ── BROADCAST ── */
async function doBroadcast(){
  const msg=document.getElementById('bc-msg').value.trim();
  if(!msg){toast('Message is required',false);return;}
  if(!confirm('Sabhi active users ko message bhejein?'))return;
  const btn=document.getElementById('bc-btn');
  btn.disabled=true;btn.innerHTML='<span class="spin"></span> Sending…';
  document.getElementById('bc-prog').style.display='block';
  document.getElementById('bc-bar').style.width='25%';
  document.getElementById('bc-result').style.display='none';
  try{
    const r=await fetch(B+'/api/broadcast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
    document.getElementById('bc-bar').style.width='100%';
    if(r.ok){
      const d=await r.json();
      document.getElementById('bc-sent').textContent=d.sent;
      document.getElementById('bc-failed').textContent=d.failed;
      document.getElementById('bc-total').textContent=d.total;
      document.getElementById('bc-result').style.display='flex';
      toast('Broadcast done: '+d.sent+' sent');
    }else toast('Broadcast failed',false);
  }catch{toast('Network error',false);}
  finally{btn.disabled=false;btn.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send to All Users';}
}

/* ── CHANNELS ── */
async function loadChannels(){
  try{
    const chs=await(await fetch(B+'/api/channels')).json();
    const el=document.getElementById('ch-list');
    if(!chs.length){el.innerHTML='<div class="empty">No channels configured</div>';return;}
    el.innerHTML=chs.map(c=>\`
      <div class="ch-item">
        <div class="ch-icon-box"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.5 5.5l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15.35z"/></svg></div>
        <div class="ch-info">
          <div class="ch-name">\${esc(c.label)}</div>
          <div class="ch-id">\${esc(c.id)} · <a href="\${esc(c.url)}" target="_blank" style="color:var(--c)">\${esc(c.url)}</a></div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="delChannel('\${esc(c.id)}',this)"><svg viewBox="0 0 24 24" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
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
    if(r.ok){toast('Channel added');['ch-id','ch-label','ch-url'].forEach(i=>document.getElementById(i).value='');loadChannels();}
    else{const e=await r.json();toast(e.error||'Error',false);}
  }catch{toast('Network error',false);}
}
async function delChannel(id,btn){
  if(!confirm('Remove from force-join?'))return;
  btn.disabled=true;
  try{
    const r=await fetch(B+'/api/channels/'+encodeURIComponent(id),{method:'DELETE'});
    if(r.ok){toast('Channel removed');loadChannels();}
    else toast('Failed',false);
  }catch{toast('Network error',false);}
  finally{btn.disabled=false;}
}

/* ══════════════════════════════
   STARFIELD CANVAS
══════════════════════════════ */
(function(){
  const cv=document.getElementById('stars'),ctx=cv.getContext('2d');
  let W,H,stars=[],shots=[];

  function resize(){
    W=cv.width=window.innerWidth;H=cv.height=window.innerHeight;
    // respawn stars on resize
    if(stars.length===0){
      for(let i=0;i<260;i++) stars.push(mkStar());
    }
  }
  window.addEventListener('resize',resize);

  function mkStar(){
    return{
      x:Math.random()*(window.innerWidth||800),
      y:Math.random()*(window.innerHeight||600),
      r:Math.random()*1.2+.15,
      a:Math.random(),
      da:(.003+Math.random()*.009)*(Math.random()<.5?1:-1)
    };
  }

  // nebula (cached image)
  let nebCanvas=null;
  function buildNebula(){
    nebCanvas=document.createElement('canvas');
    nebCanvas.width=W;nebCanvas.height=H;
    const c=nebCanvas.getContext('2d');
    [{x:.12,y:.18,r:.28,col:'rgba(0,50,120,.2)'},{x:.78,y:.72,r:.32,col:'rgba(0,70,100,.16)'},{x:.5,y:.45,r:.44,col:'rgba(0,25,55,.12)'}].forEach(b=>{
      const gx=b.x*W,gy=b.y*H,gr=Math.min(W,H)*b.r;
      const g=c.createRadialGradient(gx,gy,0,gx,gy,gr);
      g.addColorStop(0,b.col);g.addColorStop(1,'transparent');
      c.fillStyle=g;c.beginPath();c.arc(gx,gy,gr,0,Math.PI*2);c.fill();
    });
  }

  function spawnShot(){
    if(Math.random()<.012&&shots.length<6){
      shots.push({x:Math.random()*W*.85,y:Math.random()*H*.35,dx:3+Math.random()*5,dy:1.5+Math.random()*3,a:1});
    }
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    if(nebCanvas) ctx.drawImage(nebCanvas,0,0);

    stars.forEach(s=>{
      s.a+=s.da;
      if(s.a>=1||s.a<=0)s.da*=-1;
      ctx.globalAlpha=Math.max(0,Math.min(1,s.a))*.75+.1;
      ctx.fillStyle='#aee0f5';
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
    });

    spawnShot();
    shots=shots.filter(s=>{
      s.x+=s.dx;s.y+=s.dy;s.a-=.016;
      if(s.a<=0)return false;
      ctx.save();
      const len=12;
      const g=ctx.createLinearGradient(s.x-s.dx*len,s.y-s.dy*len,s.x,s.y);
      g.addColorStop(0,'transparent');
      g.addColorStop(1,\`rgba(0,229,200,\${s.a})\`);
      ctx.strokeStyle=g;ctx.lineWidth=1.4;ctx.globalAlpha=s.a;
      ctx.beginPath();ctx.moveTo(s.x-s.dx*len,s.y-s.dy*len);ctx.lineTo(s.x,s.y);ctx.stroke();
      // head glow
      const hg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,4);
      hg.addColorStop(0,\`rgba(0,229,200,\${s.a*.8})\`);hg.addColorStop(1,'transparent');
      ctx.fillStyle=hg;ctx.beginPath();ctx.arc(s.x,s.y,4,0,Math.PI*2);ctx.fill();
      ctx.restore();
      return true;
    });

    ctx.globalAlpha=1;
    requestAnimationFrame(draw);
  }

  resize();
  buildNebula();
  draw();
})();

/* ── Init ── */
loadDashboard();
</script>
</body>
</html>`;
