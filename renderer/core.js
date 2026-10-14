/* 성현교회 재정 — 데이터·계산 공통 */
'use strict';
const FD = window.FIN_DEFAULTS;
const API = window.finAPI || null;            // Electron 이면 있음, 미리보기(브라우저)면 없음
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const now = () => Date.now();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => (n ? Math.round(n).toLocaleString('ko-KR') : '-');
const won0 = n => Math.round(n || 0).toLocaleString('ko-KR');
const pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : null);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const lastSunday = (s = today()) => { const d = parseISO(s); d.setDate(d.getDate() - d.getDay()); return iso(d); };
const isSunday = s => parseISO(s).getDay() === 0;
const dotDate = s => { const [y, m, d] = s.split('-'); return `${y}. ${+m}. ${+d}.`; };
const korDate = s => { const [y, m, d] = s.split('-'); return `${y}년 ${+m}월 ${+d}일`; };
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const yearOf = s => +s.slice(0, 4);
const qOf = s => Math.floor((+s.slice(5, 7) - 1) / 3) + 1;
const qRange = (y, q) => [`${y}-${pad((q - 1) * 3 + 1)}-01`, iso(new Date(y, q * 3, 0))];

/** 금액 문자열 → 숫자 ("10,000", "1만", "3만5천" 허용) */
function parseAmt(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? Math.round(v) : 0;
  let s = String(v).replace(/[,\s원₩]/g, '');
  if (!s) return 0;
  const m = s.match(/^(-?\d+(?:\.\d+)?)만(?:(\d+)천)?$/);
  if (m) return Math.round(+m[1] * 10000 + (m[2] ? +m[2] * 1000 : 0));
  const t = s.match(/^(-?\d+(?:\.\d+)?)천$/);
  if (t) return Math.round(+t[1] * 1000);
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return isFinite(n) ? Math.round(n) : 0;
}

/* ---------- 데이터 ---------- */
let db = null;
function blankDB() {
  return {
    v: 1, createdAt: now(),
    settings: {
      church: { ...FD.church },
      offeringCols: [...FD.offeringCols],
      sheetId: '1SEj0VlbOC2xFh16rUCeN2VSQYF5Q7_Ib-t9PHmymHCs',
      counters: '',                       // 주간 집계표 담당자
      receipt: { code: '41', kind: '금전', law: '소득세법 제34조제3항제1호', issuer: '' },
      rollUrl: '', rollKey: '',          // 교적관리 시트(출석부 웹앱) — 읽기만
      lockHash: '', showAllDonors: true
    },
    accounts: FD.accounts.map(a => ({ id: uid(), ...a })),
    donors: [{ id: 'anon', no: 999, name: '무명', anon: true, title: '', phone: '', address: '', rrn: '', note: '' }],
    offerings: [],   // {id,date(주일),donorId,ch:'off'|'on',a:{헌금종류:금액},memo,note,keys:[],t}
    deposits: [],    // 현금입금(통장) {id,date(주일),amount,memo,key}
    bank: null,      // 마지막 통장 잔액 {balance,time}
    incomes: [],     // {id,date,acc,kind,amount,memo,key,t}  acc 비면 kind로 계정 연결
    expenses: [],    // {id,date,acc,amount,payee,memo,proof,approve,t}
    budgets: {},     // {"2026": {항: 금액}}
    receipts: {},    // {"2026": {donorId: 일련번호}}
    log: []
  };
}
/** 앱에서 지운 총입출금 거래 기억 — 다시 올려도 들어오지 않게 */
function rememberDeleted(x, what) {
  const k = x.key || (typeof keyOf === 'function' ? keyOf(x) : ''); if (!k) return;
  (db.deleted = db.deleted || []).push({ key: k, what, date: x.date, time: x.time || '', amount: x.amount, memo: x.memo || '', acc: x.acc || x.kind || '', at: now() });
}
function migrate(d) {
  const b = blankDB();
  d.settings = Object.assign(b.settings, d.settings || {});
  d.settings.church = Object.assign(b.settings.church, d.settings.church || {});
  d.settings.receipt = Object.assign(b.settings.receipt, d.settings.receipt || {});
  for (const k of ['accounts', 'donors', 'offerings', 'incomes', 'expenses', 'deposits', 'log']) d[k] = d[k] || b[k];
  for (const a of d.accounts) { a.kinds = a.kinds || (a.col ? [a.col] : []); a.mid = a.mid || ''; a.code = a.code || ''; a.note = a.note || ''; if (a.receipt == null) a.receipt = a.type === '수입' && !!a.kinds.length; }
  for (const o of d.offerings) o.ch = o.ch || 'off';
  d.budgets = d.budgets || {}; d.receipts = d.receipts || {}; d.deleted = d.deleted || [];
  if (!d.donors.some(x => x.anon)) d.donors.push(b.donors[0]);
  return d;
}
async function loadDB() {
  let d = null;
  if (API) d = await API.loadData();
  else { try { d = JSON.parse(localStorage.getItem('sh-fin') || 'null'); } catch { d = null; } }
  db = migrate(d || blankDB());
}
let saveTimer = null, saveState = '';
function save(immediate) {
  clearTimeout(saveTimer);
  const go = async () => {
    try {
      if (API) await API.saveData(db); else localStorage.setItem('sh-fin', JSON.stringify(db));
      saveState = '저장됨 ' + new Date().toTimeString().slice(0, 5);
    } catch (e) { saveState = '저장 실패: ' + e.message; }
    const el = $('#savestate'); if (el) el.textContent = saveState;
  };
  if (immediate) return go();
  saveTimer = setTimeout(go, 400);
}
function logAct(text) { db.log.unshift({ t: now(), text }); db.log.length = Math.min(db.log.length, 300); }

/* ---------- 조회 ---------- */
const cols = () => db.settings.offeringCols;
const donorById = id => db.donors.find(d => d.id === id);
/** 이름 검색: '김명', 'ㄱㅁ', '김ㅁ'처럼 초성으로도 찾기 */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const choOf = ch => { const c = ch.charCodeAt(0) - 0xAC00; return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch; };
function nameMatch(name, q) {
  const n = String(name).replace(/\s/g, ''), k = String(q).replace(/\s/g, '');
  if (!k) return true;
  if (n.includes(k)) return true;
  for (let i = 0; i + k.length <= n.length; i++) {
    let ok = true;
    for (let j = 0; j < k.length && ok; j++) { const a = n[i + j], b = k[j]; ok = a === b || (CHO.includes(b) && choOf(a) === b); }
    if (ok) return true;
  }
  return false;
}
/** 주민번호 정리: 숫자 13자리 → 000000-0000000 (엑셀 숫자로 앞 0이 빠진 12자리도 복구) */
function normRRN(v) {
  if (v == null || v === '') return '';
  let d = String(typeof v === 'number' ? Math.round(v) : v).replace(/[^\d]/g, '');
  if (d.length === 12) d = '0' + d;
  return d.length === 13 ? d.slice(0, 6) + '-' + d.slice(6) : String(v).trim();
}
const rrnOk = v => /^\d{6}-\d{7}$/.test(v || '');
const normName = s => String(s || '').replace(/\s+/g, ' ').trim();
const donorByName = n => { const k = normName(n).replace(/\s/g, ''); return db.donors.find(d => d.name.replace(/\s/g, '') === k); };
/** 정렬: 가나다순(기본) 또는 번호순. 무명은 항상 맨 아래 */
const donorCmp = (a, b) => (a.anon - b.anon) || ((db.settings.sortBy || 'name') === 'name' ? a.name.localeCompare(b.name, 'ko') : ((a.no - b.no) || a.name.localeCompare(b.name, 'ko')));
const activeDonors = () => db.donors.filter(d => !d.inactive).sort(donorCmp);
const accByHang = h => db.accounts.find(a => a.hang === h);
const normKind = k => String(k || '').replace(/\s+/g, ' ').trim();
const accOfKind = k => { k = normKind(k); return k ? db.accounts.find(a => a.kinds.includes(k)) : null; };
const accOfCol = accOfKind;
const accLabel = a => a ? (a.label || (a.code ? `${a.code}.${a.hang}` : a.hang)) : '';
const incAcc = x => x.acc ? accByHang(x.acc) : accOfKind(x.kind);
const isCarry = a => a && a.gwan === '이월금';
function nextDonorNo() { return Math.max(0, ...db.donors.filter(d => !d.anon).map(d => d.no || 0)) + 1; }
function ensureDonor(name, extra) {
  const n = normName(name);
  if (!n) return null;
  if (/^무명/.test(n)) return donorById('anon');
  let d = donorByName(n);
  if (!d) { d = { id: uid(), no: nextDonorNo(), name: n, title: '', phone: '', address: '', rrn: '', note: '', ...(extra || {}) }; db.donors.push(d); }
  return d;
}
const rowTotal = o => cols().reduce((s, c) => s + (o.a[c] || 0), 0) + Object.keys(o.a).filter(k => !cols().includes(k)).reduce((s, k) => s + (o.a[k] || 0), 0);
const offeringsOn = (date, ch) => db.offerings.filter(o => o.date === date && (!ch || o.ch === ch));
const offeringDates = () => [...new Set(db.offerings.map(o => o.date))].sort();
function sumByCol(list) { const r = {}; for (const c of cols()) r[c] = 0; for (const o of list) for (const [k, v] of Object.entries(o.a)) r[k] = (r[k] || 0) + (v || 0); return r; }
const inRange = (s, a, b) => s >= a && s <= b;

/** 미분류 헌금종류 목록 [{kind, amount, n}] */
function unclassified(from, to) {
  const m = new Map();
  const add = (k, v) => { const e = m.get(k) || { kind: k, amount: 0, n: 0 }; e.amount += v; e.n++; m.set(k, e); };
  for (const o of db.offerings) if (inRange(o.date, from, to)) for (const [k, v] of Object.entries(o.a)) if (v && !accOfKind(k)) add(k || '(종류 없음)', v);
  for (const x of db.incomes) if (inRange(x.date, from, to) && !incAcc(x)) add(x.kind || x.acc || '(종류 없음)', x.amount);
  return [...m.values()].sort((a, b) => b.amount - a.amount);
}
/** 기간 실적: 항 → 금액 (헌금은 연결된 열에서) */
function actuals(from, to) {
  const r = {};
  for (const a of db.accounts) r[a.hang] = 0;
  const off = sumByCol(db.offerings.filter(o => inRange(o.date, from, to)));
  for (const [c, v] of Object.entries(off)) { if (!v) continue; const a = accOfKind(c); if (a) r[a.hang] += v; else r['(미분류:' + (c || '종류 없음') + ')'] = (r['(미분류:' + (c || '종류 없음') + ')'] || 0) + v; }
  for (const x of db.incomes) if (inRange(x.date, from, to)) { const a = incAcc(x); const k = a ? a.hang : '(미분류:' + (x.kind || '종류 없음') + ')'; r[k] = (r[k] || 0) + x.amount; }
  for (const x of db.expenses) if (inRange(x.date, from, to)) r[x.acc] = (r[x.acc] || 0) + x.amount;
  return r;
}
const yearRange = y => [`${y}-01-01`, `${y}-12-31`];
const typeOf = h => (accByHang(h) || {}).type;
function totals(act, opt = {}) {
  let inc = 0, exp = 0, carry = 0;
  for (const [h, v] of Object.entries(act)) {
    const a = accByHang(h);
    if (!a) { if (h.startsWith('(미분류')) inc += v; continue; }
    if (a.type === '지출') exp += v; else if (isCarry(a)) carry += v; else inc += v;
  }
  return { inc, exp, carry };
}
/** y년 d일 시작 시점 잔액(이월금 + 그 전 수입 − 지출) */
function balanceBefore(y, d) {
  const t1 = totals(actuals(`${y}-01-01`, `${y}-12-31`));
  const before = d > `${y}-01-01` ? totals(actuals(`${y}-01-01`, addDays(d, -1))) : { inc: 0, exp: 0 };
  return t1.carry + before.inc - before.exp;
}
function budgetOf(y) { return db.budgets[String(y)] || {}; }
function groupAccounts(type) {
  const out = [];
  for (const a of db.accounts.filter(x => x.type === type)) {
    let g = out.find(x => x.gwan === a.gwan);
    if (!g) out.push(g = { gwan: a.gwan, items: [] });
    g.items.push(a);
  }
  return out;
}

/* ---------- 공통 UI ---------- */
function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function modal(html, opt = {}) {
  const L = $('#layer');
  L.innerHTML = `<div class="ov" data-ov><div class="dlg ${opt.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const ov = L.firstElementChild;
  ov.addEventListener('mousedown', e => { if (e.target === ov && !opt.sticky) closeModal(); });
  const f = ov.querySelector('[autofocus]') || ov.querySelector('input,select,button'); if (f) setTimeout(() => f.focus(), 30);
  return ov.firstElementChild;
}
const closeModal = () => { $('#layer').innerHTML = ''; };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#layer').innerHTML && !$('[data-ov] .dlg[data-sticky]')) closeModal(); });
function confirmBox(msg, okText = '확인', danger) {
  return new Promise(res => {
    const d = modal(`<h2>확인</h2><p style="white-space:pre-line">${esc(msg)}</p><div class="acts"><button class="btn" data-x>취소</button><button class="btn ${danger ? 'danger' : 'pri'}" data-ok>${esc(okText)}</button></div>`);
    d.querySelector('[data-x]').onclick = () => { closeModal(); res(false); };
    d.querySelector('[data-ok]').onclick = () => { closeModal(); res(true); };
  });
}
async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sh-fin:' + s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- 파일 저장 ---------- */
async function saveBytes(name, bytes) {
  if (API) return API.saveFile(name, bytes);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes])); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000); return true;
}
async function saveXLSX(name, wb) { return saveBytes(name, XLSX.write(wb, { type: 'array', bookType: 'xlsx' })); }
async function savePDF(name, html, opt) {
  if (API) return API.savePDF(name, html, opt);
  const w = window.open('', '_blank'); if (!w) return false;
  w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); return true;
}
async function pickFile(exts) {
  if (API) return API.openFile(exts);
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = exts.map(e => '.' + e).join(',');
    i.onchange = async () => { const f = i.files[0]; if (!f) return res(null); res({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }); };
    i.click();
  });
}
