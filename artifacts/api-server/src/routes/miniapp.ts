import { Router, type IRouter } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, botUsersTable } from "@workspace/db";
import { verifyMiniAppLicense } from "../lib/miniAppLicense";

const router: IRouter = Router();
const FREE_START_CREDITS = 100;
const NUMBER_PURCHASE_CREDITS = 5;
const WEB_PANEL_MIN_CREDITS = 1000;

function verifyTelegramInitData(initData: string): { ok: boolean; user?: TelegramMiniUser; error?: string } {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false, error: "Bot token is not configured" };
  if (!initData) return { ok: false, error: "Telegram init data missing" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "Telegram hash missing" };
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const a = Buffer.from(calculated);
  const b = Buffer.from(hash);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) return { ok: false, error: "Telegram init data is invalid" };

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, error: "Telegram user missing" };
  try {
    const user = JSON.parse(userRaw) as TelegramMiniUser;
    return { ok: true, user };
  } catch {
    return { ok: false, error: "Telegram user data is invalid" };
  }
}

type TelegramMiniUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

function referralCode(id: string): string {
  return `AB${id.slice(-6)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

router.get("/miniapp", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(MINIAPP_HTML_V2);
});

router.post("/miniapp/api/profile", async (req, res): Promise<void> => {
  const initData = typeof req.body?.initData === "string" ? req.body.initData : "";
  const license = typeof req.body?.license === "string" ? req.body.license.trim() : "";
  const verified = verifyTelegramInitData(initData);
  if (!verified.ok || !verified.user) {
    res.status(401).json({ error: verified.error || "Telegram verification failed" });
    return;
  }

  const telegramId = String(verified.user.id);
  const licenseResult = verifyMiniAppLicense(license, telegramId);
  if (!licenseResult.ok) {
    res.status(403).json({ error: licenseResult.error });
    return;
  }

  let [user] = await db.select().from(botUsersTable).where(eq(botUsersTable.telegramId, telegramId));
  if (!user) {
    [user] = await db
      .insert(botUsersTable)
      .values({
        telegramId,
        username: verified.user.username || null,
        firstName: verified.user.first_name || "User",
        referralCode: referralCode(telegramId),
        smsCredits: FREE_START_CREDITS,
      })
      .returning();
  }

  res.json({
    id: user.id,
    telegramId: user.telegramId,
    firstName: user.firstName,
    username: user.username,
    referralCode: user.referralCode,
    referralCount: user.referralCount,
    smsCredits: user.smsCredits,
    canGetNumber: user.smsCredits >= NUMBER_PURCHASE_CREDITS,
    canOpenWebPanel: user.smsCredits >= WEB_PANEL_MIN_CREDITS,
    sendSmsUnlocked: user.sendSmsUnlocked,
    assignedDeviceId: user.assignedDeviceId,
    assignedPanelId: user.assignedPanelId,
    createdAt: user.createdAt.toISOString(),
    isBanned: user.isBanned,
    licenseExpiresAt: licenseResult.expiresAt.toISOString(),
  });
});

const MINIAPP_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<meta name="theme-color" content="#020910"/>
<title>AnneBella Mini App</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800&family=Share+Tech+Mono&display=swap');
:root{--bg:#020910;--panel:#071222;--card:#08182a;--line:rgba(0,229,200,.18);--c:#00e5c8;--c2:#40a9ff;--txt:#e8fbff;--dim:#75a1b4;--red:#ff3b5c}
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;background:radial-gradient(circle at 50% -10%,rgba(0,229,200,.16),transparent 35%),var(--bg);color:var(--txt);font-family:'Share Tech Mono',monospace;letter-spacing:.3px;overflow-x:hidden}
.wrap{max-width:520px;margin:0 auto;min-height:100vh;padding:14px 12px 86px;position:relative}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.brand{display:flex;align-items:center;gap:10px}
.logo{width:42px;height:42px;border-radius:50%;background:linear-gradient(145deg,#0b2e66,#031326);border:1px solid rgba(64,169,255,.55);display:grid;place-items:center;color:#9fd7ff;font-family:Orbitron;font-weight:800;font-size:22px;box-shadow:0 0 18px rgba(64,169,255,.18)}
.brand h1{font-family:Orbitron,sans-serif;font-size:15px;letter-spacing:2.5px;color:var(--c);line-height:1}
.brand p{font-size:9px;letter-spacing:2px;color:var(--dim);text-transform:uppercase;margin-top:4px}
.pill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:6px 9px;color:var(--c);font-size:10px;text-transform:uppercase;background:rgba(0,229,200,.06)}
.dot{width:6px;height:6px;border-radius:50%;background:var(--c);box-shadow:0 0 8px var(--c)}
.hero{border:1px solid var(--line);background:linear-gradient(180deg,rgba(0,229,200,.08),rgba(3,13,24,.82));border-radius:14px;padding:16px;margin-bottom:12px;position:relative;overflow:hidden}
.hero:before{content:'';position:absolute;inset:0;background:linear-gradient(120deg,transparent 25%,rgba(255,255,255,.05) 45%,transparent 65%);background-size:220% 100%;animation:shine 4s linear infinite;pointer-events:none}
@keyframes shine{to{background-position:-220% 0}}
.user{display:flex;align-items:center;justify-content:space-between;gap:12px}
.avatar{width:48px;height:48px;border-radius:14px;border:1px solid var(--line);background:rgba(0,10,22,.72);display:grid;place-items:center;font-family:Orbitron;color:var(--c);font-size:20px;overflow:hidden}
.avatar img{width:100%;height:100%;object-fit:cover}
.hello{min-width:0;flex:1}.hello b{display:block;color:var(--txt);font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hello span{display:block;color:var(--dim);font-size:11px;margin-top:3px}
.credits{text-align:right}.credits b{font-family:Orbitron;color:var(--c);font-size:22px}.credits span{display:block;color:var(--dim);font-size:9px;text-transform:uppercase;letter-spacing:1.5px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin:12px 0}
.stat,.card{border:1px solid var(--line);border-radius:12px;background:rgba(7,18,34,.78);padding:13px}
.stat label{display:block;color:var(--dim);font-size:9px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:7px}.stat strong{font-family:Orbitron;color:var(--c);font-size:18px}
.actions{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}
button{border:1px solid rgba(0,229,200,.34);background:rgba(0,229,200,.08);color:var(--c);border-radius:10px;padding:12px 10px;font-family:'Share Tech Mono',monospace;text-transform:uppercase;letter-spacing:1px;font-weight:700;font-size:11px}
button.blue{border-color:rgba(64,169,255,.45);color:#8bd1ff;background:rgba(64,169,255,.08)}
button.red{border-color:rgba(255,59,92,.4);color:var(--red);background:rgba(255,59,92,.08)}
.title{display:flex;align-items:center;justify-content:space-between;color:var(--c);font-size:11px;text-transform:uppercase;letter-spacing:1.7px;margin-bottom:10px;font-weight:700}
.num{font-family:Orbitron;color:var(--c);font-size:20px;margin:6px 0}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;color:var(--dim);font-size:11px}.meta b{color:var(--txt);font-weight:400}
.sms{max-height:220px;overflow:auto}.sms-item{padding:10px 0;border-top:1px solid rgba(0,229,200,.09)}.sms-item:first-child{border-top:0}.sms-head{display:flex;justify-content:space-between;gap:8px;color:var(--c);font-size:11px}.sms-body{white-space:pre-wrap;color:var(--txt);font-size:12px;line-height:1.45;margin-top:5px}
.nav{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);width:min(496px,calc(100% - 20px));height:62px;border:1px solid var(--line);border-radius:16px;background:rgba(2,9,16,.92);backdrop-filter:blur(16px);display:grid;grid-template-columns:repeat(4,1fr);padding:7px;gap:6px}
.nav button{padding:7px 3px;border-radius:11px;font-size:9px}
.empty{color:var(--dim);font-size:12px;text-align:center;padding:18px 6px}
.locked{border:1px solid rgba(255,59,92,.42);background:rgba(255,59,92,.08);color:var(--red);border-radius:14px;padding:15px;margin-bottom:12px;text-align:center}
.locked b{display:block;font-family:Orbitron,sans-serif;letter-spacing:1.5px;margin-bottom:7px}.locked span{display:block;color:var(--dim);font-size:12px;line-height:1.5}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div class="brand"><div class="logo">V</div><div><h1>ANNEBELLA</h1><p>SMS MINI APP</p></div></div>
    <div class="pill"><span class="dot"></span><span id="tg-state">LIVE</span></div>
  </div>
  <section class="hero">
    <div class="user">
      <div class="avatar" id="avatar">A</div>
      <div class="hello"><b id="name">Welcome</b><span id="username">Telegram verified mini app</span></div>
      <div class="credits"><b id="credits">--</b><span>Credits</span></div>
    </div>
  </section>
  <div class="locked" id="lock-box" style="display:none"><b>MINI APP LOCKED</b><span>Open Web Panel from bot dashboard to generate a 1 month license.</span><button class="red" onclick="openBot('web_panel')" style="margin-top:12px;width:100%">Get License</button></div>
  <div class="grid">
    <div class="stat"><label>Get Number</label><strong id="number-status">--</strong></div>
    <div class="stat"><label>Web Panel</label><strong id="panel-status">--</strong></div>
    <div class="stat"><label>Send SMS</label><strong id="send-status">--</strong></div>
    <div class="stat"><label>Referrals</label><strong id="refs">--</strong></div>
  </div>
  <div class="card">
    <div class="title">Quick Actions</div>
    <div class="actions">
      <button onclick="openBot('get_number')">Get Number</button>
      <button class="blue" onclick="openBot('buy_credit')">Buy Credit</button>
      <button class="blue" onclick="openBot('refer')">Refer Earn</button>
      <button class="red" onclick="openBot('support')">Support</button>
    </div>
  </div>
  <div class="card">
    <div class="title">Current Number <button class="blue" onclick="openBot('live_sms')" style="padding:6px 8px;font-size:9px">Open Bot</button></div>
    <div id="number-box"><div class="empty">No active number loaded. Use Get Number from bot.</div></div>
  </div>
  <div class="card">
    <div class="title">Recent SMS</div>
    <div class="sms" id="sms-box"><div class="empty">Live OTP and SMS will appear in bot. Mini app is ready for your user dashboard.</div></div>
  </div>
</div>
<div class="nav">
  <button onclick="scrollTo(0,0)">Home</button>
  <button onclick="openBot('get_number')">Number</button>
  <button onclick="openBot('buy_credit')">Credit</button>
  <button onclick="openBot('profile')">Profile</button>
</div>
<script>
const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand();document.documentElement.style.setProperty('--bg',tg.themeParams?.bg_color||'#020910');}
const BOT='Annebellasmsbot';
function esc(s){const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML;}
function setText(id,v){document.getElementById(id).textContent=v;}
function openBot(cmd){const url='https://t.me/'+BOT+'?start='+encodeURIComponent(cmd); if(tg?.openTelegramLink)tg.openTelegramLink(url);else location.href=url;}
function lock(msg){document.getElementById('lock-box').style.display='block';document.querySelectorAll('.actions button,.nav button').forEach(b=>{if(!String(b.getAttribute('onclick')).includes('web_panel'))b.disabled=true});setText('tg-state','LOCKED');if(msg)document.querySelector('#lock-box span').textContent=msg;}
async function loadProfile(){
  const initData=tg?.initData||'';
  const urlLicense=new URLSearchParams(location.search).get('license');
  if(urlLicense)localStorage.setItem('annebella-mini-license',urlLicense);
  const license=urlLicense||localStorage.getItem('annebella-mini-license')||'';
  const tgu=tg?.initDataUnsafe?.user;
  if(tgu){setText('name',tgu.first_name||'Telegram User');setText('username',tgu.username?'@'+tgu.username:'Telegram user');if(tgu.photo_url)document.getElementById('avatar').innerHTML='<img src="'+esc(tgu.photo_url)+'"/>';else document.getElementById('avatar').textContent=(tgu.first_name||'A').slice(0,1).toUpperCase();}
  if(!initData){lock('Open this mini app inside Telegram.');return;}
  if(!license){lock('Open Web Panel from bot dashboard to generate a 1 month license.');return;}
  try{
    const r=await fetch('/miniapp/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData,license})});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Profile failed');
    setText('name',d.firstName||'User');setText('username',d.username?'@'+d.username:'ID '+d.telegramId);setText('credits',d.smsCredits||0);setText('number-status',d.canGetNumber?'READY':'LOW');setText('panel-status',d.canOpenWebPanel?'READY':'LOCKED');setText('send-status',d.sendSmsUnlocked?'READY':'LOCKED');setText('refs',d.referralCount||0);
    document.getElementById('lock-box').style.display='none';
    if(d.assignedDeviceId){document.getElementById('number-box').innerHTML='<div class="num">'+esc(d.assignedDeviceId)+'</div><div class="meta"><span>Panel <b>'+esc(d.assignedPanelId||'--')+'</b></span><span>Credits <b>'+esc(d.smsCredits||0)+'</b></span></div>';}
  }catch(e){lock(e.message||'Mini app license required.');}
}
loadProfile();
</script>
</body>
</html>`;

const MINIAPP_HTML_V2 = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<meta name="theme-color" content="#020910"/>
<title>AnneBella Mini App</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800&family=Share+Tech+Mono&display=swap');
:root{--bg:#020910;--card:#071423;--card2:#0b1b2d;--line:rgba(0,229,200,.20);--c:#00e5c8;--b:#40a9ff;--txt:#e8fbff;--dim:#7fa9ba;--red:#ff3b5c}
*{box-sizing:border-box;margin:0;padding:0}html,body{background:#020910!important;color:var(--txt);font-family:'Share Tech Mono',monospace;letter-spacing:.4px}body{min-height:100vh;overflow-x:hidden}
body:before{content:'';position:fixed;inset:0;background:radial-gradient(circle at 50% -10%,rgba(0,229,200,.18),transparent 34%),linear-gradient(180deg,#020910,#04101d 55%,#020910);z-index:-2}
.wrap{max-width:560px;margin:0 auto;min-height:100vh;padding:14px 12px 86px}.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.brand{display:flex;align-items:center;gap:10px}.logo{width:44px;height:44px;border-radius:50%;background:linear-gradient(145deg,#0b3b77,#031326);border:1px solid rgba(64,169,255,.65);display:grid;place-items:center;color:#b8e4ff;font-family:Orbitron;font-weight:800;font-size:23px;box-shadow:0 0 18px rgba(64,169,255,.2)}.brand h1{font-family:Orbitron,sans-serif;font-size:15px;letter-spacing:2.7px;color:var(--c)}.brand p{font-size:9px;letter-spacing:2px;color:var(--dim);text-transform:uppercase}.pill{border:1px solid var(--line);border-radius:999px;padding:6px 10px;color:var(--c);font-size:10px;text-transform:uppercase;background:rgba(0,229,200,.06)}
.hero,.card,.stat{border:1px solid var(--line);background:rgba(7,20,35,.88);border-radius:14px}.hero{padding:15px;margin-bottom:12px;background:linear-gradient(180deg,rgba(0,229,200,.10),rgba(7,20,35,.88))}.user{display:flex;align-items:center;gap:12px}.avatar{width:52px;height:52px;border-radius:14px;border:1px solid var(--line);background:#061321;display:grid;place-items:center;font-family:Orbitron;color:var(--c);font-size:22px;overflow:hidden}.avatar img{width:100%;height:100%;object-fit:cover}.hello{flex:1;min-width:0}.hello b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hello span{display:block;color:var(--dim);font-size:11px;margin-top:4px}.credits{text-align:right}.credits b{font-family:Orbitron;color:var(--c);font-size:21px}.credits span{display:block;color:var(--dim);font-size:9px;text-transform:uppercase;letter-spacing:1.5px}
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-bottom:12px}.stat{padding:13px;min-height:90px}.stat label{display:block;color:var(--dim);font-size:9px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px}.stat strong{font-family:Orbitron;color:var(--c);font-size:24px}.card{padding:14px;margin-bottom:12px}.title{display:flex;align-items:center;justify-content:space-between;color:var(--c);font-size:11px;text-transform:uppercase;letter-spacing:1.7px;margin-bottom:11px;font-weight:700}.page{display:none}.page.active{display:block}.actions,.two{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}button{border:1px solid rgba(0,229,200,.35);background:rgba(0,229,200,.08);color:var(--c);border-radius:10px;padding:11px 9px;font-family:'Share Tech Mono',monospace;text-transform:uppercase;letter-spacing:1px;font-weight:700;font-size:11px}button.blue{border-color:rgba(64,169,255,.45);color:#8bd1ff;background:rgba(64,169,255,.08)}button.red{border-color:rgba(255,59,92,.42);color:var(--red);background:rgba(255,59,92,.08)}button:disabled{opacity:.45}
input,select,textarea{width:100%;border:1px solid var(--line);border-radius:10px;background:rgba(0,10,22,.85);color:var(--txt);font-family:'Share Tech Mono',monospace;padding:11px;outline:none}textarea{min-height:86px;resize:vertical}.field{display:flex;flex-direction:column;gap:6px;margin-bottom:9px}.field label{color:var(--dim);font-size:9px;text-transform:uppercase;letter-spacing:1.5px}.detail{border:1px solid rgba(0,229,200,.16);border-radius:12px;background:rgba(0,229,200,.035);padding:13px;margin:10px 0}.num{font-family:Orbitron;color:var(--c);font-size:22px;word-break:break-all}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px;color:var(--dim);font-size:11px}.meta b{color:var(--txt);font-weight:400}
.list{max-height:260px;overflow:auto}.row{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid rgba(0,229,200,.08);padding:10px 0}.row:first-child{border-top:0}.mono{font-family:'Share Tech Mono',monospace;color:var(--c);word-break:break-all}.small{font-size:11px;color:var(--dim);line-height:1.45}.sms-tools{display:grid;grid-template-columns:1fr .7fr;gap:8px;margin-bottom:9px}.sms-list{max-height:430px;overflow:auto;border:1px solid var(--line);border-radius:12px;background:rgba(0,10,22,.36)}.sms-item{padding:12px;border-top:1px solid rgba(0,229,200,.08)}.sms-item:first-child{border-top:0}.sms-head{display:flex;justify-content:space-between;gap:8px;color:var(--c);font-size:11px}.sms-body{white-space:pre-wrap;color:var(--txt);font-size:12px;line-height:1.45;margin-top:6px}.lock{border:1px solid rgba(255,59,92,.42);background:rgba(255,59,92,.08);color:var(--red);border-radius:14px;padding:15px;margin-bottom:12px;text-align:center}.lock b{display:block;font-family:Orbitron,sans-serif;letter-spacing:1.5px;margin-bottom:8px}.empty{color:var(--dim);font-size:12px;text-align:center;padding:18px 6px}
.nav{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);width:min(536px,calc(100% - 20px));height:64px;border:1px solid var(--line);border-radius:16px;background:rgba(2,9,16,.94);backdrop-filter:blur(16px);display:grid;grid-template-columns:repeat(4,1fr);padding:7px;gap:6px}.nav button{padding:7px 3px;border-radius:11px;font-size:9px}.nav button.active{background:rgba(0,229,200,.18);box-shadow:0 0 14px rgba(0,229,200,.12)}
</style>
</head>
<body>
<div class="wrap">
  <div class="top"><div class="brand"><div class="logo">V</div><div><h1>ANNEBELLA</h1><p>SMS MINI APP</p></div></div><div class="pill" id="state">LIVE</div></div>
  <section class="hero"><div class="user"><div class="avatar" id="avatar">A</div><div class="hello"><b id="name">Welcome</b><span id="username">Telegram secure access</span></div><div class="credits"><b id="credits">--</b><span>Credits</span></div></div></section>
  <div class="lock" id="lock" style="display:none"><b>MINI APP LOCKED</b><span id="lock-msg">Open Web Panel from bot dashboard to generate a 1 month license.</span><button class="red" onclick="openBot('web_panel')" style="width:100%;margin-top:12px">Get License</button></div>

  <main class="page active" id="home-page">
    <div class="stats"><div class="stat"><label>Total Device</label><strong id="total-devices">--</strong></div><div class="stat"><label>Online Device</label><strong id="online-devices">--</strong></div><div class="stat"><label>Offline Device</label><strong id="offline-devices">--</strong></div><div class="stat"><label>Saved Device</label><strong id="saved-devices">0</strong></div></div>
    <div class="card"><div class="title">Quick Actions</div><div class="actions"><button onclick="showPage('number')">Get Number</button><button class="blue" onclick="openBot('buy_credit')">Buy Credit</button><button class="blue" onclick="showPage('task')">Tasks</button><button class="red" onclick="openBot('support')">Support</button></div></div>
  </main>

  <main class="page" id="number-page">
    <div class="card"><div class="title">Number Room</div><button style="width:100%" onclick="getRandomNumber(this)">Get Random Number</button><div class="two" style="margin-top:10px"><div><div class="title">Saved Numbers</div><div class="list" id="saved-list"><div class="empty">No saved device</div></div></div><div><div class="title">Search Number</div><div class="field"><input id="number-search" placeholder="Number or device id"/></div><button class="blue" style="width:100%" onclick="searchNumber(this)">Search</button><div class="list" id="search-list"></div></div></div><div class="detail" id="number-detail"><div class="empty">No number selected</div></div><div class="actions"><button onclick="toggleLive(this)" id="live-btn">Live SMS</button><button class="blue" onclick="loadSms()">Load 100 SMS</button><button class="blue" onclick="renderSaved()">Saved</button><button class="red" onclick="clearNumber()">Clear</button></div></div>
    <div class="card"><div class="title">Send SMS</div><div class="two"><div class="field"><label>Send To</label><input id="send-to" placeholder="91XXXXXXXXXX"/></div><div class="field"><label>SIM Slot</label><select id="send-sim"><option value="1">SIM 1</option><option value="2">SIM 2</option></select></div></div><div class="field"><label>Message</label><textarea id="send-msg" placeholder="Type SMS message"></textarea></div><button style="width:100%" onclick="sendSms(this)">Send SMS</button></div>
    <div class="card"><div class="title">SMS History</div><div class="sms-tools"><input id="sms-search" placeholder="Search OTP, sender, text" oninput="renderSms()"/><select id="sms-filter" onchange="renderSms()"><option value="all">All</option><option value="otp">OTP</option><option value="today">Today</option></select></div><div id="live-box" class="small" style="margin-bottom:8px">Live SMS not started</div><div class="sms-list" id="sms-list"><div class="empty">Load SMS after selecting number</div></div></div>
  </main>

  <main class="page" id="task-page">
    <div class="card"><div class="title">Tasks</div><div class="actions"><button onclick="openBot('refer')">Refer Friend</button><button class="blue" onclick="openBot('buy_credit')">Buy Credits</button><button class="blue" onclick="openBot('gift_card')">Gift Card</button><button class="red" onclick="openBot('support')">Support</button></div></div>
    <div class="card"><div class="title">Task Status</div><div class="meta"><span>Referral <b id="task-refs">0</b></span><span>Credits <b id="task-credits">0</b></span><span>License <b id="task-license">--</b></span><span>SMS <b id="task-sms">--</b></span></div></div>
  </main>

  <main class="page" id="profile-page">
    <div class="card"><div class="title">Profile</div><div class="meta"><span>Name <b id="p-name">--</b></span><span>Username <b id="p-user">--</b></span><span>Telegram ID <b id="p-id">--</b></span><span>Credits <b id="p-credits">--</b></span><span>Referral Code <b id="p-code">--</b></span><span>Total Referral <b id="p-refs">--</b></span><span>Joined <b id="p-joined">--</b></span><span>Web Validity <b id="p-license">--</b></span><span>Current Device <b id="p-device">--</b></span><span>Number History <b id="p-history">0</b></span></div></div>
  </main>
</div>
<div class="nav"><button class="active" data-page="home" onclick="showPage('home')">Home</button><button data-page="number" onclick="showPage('number')">Number</button><button data-page="task" onclick="showPage('task')">Task</button><button data-page="profile" onclick="showPage('profile')">Profile</button></div>
<script>
const tg=window.Telegram?.WebApp;if(tg){tg.ready();tg.expand();tg.setHeaderColor&&tg.setHeaderColor('#020910');tg.setBackgroundColor&&tg.setBackgroundColor('#020910');}
const BOT='Annebellasmsbot';let profile=null,current=null,smsCache=[],liveTimer=null,lastSmsKey='',matches=[];
function qs(id){return document.getElementById(id)}function esc(s){const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML}function set(id,v){qs(id).textContent=v}
function openBot(cmd){const u='https://t.me/'+BOT+'?start='+encodeURIComponent(cmd);tg?.openTelegramLink?tg.openTelegramLink(u):location.href=u}
function showPage(p){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===p+'-page'));document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===p));if(p==='number')renderSaved();if(p==='profile')renderProfile()}
function saved(){try{return JSON.parse(localStorage.getItem('ab-mini-saved')||'[]')}catch{return[]}}function saveNumber(d){const arr=saved().filter(x=>x.deviceId!==d.deviceId||x.panelId!==d.panelId);arr.unshift({...d,savedAt:new Date().toISOString()});localStorage.setItem('ab-mini-saved',JSON.stringify(arr.slice(0,30)));set('saved-devices',arr.length);renderSaved()}
function lock(m){qs('lock').style.display='block';set('state','LOCKED');qs('lock-msg').textContent=m||'Mini app license required.'}
async function authBody(){const initData=tg?.initData||'',license=new URLSearchParams(location.search).get('license')||localStorage.getItem('annebella-mini-license')||'';if(license)localStorage.setItem('annebella-mini-license',license);return{initData,license}}
async function loadProfile(){const u=tg?.initDataUnsafe?.user;if(u){set('name',u.first_name||'Telegram User');set('username',u.username?'@'+u.username:'Telegram user');qs('avatar').textContent=(u.first_name||'A').slice(0,1).toUpperCase();if(u.photo_url)qs('avatar').innerHTML='<img src="'+esc(u.photo_url)+'"/>'}const body=await authBody();if(!body.initData)return lock('Open this mini app inside Telegram.');if(!body.license)return lock('Open Web Panel from bot dashboard to generate a 1 month license.');try{const r=await fetch('/miniapp/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error);profile=d;set('state','LIVE');qs('lock').style.display='none';set('name',d.firstName);set('username',d.username?'@'+d.username:'ID '+d.telegramId);set('credits',d.smsCredits);renderProfile();loadStats()}catch(e){lock(e.message||'Mini app locked')}}
async function loadStats(){try{const d=await (await fetch('/api/dashboard',{cache:'no-store'})).json();set('total-devices',d.totalDevices??0);set('online-devices',d.onlineDevices??0);set('offline-devices',d.offlineDevices??0);set('saved-devices',saved().length)}catch{set('total-devices','--');set('online-devices','--');set('offline-devices','--')}}
function detail(d){return '<div class="num">'+esc(d.number||d.deviceId||'--')+'</div><div class="meta"><span>Device <b>'+esc(d.deviceName||d.deviceId)+'</b></span><span>Panel <b>'+esc(d.panelName||d.panelId)+'</b></span><span>Status <b>'+esc(d.status||'--')+'</b></span><span>Battery <b>'+esc(d.battery||'--')+'</b></span><span>SMS <b>'+esc(d.totalSms||0)+'</b></span><span>ID <b>'+esc(d.deviceId||'--')+'</b></span></div>'}
function useNumber(d){current=d;saveNumber(d);qs('number-detail').innerHTML=detail(d);qs('send-to').value=d.number||'';smsCache=[];qs('sms-list').innerHTML='<div class="empty">Load SMS after selecting number</div>'}
async function getRandomNumber(btn){btn.disabled=true;btn.textContent='Searching...';try{const r=await fetch('/api/panels/random-number',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);useNumber(d)}catch(e){alert(e.message||'No number found')}finally{btn.disabled=false;btn.textContent='Get Random Number'}}
function renderSaved(){const box=qs('saved-list'),arr=saved();set('saved-devices',arr.length);if(!arr.length){box.innerHTML='<div class="empty">No saved device</div>';return}box.innerHTML=arr.map((d,i)=>'<div class="row"><div><div class="mono">'+esc(d.number||d.deviceId)+'</div><div class="small">'+esc(d.panelName||'Panel')+' / '+esc(d.deviceName||d.deviceId)+'</div></div><button onclick="useSaved('+i+')">Use</button></div>').join('')}
function useSaved(i){const d=saved()[i];if(d)useNumber(d)}
async function searchNumber(btn){const q=qs('number-search').value.trim();if(q.length<3)return alert('Enter at least 3 characters');btn.disabled=true;btn.textContent='Searching...';try{const r=await fetch('/api/panels/search-number?q='+encodeURIComponent(q),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);matches=d.matches||[];qs('search-list').innerHTML=matches.length?matches.map((m,i)=>'<div class="row"><div><div class="mono">'+esc(m.number||m.deviceId)+'</div><div class="small">'+esc(m.panelName)+' / '+esc(m.status)+'</div></div><button onclick="useMatch('+i+')">Use</button></div>').join(''):'<div class="empty">No match</div>'}catch(e){alert(e.message||'Search failed')}finally{btn.disabled=false;btn.textContent='Search'}}
function useMatch(i){if(matches[i])useNumber(matches[i])}function needNumber(){if(current)return current;alert('Select number first');return null}
function clearNumber(){current=null;smsCache=[];lastSmsKey='';if(liveTimer){clearInterval(liveTimer);liveTimer=null;qs('live-btn').textContent='Live SMS'}qs('send-to').value='';qs('send-msg').value='';qs('number-detail').innerHTML='<div class="empty">No number selected</div>';qs('live-box').textContent='Live SMS not started';qs('sms-list').innerHTML='<div class="empty">Load SMS after selecting number</div>'}
async function loadSms(){const n=needNumber();if(!n)return;qs('sms-list').innerHTML='<div class="empty">Loading 100 SMS...</div>';try{const d=await (await fetch('/api/panels/'+encodeURIComponent(n.panelId)+'/devices/'+encodeURIComponent(n.deviceId)+'/sms',{cache:'no-store'})).json();smsCache=(d.messages||[]).slice(0,100);renderSms()}catch{qs('sms-list').innerHTML='<div class="empty">SMS load failed</div>'}}
function today(m){const t=Date.parse(m.time||'');return !isNaN(t)&&new Date(t).toDateString()===new Date().toDateString()}function renderSms(){const q=qs('sms-search').value.toLowerCase(),f=qs('sms-filter').value;let arr=smsCache;if(f==='otp')arr=arr.filter(m=>/\\b\\d{4,8}\\b/.test(m.text||''));if(f==='today')arr=arr.filter(today);if(q)arr=arr.filter(m=>[m.sender,m.time,m.text].join(' ').toLowerCase().includes(q));qs('sms-list').innerHTML=arr.length?arr.map((m,i)=>'<div class="sms-item"><div class="sms-head"><b>#'+(i+1)+' '+esc(m.sender||'Unknown')+'</b><span>'+esc(m.time||'--')+'</span></div><div class="sms-body">'+esc(m.text||'')+'</div></div>').join(''):'<div class="empty">No SMS matched</div>'}
async function pollLive(){const n=needNumber();if(!n)return;try{const d=await (await fetch('/api/panels/'+encodeURIComponent(n.panelId)+'/devices/'+encodeURIComponent(n.deviceId)+'/sms',{cache:'no-store'})).json();const m=(d.messages||[])[0];if(!m){qs('live-box').textContent='Live running - no SMS yet';return}const k=[m.sender,m.time,m.text].join('|');if(k!==lastSmsKey){lastSmsKey=k;qs('live-box').innerHTML='<b style="color:var(--c)">Latest Live SMS</b><br>'+esc(m.sender||'Unknown')+' - '+esc(m.time||'--')+'<br>'+esc(m.text||'')}}</catch{qs('live-box').textContent='Live SMS failed'}}
function toggleLive(btn){if(liveTimer){clearInterval(liveTimer);liveTimer=null;btn.textContent='Live SMS';qs('live-box').textContent='Live SMS stopped';return}if(!needNumber())return;btn.textContent='Stop Live';lastSmsKey='';pollLive();liveTimer=setInterval(pollLive,5000)}
async function sendSms(btn){const n=needNumber();if(!n)return;const to=qs('send-to').value.trim(),message=qs('send-msg').value.trim(),simSlot=Number(qs('send-sim').value||1);if(!to||!message)return alert('Number and message required');btn.disabled=true;try{const r=await fetch('/api/panels/'+encodeURIComponent(n.panelId)+'/devices/'+encodeURIComponent(n.deviceId)+'/send-sms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,message,simSlot})});if(!r.ok)throw new Error('SMS send failed');qs('send-msg').value='';alert('SMS command sent')}catch(e){alert(e.message||'SMS failed')}finally{btn.disabled=false}}
function renderProfile(){if(!profile)return;set('task-refs',profile.referralCount||0);set('task-credits',profile.smsCredits||0);set('task-license',profile.licenseExpiresAt?new Date(profile.licenseExpiresAt).toLocaleDateString():'--');set('task-sms',profile.sendSmsUnlocked?'Ready':'Locked');set('p-name',profile.firstName||'--');set('p-user',profile.username?'@'+profile.username:'--');set('p-id',profile.telegramId||'--');set('p-credits',profile.smsCredits||0);set('p-code',profile.referralCode||'--');set('p-refs',profile.referralCount||0);set('p-joined',profile.createdAt?new Date(profile.createdAt).toLocaleDateString():'--');set('p-license',profile.licenseExpiresAt?new Date(profile.licenseExpiresAt).toLocaleString():'--');set('p-device',profile.assignedDeviceId||'--');set('p-history',saved().length)}
loadProfile();renderSaved();
</script>
</body>
</html>`;

export default router;
