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
  res.send(MINIAPP_HTML);
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

export default router;
