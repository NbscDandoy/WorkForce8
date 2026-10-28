const $ = i => document.getElementById(i);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const today = () => day(0);
const ago = ts => {
  if (!ts) return 'Never';
  const m = Math.floor((Date.now() - ts) / 6e4);
  return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.floor(m / 60) + 'h ago' : Math.floor(m / 1440) + 'd ago';
};

const formatRealTime = () => new Date().toLocaleTimeString();

const SN = ['To do', 'In progress', 'Completed'];
const PN = ['', 'LOW', 'MEDIUM', 'HIGH'];

function seed() {
  const n = Date.now();
  return {
    u: {
      alex: { pw: '1234', role: 'manager', name: 'Alex', title: 'Operations Manager', lastLogin: null },
      sarah: { pw: '1234', role: 'employee', name: 'Sarah', title: 'Sr. Developer', lastLogin: n - 3600000 },
      michael: { pw: '1234', role: 'employee', name: 'Michael', title: 'Product Designer', lastLogin: n - 18000000 },
      emma: { pw: '1234', role: 'employee', name: 'Emma', title: 'Growth Lead', lastLogin: n - 86400000 }
    },
    tasks: [
      { id: 1, title: 'Quarterly Performance Audit', desc: 'Review team KPIs against SDG 8 targets.', to: 'sarah', pri: 3, due: day(2), st: 1 },
      { id: 2, title: 'Client Onboarding Flow', desc: 'Draft the onboarding checklist.', to: 'michael', pri: 2, due: day(5), st: 1 },
      { id: 3, title: 'Develop User Onboarding Flow', desc: 'Implement the role-based selection screen.', to: 'emma', pri: 2, due: day(0), st: 1 },
      { id: 4, title: 'API Documentation Review', desc: 'Review docs for the productivity endpoints.', to: 'emma', pri: 1, due: day(2), st: 0 },
      { id: 5, title: 'Weekly Growth Sync', desc: 'Prepare data for the SDG 8 meeting.', to: 'emma', pri: 1, due: day(3), st: 0 },
      { id: 6, title: 'Update Safety Checklist', desc: 'Refresh the workplace safety checklist.', to: 'michael', pri: 3, due: day(-1), st: 0 },
      { id: 7, title: 'Landing Page Design', desc: 'Final visual design.', to: 'sarah', pri: 2, due: day(-2), st: 2 }
    ],
    act: [
      { ic: '✓', ti: 'Task Completed', tx: 'Sarah completed “Landing Page Design”.', ts: n - 72e5, to: 'all' },
      { ic: '💬', ti: 'New Comment', tx: 'Michael commented on “Bug #402”.', ts: n - 3e6, to: 'all' },
      { ic: '⏱', ti: 'Deadline Shift', tx: 'Emma moved the deadline for “Market Research”.', ts: n - 6e6, to: 'all' }
    ],
    nid: 8,
    punch: {}
  };
}

let S;
const loadState = () => {
  try { S = JSON.parse(localStorage.getItem('wf8')); } catch (e) {}
  if (!S || !S.u) S = seed();
};
loadState();

let theme = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
try { theme = localStorage.getItem('wf8t') || theme; } catch (e) {}
document.documentElement.dataset.theme = theme;

let me = null;
try { me = sessionStorage.getItem('wf8_me') || null; } catch (e) {}
if (me && (!S.u || !S.u[me])) me = null;

let role = me ? S.u[me].role : null, reg = false, view = 'dash', q = '', range = 'w', msg = '', modal = null, cpu = null, prog = [];
let pendingTimeOutBackup = null;

const save = () => {
  try { 
    localStorage.setItem('wf8', JSON.stringify(S)); 
    if (me) sessionStorage.setItem('wf8_me', me);
    else sessionStorage.removeItem('wf8_me');
  } catch (e) {}
};

/* ---- Toast Notification Function ---- */
function showToast(icon, title, message) {
  let container = $('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = 'background:var(--bg, #1e293b);color:var(--tx, #f8fafc);border:1px solid var(--bd, #334155);padding:12px 16px;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.3);display:flex;align-items:center;gap:12px;min-width:280px;max-width:360px;pointer-events:auto;animation:toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);';
  toast.innerHTML = `<span style="font-size:20px;">${icon}</span><div><b style="font-size:13px;display:block;">${esc(title)}</b><span style="font-size:12px;opacity:0.8;">${esc(message)}</span></div>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

if (!document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.innerHTML = `@keyframes toastIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
  document.head.appendChild(style);
}

window.addEventListener('storage', e => {
  if (e.key === 'wf8') {
    const oldAct = S && S.act && S.act[0] ? S.act[0].ts : 0;
    loadState();
    const newAct = S && S.act && S.act[0] ? S.act[0] : null;

    if (newAct && newAct.ts > oldAct && me) {
      showToast(newAct.ic, newAct.ti, newAct.tx);
    }

    if (me && !S.u[me]) me = null;
    cpuReset();
    draw();
  }
});

const U = () => S.u;
const pct = l => l.length ? Math.round(l.filter(t => t.st == 2).length * 100 / l.length) : 0;
const dd = t => Math.round((new Date(t.due) - new Date(today())) / 864e5);
const over = t => dd(t) < 0 && t.st != 2;
const dueTx = t => {
  const d = dd(t);
  return d < 0 ? 'Overdue by ' + (-d) + 'd' : d == 0 ? 'Due today' : 'Due in ' + d + ' day' + (d > 1 ? 's' : '');
};

const av = k => {
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `<span class="av" title="${esc(U()[k].name)}" style="background:hsl(${h},55%,48%)">${esc(U()[k].name[0])}</span>`;
};

function setTheme() {
  theme = theme == 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('wf8t') || theme; } catch (e) {}
  draw();
}

const tog = () => `<button class="sw" role="switch" aria-label="Toggle dark mode" title="Dark / light" onclick="setTheme()"><i>${theme == 'dark' ? '🌙' : '☀️'}</i></button>`;

function log(ic, ti, tx, to) {
  S.act.unshift({ ic, ti, tx, ts: Date.now(), to: to || 'all' });
}

/* ---- auth ---- */
function pick(r) { role = r; reg = false; msg = ''; draw(); }
function goBackRole() { role = null; reg = false; msg = ''; draw(); }

function doLogin() {
  const uElem = $('lu');
  const pElem = $('lp');
  if (!uElem || !pElem) return;

  const u = uElem.value.trim().toLowerCase(), p = pElem.value;
  if (U()[u] && U()[u].pw === p && U()[u].role === role) {
    me = u; 
    view = 'dash'; 
    S.u[u].lastLogin = Date.now();
    log('🔑', 'User Login', `${U()[u].name} logged in.`);
    save();
    cpuReset(); 
    msg = '';

    // Show Time In popup prompt if employee logs in and isn't timed in yet
    const pData = S.punch[me];
    if (role === 'employee' && (!pData || !pData.since)) {
      modal = 'timein_prompt';
    }
  } else {
    msg = 'Invalid Login. Check your username, password and role.';
  }
  draw();
}

function doReg() {
  const nElem = $('rn');
  const uElem = $('ru');
  const pElem = $('rp');
  if (!nElem || !uElem || !pElem) return;

  const n = nElem.value.trim(), u = uElem.value.trim().toLowerCase(), p = pElem.value;
  if (!n || !u || p.length < 4) msg = 'Enter a name, a username and a password of 4+ characters.';
  else if (!/^[a-z0-9_]+$/.test(u)) msg = 'Username: letters, numbers and _ only.';
  else if (U()[u]) msg = 'That username is taken.';
  else {
    S.u[u] = { pw: p, role, name: n, title: role == 'manager' ? 'Manager' : 'Team Member', lastLogin: Date.now() };
    log('＋', 'New Member', n + ' joined the team.');
    me = u; view = 'dash'; msg = ''; reg = false;
    save(); cpuReset();

    if (role === 'employee') {
      modal = 'timein_prompt';
    }
  }
  draw();
}

function logout() { pendingTimeOutBackup = null; me = null; role = null; msg = ''; modal = null; save(); draw(); }

function cancelTimeOutModal() {
  if (pendingTimeOutBackup && me && S.punch[me]) {
    S.punch[me].since = pendingTimeOutBackup;
    pendingTimeOutBackup = null;
    save();
  }
  modal = null;
  draw();
}

function confirmTimeInPrompt() {
  const p = S.punch[me] || (S.punch[me] = { acc: 0, since: null });
  p.since = Date.now();
  pendingTimeOutBackup = null;
  log('⏱', 'Time In', `${U()[me].name} timed in.`);
  save();
  modal = null;
  draw();
}

/* ---- Time In / Time Out Action ---- */
function toggleTimeInOut() {
  const p = S.punch[me] || (S.punch[me] = { acc: 0, since: null });
  if (p.since) {
    pendingTimeOutBackup = p.since;
    p.acc += Date.now() - p.since;
    p.since = null;
    log('⏱', 'Time Out', `${U()[me].name} timed out.`);
    modal = 'logout';
  } else {
    p.since = Date.now();
    pendingTimeOutBackup = null;
    log('⏱', 'Time In', `${U()[me].name} timed in.`);
  }
  save();
  draw();
}

const focusTx = () => {
  const p = S.punch[me] || { acc: 0, since: null };
  const ms = p.acc + (p.since ? Date.now() - p.since : 0);
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
};

setInterval(() => {
  const e = $('ft');
  if (e && me) {
    e.textContent = focusTx();
  }

  const r = $('rtc');
  if (r && me) r.textContent = formatRealTime();
}, 1000);

function setSt(id, st) {
  const t = S.tasks.find(x => x.id == id);
  if (!t) return;
  t.st = st;
  log(st == 2 ? '✓' : '▶', st == 2 ? 'Task Completed' : 'Task Started', U()[me].name + (st == 2 ? ' completed “' : ' started “') + t.title + '”.');
  save(); cpuReset(); draw();
}

function addTask() {
  const ntElem = $('nt');
  if (!ntElem) return;
  const t = ntElem.value.trim();
  if (!t) { ntElem.focus(); return; }
  const to = $('nto').value;
  S.tasks.push({ id: S.nid++, title: t, desc: '', to, pri: +$('npr').value, due: $('nd').value || day(3), st: 0 });
  log('＋', 'New Task', U()[me].name + ' assigned “' + t + '” to ' + U()[to].name + '.');
  save(); cpuReset(); modal = null; draw();
}

function report() {
  const emp = Object.keys(U()).filter(k => U()[k].role == 'employee');
  return 'WORKFORCE8 GROWTH REPORT – ' + today() + '\nOverall completion: ' + pct(S.tasks) + '% (' + S.tasks.filter(t => t.st == 2).length + '/' + S.tasks.length + ' tasks)\nOverdue alerts: ' + S.tasks.filter(over).length + '\n\n' + emp.map(k => {
    const l = S.tasks.filter(t => t.to == k);
    return U()[k].name.padEnd(10) + l.filter(t => t.st == 2).length + '/' + l.length + ' done  (' + pct(l) + '% efficiency)';
  }).join('\n');
}

function copyRep() {
  try {
    navigator.clipboard.writeText(report());
    const cpElem = $('cp');
    if (cpElem) cpElem.textContent = 'Copied';
  } catch (e) {
    const cpElem = $('cp');
    if (cpElem) cpElem.textContent = 'Select the text and copy it';
  }
}

/* ---- mini CPU ---- */
const progText = n => `MOV CX, ${n}
MOV SI, 0
MOV AX, 0
L1: MOV BX, [SI]
CMP BX, 2
JNE S1
INC AX
S1: INC SI
DEC CX
JNZ L1
MUL 100
DIV ${n}
MOV BX, AX
CMP BX, 50
JL LOW
CMP BX, 80
JL OK
MOV DX, 2
JMP DONE
LOW: MOV DX, 0
JMP DONE
OK: MOV DX, 1
DONE: HLT`;

function cpuReset() {
  const n = S.tasks.length;
  prog = n ? progText(n).split('\n').map(l => {
    const m = l.match(/^(?:(\w+):\s*)?(\w+)(?:\s+(.+))?$/);
    return { raw: l, lab: m[1], op: m[2], a: m[3] ? m[3].split(',').map(s => s.trim()) : [] };
  }) : [];
  cpu = { pc: 0, r: { AX: 0, BX: 0, CX: 0, DX: 0, SI: 0 }, zf: 0, sf: 0, n: 0, halt: !n, mem: S.tasks.map(t => t.st), log: [] };
}

const isR = a => a in cpu.r, val = a => { const m = a.match(/^\[(\w+)\]$/); return m ? cpu.mem[cpu.r[m[1]]] : isR(a) ? cpu.r[a] : parseInt(a); };

function step() {
  if (!cpu || cpu.halt) return;
  const i = prog[cpu.pc], old = cpu.pc;
  cpu.pc++; cpu.n++;
  const [a, b] = i.a, L = x => prog.findIndex(p => p.lab == x);
  let nt = '';
  switch (i.op) {
    case 'MOV': cpu.r[a] = val(b); break;
    case 'INC': cpu.r[a]++; cpu.zf = +(cpu.r[a] == 0); break;
    case 'DEC': cpu.r[a]--; cpu.zf = +(cpu.r[a] == 0); break;
    case 'CMP': { const x = val(a), y = val(b); cpu.zf = +(x == y); cpu.sf = +(x < y); break; }
    case 'MUL': cpu.r.AX *= val(a); break;
    case 'DIV': { const d = val(a); cpu.r.DX = cpu.r.AX % d; cpu.r.AX = Math.floor(cpu.r.AX / d); break; }
    case 'JNE': case 'JNZ': if (!cpu.zf) { cpu.pc = L(a); nt = ' (taken)'; } break;
    case 'JL': if (cpu.sf) { cpu.pc = L(a); nt = ' (taken)'; } break;
    case 'JMP': cpu.pc = L(a); break;
    case 'HLT': cpu.halt = true;
  }
  cpu.log.unshift(`PC=${old} IR="${i.raw.replace(/^\w+:\s*/, '')}"${nt}`);
  cpu.log = cpu.log.slice(0, 6);
}

function runAll() {
  if (!cpu) return;
  let g = 0;
  while (!cpu.halt && g++ < 3000) step();
  draw();
}

function cpuView() {
  const n = S.tasks.length, exp = pct(S.tasks), res = ['Low (below 50%)', 'On track (50–79%)', 'Excellent (80%+)'], al = S.tasks.filter(over).length;
  return `<div class="card"><h2>CPU Lab: Assembly productivity check</h2><p class="mu" style="margin:6px 0 12px">Each step runs fetch (instruction at PC goes to IR), decode (read the opcode) and execute (ALU, registers, memory). The program loops over the task-status array in RAM (0 = to do, 1 = in progress, 2 = completed), counts completed tasks, computes the completion % and classifies it with CMP and conditional jumps.</p>
 <div class="row"><button class="pri" onclick="step();draw()">Step</button><button class="pri" onclick="runAll()">Run all</button><button class="out" onclick="cpuReset();draw()">Reset</button></div>
 <div class="row" style="align-items:flex-start;margin-top:12px"><div style="flex:1;min-width:230px"><pre>${prog.map((p, k) => `<span class="${k == cpu.pc && !cpu.halt ? 'cur' : ''}" style="display:block">${String(k).padStart(2, '0')}  ${esc(p.raw)}</span>`).join('')}</pre></div>
 <div style="flex:1;min-width:230px"><div class="regs">${Object.entries(cpu.r).map(([k, v]) => `<div class="reg"><b>${k}</b><br>${v}</div>`).join('')}<div class="reg"><b>PC</b><br>${cpu.pc}</div><div class="reg"><b>ZF/SF</b><br>${cpu.zf}/${cpu.sf}</div></div>
 <p class="mu" style="margin:12px 0 4px">RAM: task status words (SI points to the current one)</p><div class="mem">${cpu.mem.map((v, k) => `<span class="s${v}" style="${k == cpu.r.SI && !cpu.halt ? 'outline:2px solid var(--ac)' : ''}">${v}</span>`).join('')}</div>
 <p class="mu" style="margin:12px 0 4px">Trace (latest first)</p><pre>${cpu.log.map(esc).join('\n') || '–'}</pre></div></div>
 ${cpu.halt && n ? `<p style="margin-top:12px"><b>Result:</b> DX = ${cpu.r.DX} → ${res[cpu.r.DX]}; BX = ${cpu.r.BX}% completed. <span class="${cpu.r.BX == exp ? 's2' : 'al'}">${cpu.r.BX == exp ? '✔ Matches the app’s own calculation (' + exp + '%)' : '✘ Does not match the app (' + exp + '%)'}</span></p>` : ''}
 <p class="mu" style="margin-top:8px">Performance: ${cpu.n} instructions executed · ${prog.length} in the program · ${n} memory words used</p></div>
 <div class="card"><h2>Digital logic: overdue alert</h2><p class="mu" style="margin:6px 0 10px">ALERT = OVERDUE AND NOT(DONE). Tasks raising an alert now: <b class="${al ? 'al' : ''}">${al}</b></p>
 <div class="ov"><table><tr><th>OVERDUE</th><th>DONE</th><th>NOT DONE</th><th>ALERT</th></tr>${[[0, 0], [0, 1], [1, 0], [1, 1]].map(([o, d]) => `<tr><td>${o}</td><td>${d}</td><td>${+!d}</td><td><b>${o && !d ? 1 : 0}</b></td></tr>`).join('')}</table></div>
 <p class="mu" style="margin-top:8px">One NOT gate feeding one AND gate. Rebuild it in Logisim Evolution for your simulation screenshot.</p></div>`;
}

/* ---- views ---- */
function chart() {
  const w = range == 'w', L = w ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Week 1', 'Week 2', 'Week 3', 'Week 4'], P = w ? [65, 78, 72, 86, 92, 48, 30] : [70, 76, 82, 0], T = w ? [40, 52, 60, 58, 65, 30, 25] : [60, 65, 70, 75];
  P[w ? (new Date().getDay() + 6) % 7 : 3] = pct(S.tasks);
  const W = 640, H = 240, s = (W - 50) / L.length, x = i => 46 + i * s + s / 2, y = v => H - 24 - v * (H - 44) / 100, bw = s * .7;
  return `<div class="row mu" style="margin-top:14px"><span><b style="color:var(--ac)">●</b> Productivity</span><span><b style="color:var(--ok);opacity:.5">■</b> Targets</span></div><div class="ov"><svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:420px" role="img" aria-label="Productivity versus targets">${[0, 25, 50, 75, 100].map(v => `<line x1="40" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--bd)"/><text x="32" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="var(--mu)">${v}</text>`).join('')}
 ${T.map((v, i) => `<rect x="${x(i) - bw / 2}" y="${y(v)}" width="${bw}" height="${H - 24 - y(v)}" rx="4" fill="var(--ok)" opacity=".28"/>`).join('')}
 <path d="${P.map((v, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(v)).join(' ')}" fill="none" stroke="var(--ac)" stroke-width="3" stroke-linejoin="round"/>${P.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="var(--ac)"/>`).join('')}
 ${L.map((l, i) => `<text x="${x(i)}" y="${H - 6}" font-size="10" text-anchor="middle" fill="var(--mu)">${l}</text>`).join('')}</svg></div><p class="mu">Blue line: productivity (today’s point is your live completion rate). Green bars: targets. Earlier points are sample baseline data.</p>`;
}

function activeList() {
  const l = S.tasks.filter(t => t.st < 2 && (t.title + U()[t.to].name).toLowerCase().includes(q.toLowerCase()));
  return l.map(t => `<div class="it"><div class="row sp"><b>${esc(t.title)}</b><span class="pb p${t.pri}">${PN[t.pri]}</span></div><div class="row sp" style="margin-top:8px">${av(t.to)}<span class="mu ${over(t) ? 'al' : ''}">${dueTx(t)}</span></div><div class="bar"><i style="width:${[0, 50, 100][t.st]}%;background:${over(t) ? 'var(--er)' : t.pri == 3 ? 'var(--ac)' : 'var(--ok)'}"></i></div></div>`).join('') || '<p class="mu" style="margin-top:10px">No matching active tasks. Use Assign New Task to add one.</p>';
}

const team = () => Object.keys(U()).filter(k => U()[k].role == 'employee').map(k => {
  const user = U()[k];
  const p = pct(S.tasks.filter(t => t.to == k));
  const lastActive = ago(user.lastLogin);
  return `<div class="row sp" style="margin-top:14px">
    <div class="row">
      ${av(k)}
      <div>
        <b>${esc(user.name)}</b>
        <div class="mu">${esc(user.title)}</div>
        <div class="mu" style="font-size:10px">Logged in: ${lastActive}</div>
      </div>
    </div>
    <div style="text-align:right">
      <b class="${p >= 80 ? 's2' : p >= 50 ? '' : 's1'}">${p}%</b>
      <div class="mu">Efficiency</div>
    </div>
  </div>`;
}).join('');

const feed = () => {
  if (U()[me].role !== 'manager') return '';
  return S.act.slice(0, 6).map(a => `<div class="fe"><div class="ic">${a.ic}</div><div style="flex:1"><b>${esc(a.ti)}</b><p>${esc(a.tx)}</p></div><span class="mu">${ago(a.ts)}</span></div>`).join('') || '<p class="mu">No activity yet.</p>';
};

function mgrLeft() {
  return `<div class="card"><div class="row sp"><div><h2>Project Pulse</h2><p class="mu">${range == 'w' ? 'Weekly' : 'Monthly'} productivity metrics aligned with SDG 8</p></div><div class="seg"><button class="${range == 'w' ? 'on' : ''}" onclick="range='w';draw()">Weekly</button><button class="${range == 'm' ? 'on' : ''}" onclick="range='m';draw()">Monthly</button></div></div>${chart()}</div>
 <div class="two"><div class="card"><div class="row sp"><h2>Active Tasks</h2><a onclick="view='tasks';draw()">View all</a></div><div id="al">${activeList()}</div></div><div class="card"><h2>Team Performance</h2>${team()}</div></div>`;
}

function mgrRight() {
  return `<div class="card"><h2>Quick Action</h2><button class="pri wide" onclick="modal='task';draw()">＋ Assign New Task</button><button class="out wide" onclick="modal='rep';draw()">Export Growth Report</button></div><div class="card"><h2>Recent Activity</h2>${feed()}</div>`;
}

function tcard(t, lab, showWho) {
  const mine = t.to == me && U()[me].role == 'employee';
  return `<div class="tk ${lab == 'ACTIVE NOW' ? 'act' : ''}"><div class="row sp"><span class="bd">${lab || SN[t.st].toUpperCase()}</span><span class="pb p${t.pri}">${PN[t.pri]}</span></div><h3 style="margin:10px 0 4px;font-size:16px">${esc(t.title)}</h3><p class="mu" style="font-size:13px">${esc(t.desc || '')}</p>
 <div class="row sp" style="margin-top:12px"><span class="mu ${over(t) ? 'al' : ''}">${showWho ? esc(U()[t.to].name) + ' · ' : ''}${dueTx(t)}${over(t) ? ' · ALERT' : ''}</span><span class="row">${mine && t.st == 0 ? `<a onclick="setSt(${t.id},1)">Start</a>` : ''}${mine && t.st < 2 ? `<a onclick="setSt(${t.id},2)">Complete</a>` : ''}</span></div></div>`;
}

function empDash() {
  const mine = S.tasks.filter(t => t.to == me), open = mine.filter(t => t.st < 2).sort((a, b) => b.st - a.st), td = open.filter(t => t.st == 0).length, ip = open.filter(t => t.st == 1).length, tot = S.tasks.filter(t => t.st == 2).length, mc = mine.filter(t => t.st == 2).length, p = pct(mine);
  let fi = 0;
  return `<div class="g" style="grid-template-columns:minmax(0,1fr) 340px"><div class="card"><div class="row sp"><h2>Assigned Tasks</h2><span class="row"><span class="pb" style="background:#3b82f622;color:var(--ac)">TO DO (${td})</span><span class="pb p3">IN PROGRESS (${ip})</span></span></div>
 ${open.map(t => { let l; if (t.st == 1 && !fi++) l = 'ACTIVE NOW'; else l = t.st == 1 ? 'IN PROGRESS' : td && t == open.find(x => x.st == 0) ? 'NEXT UP' : 'BACKLOG'; return tcard(t, l); }).join('') || '<p class="mu" style="margin-top:12px">All caught up. Your manager will assign new tasks here.</p>'}</div>
 <div><div class="imp"><h2>My SDG Impact</h2><p style="font-size:11px;color:#94a3b8;margin-top:2px">GOAL 8: DECENT WORK</p><div class="big">${tot ? Math.round(mc * 1000 / tot) / 10 : 0}%</div><p style="font-size:12px;color:#cbd5e1">Your share of the team’s completed tasks</p><div style="border-top:1px solid #334155;margin-top:16px;padding-top:12px" class="row sp"><b style="font-size:12px">Completion target: 85%</b><b style="font-size:12px;color:var(--ok)">${p}% reached</b></div><div class="bar" style="background:#334155"><i style="width:${Math.min(100, p)}%;background:var(--ok)"></i></div></div>
 </div></div>`;
}

function tasksView() {
  const l = (U()[me].role == 'manager' ? S.tasks : S.tasks.filter(t => t.to == me)).slice().sort((a, b) => a.st - b.st || a.due.localeCompare(b.due));
  return `<div class="card"><div class="row sp"><h2>${U()[me].role == 'manager' ? 'All tasks' : 'My tasks'}</h2><span class="mu">Completion ${pct(l)}% (${l.filter(t => t.st == 2).length}/${l.length})</span></div>${l.map(t => tcard(t, null, U()[me].role == 'manager')).join('') || '<p class="mu">No tasks yet.</p>'}</div>`;
}

const teamView = () => `<div class="two">${Object.keys(U()).filter(k => U()[k].role == 'employee').map(k => { 
  const user = U()[k];
  const l = S.tasks.filter(t => t.to == k), p = pct(l); 
  return `<div class="card"><div class="row">${av(k)}<div><b>${esc(user.name)}</b><div class="mu">${esc(user.title)}</div><div class="mu" style="font-size:11px">Last active: ${ago(user.lastLogin)}</div></div></div><p class="mu" style="margin-top:12px">${l.filter(t => t.st == 0).length} to do · ${l.filter(t => t.st == 1).length} in progress · ${l.filter(t => t.st == 2).length} completed · <span class="${l.some(over) ? 'al' : ''}">${l.filter(over).length} overdue</span></p><div class="bar"><i style="width:${p}%;background:var(--ok)"></i></div><p class="mu" style="margin-top:6px">${p}% efficiency</p></div>`; 
}).join('')}</div>`;

const calView = () => {
  const l = (U()[me].role == 'manager' ? S.tasks : S.tasks.filter(t => t.to == me)).filter(t => t.st < 2).sort((a, b) => a.due.localeCompare(b.due)), days = [...new Set(l.map(t => t.due))];
  return `<div class="card"><h2>Upcoming deadlines</h2>${days.map(d => `<h3 style="margin:16px 0 0;font-size:14px">${d} <span class="mu">${dueTx(l.find(t => t.due == d))}</span></h3>${l.filter(t => t.due == d).map(t => `<div class="it row sp"><span><b>${esc(t.title)}</b><br><span class="mu">${esc(U()[t.to].name)}</span></span><span class="pb p${t.pri}">${PN[t.pri]}</span></div>`).join('')}`).join('') || '<p class="mu">No upcoming deadlines.</p>'}</div>`;
};

function modalView() {
  if (modal == 'task') return `<div class="mod"><div class="card"><h2>Assign new task</h2><div class="fld"><input id="nt" placeholder="Task title"><select id="nto">${Object.keys(U()).filter(k => U()[k].role == 'employee').map(k => `<option value="${k}">${esc(U()[k].name)} · ${esc(U()[k].title)}</option>`).join('')}</select><select id="npr"><option value="1">Low priority</option><option value="2" selected>Medium priority</option><option value="3">High priority</option></select><input id="nd" type="date" value="${day(3)}"><div class="row"><button class="pri" onclick="addTask()">Assign task</button><button class="out" onclick="modal=null;draw()">Cancel</button></div></div></div></div>`;
  if (modal == 'rep') return `<div class="mod"><div class="card"><h2>Growth report</h2><pre style="margin-top:12px">${esc(report())}</pre><div class="row" style="margin-top:12px"><button class="pri" id="cp" onclick="copyRep()">Copy report</button><button class="out" onclick="modal=null;draw()">Close</button></div></div></div>`;
  if (modal == 'logout') return `<div class="mod"><div class="card" style="text-align:center;"><h2>Log out</h2><p class="mu" style="margin:12px 0 20px;">Are you sure you want to log out of WorkForce8?</p><div class="row" style="justify-content:center;gap:12px;"><button class="pri" onclick="logout()">Log out</button><button class="out" onclick="cancelTimeOutModal()">Cancel</button></div></div></div>`;
  if (modal == 'timein_prompt') return `<div class="mod"><div class="card" style="text-align:center;max-width:400px;"><div style="font-size:36px;margin-bottom:8px;">⏱️</div><h2>Start Your Work Session</h2><p class="mu" style="margin:10px 0 20px;">Welcome back, <b>${esc(U()[me].name)}</b>! Would you like to Time In now to start tracking your work hours?</p><div class="row" style="justify-content:center;gap:12px;"><button class="ok" style="font-weight:700;padding:10px 20px;" onclick="confirmTimeInPrompt()">▶ Time In Now</button><button class="out" onclick="modal=null;draw()">Skip for Now</button></div></div></div>`;
  return '';
}

function loginView() {
  const lg = '<div style="width:64px;height:64px;border-radius:18px;background:var(--ac);display:grid;place-items:center;margin:0 auto 14px;font-size:30px">⚡</div>';
  let b;
  if (!role) {
    b = `<h2 style="text-align:center">Login as?</h2>
    <button class="role" onclick="pick('manager')"><span class="ri">👤</span><span><b>Manager</b><br><span class="mu">Assign tasks & monitor growth</span></span><span style="margin-left:auto;color:var(--mu);font-size:20px">›</span></button>
    <button class="role" onclick="pick('employee')"><span class="ri">🧑‍💻</span><span><b>Employee</b><br><span class="mu">View tasks & report progress</span></span><span style="margin-left:auto;color:var(--mu);font-size:20px">›</span></button>
    <div class="mu" style="border-top:1px solid var(--bd);margin-top:22px;padding-top:18px;text-align:center">Don’t have an account? <a onclick="pick('employee');reg=true;draw()">Register</a></div>
    <p class="mu" style="text-align:center;margin-top:12px">Demo password 1234: alex (manager), sarah, michael, emma</p>`;
  } else {
    b = `<button class="out" style="padding:6px 14px;font-size:12px;margin-bottom:14px;display:inline-flex;align-items:center;gap:4px;" onclick="goBackRole()">← Back</button>
    <h2>${reg ? 'Register as ' : 'Login as '}${role}</h2>
    <div class="fld">
      ${reg ? '<input id="rn" placeholder="Full name"><input id="ru" placeholder="Username" autocomplete="off"><input id="rp" type="password" placeholder="Password">' : '<input id="lu" placeholder="Username" autocomplete="off"><input id="lp" type="password" placeholder="Password" onkeydown="if(event.key==\'Enter\')doLogin()">' }
      <button class="pri" onclick="${reg ? 'doReg()' : 'doLogin()'}">${reg ? 'Create account' : 'Log in'}</button>
    </div>
    <div class="err">${msg}</div>
    <p class="mu" style="text-align:center;margin-top:14px">${reg ? 'Already registered?' : 'Don’t have an account?'} <a onclick="reg=!reg;msg='';draw()">${reg ? 'Log in' : 'Register'}</a></p>`;
  }
  return `<div class="login"><div><div style="position:fixed;top:calc(14px + env(safe-area-inset-top,0px));right:14px">${tog()}</div>${lg}<h1 style="font-size:34px;font-weight:800">WorkForce<span style="color:var(--ac)">8</span></h1><p style="color:#94a3b8;margin:6px 0 24px">Sustainable Growth through Decent Work</p><div class="box">${b}</div><div style="display:inline-flex;gap:10px;align-items:center;margin-top:28px;padding:10px 18px;border-radius:99px;background:#ffffff12;color:#94a3b8;font-weight:700;font-size:12px"><span style="background:#334155;border-radius:6px;padding:2px 7px">8</span>Decent Work & Growth</div></div></div>`;
}

function draw() {
  const a = $('app');
  if (!a) return;
  if (!me) { a.innerHTML = loginView(); return; }
  const m = U()[me].role == 'manager', h = new Date().getHours(), gr = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening', open = S.tasks.filter(t => t.to == me && t.st < 2).length, p = S.punch[me] || {};
  
  const nav = m ? [['dash', '◔', 'Dashboard'], ['tasks', '☰', 'Tasks'], ['team', '👥', 'Team'], ['cpu', '⚙', 'CPU Lab']] : [['dash', '⌂', 'Home'], ['tasks', '☰', 'Tasks'], ['cal', '📅', 'Calendar']];
  
  const realTimeBadge = `<span class="pill" style="background:rgba(255,255,255,0.06);color:#94a3b8;font-weight:500;white-space:nowrap;">⏱️ <span id="rtc">${formatRealTime()}</span></span>`;
  const isTimedIn = !!(p && p.since);

  const hd = view == 'dash' ? (m ? `<div class="hd card"><div><h1>Manager Dashboard</h1><p class="mu">Welcome back, ${esc(U()[me].name)}. Monitoring ${S.tasks.filter(t => t.st < 2).length} active tasks.</p></div><div class="row" style="flex-wrap:wrap;gap:8px;"><input placeholder="Search tasks…" style="width:180px" oninput="q=this.value;$('al').innerHTML=activeList()"><span class="pill">● LIVE GROWTH</span>${realTimeBadge}${tog()}</div></div>`
    : `<div class="hd card"><div><h1>Good ${gr}, ${esc(U()[me].name)}!</h1><p class="mu">You have <b style="color:var(--ac)">${open} task${open == 1 ? '' : 's'}</b> to focus on today.</p></div>
    <div class="row" style="flex-wrap:wrap;gap:12px;align-items:center;">
      <div style="text-align:right">
        <div class="mu" style="letter-spacing:.08em;font-weight:700">WORK TIMER</div>
        <b id="ft" style="font-size:18px;font-family:monospace;color:${isTimedIn ? 'var(--ok, #10b981)' : 'var(--mu, #94a3b8)'}">${focusTx()}</b>
      </div>
      <button class="${isTimedIn ? 'out' : 'ok'}" onclick="toggleTimeInOut()" style="font-weight:700;padding:8px 16px;">
        ${isTimedIn ? '⏱️ Time Out' : '▶ Time In'}
      </button>
      ${realTimeBadge}
      ${tog()}
    </div></div>`)
    : `<div class="hd card"><div><h1>${{ tasks: 'Tasks', team: 'Team', cal: 'Calendar', cpu: 'CPU Lab' }[view]}</h1><p class="mu">${esc(U()[me].name)} · ${esc(U()[me].title)}</p></div><div class="row">${realTimeBadge}${tog()}</div></div>`;
  
  const sidebarContent = `<nav class="side">
    <button class="lg ${m ? '' : 'gr'}" title="WorkForce8">⚡</button>
    ${nav.map(([k, i, t]) => `<button class="${view == k ? 'on' : ''}" title="${t}" aria-label="${t}" onclick="view='${k}';draw()">${i}</button>`).join('')}
    <span class="grow"></span>
    <button title="${esc(U()[me].name)} - Click to log out" aria-label="Log out" onclick="modal='logout';draw()">${av(me)}</button>
  </nav>`;

  const currentViewContent = view == 'dash' ? (m ? `<main class="mg"><div class="lc">${hd}${mgrLeft()}</div><aside class="rc">${mgrRight()}</aside></main>` : `<main>${hd}${empDash()}</main>`)
    : `<main>${hd}${view == 'tasks' ? tasksView() : view == 'team' ? teamView() : view == 'cal' ? calView() : (m ? cpuView() : tasksView())}</main>`;

  a.innerHTML = `<div class="app">${sidebarContent}${currentViewContent}</div>${modalView()}`;
}

cpuReset();
draw();