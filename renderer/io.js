/* 성현교회 재정 — 가져오기 (총입출금내역 / 수입·지출예산서 / 기본 양식 / 구글 헌금집계 주간 블록) */
'use strict';

const HEAD_ALIAS = {
  '구제기타': '기타', '기타헌금': '기타', '부활절': '부활', '맥추감사': '맥추', '맥추절': '맥추', '추수감사절': '추수감사', '추수': '추수감사',
  '성탄감사': '성탄', '성탄절': '성탄', '신년감사': '신년', '주일': '주일헌금'
};
const normHead = s => String(s ?? '').replace(/[\s·.\-_/()]/g, '').replace(/헌금$/, '');
const SKIP_NAME = /^(합\s*계|소\s*계|총\s*계|계|누\s*계|합|total)$|합계|소계|총계/i;

/** 셀 값 → YYYY-MM-DD (못 읽으면 '') */
function cellDate(v, fallbackYear) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v)) { const d = new Date(v.getTime() + 12 * 3600e3); return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate())); }
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400e3)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
  const s = String(v).trim();
  let m = s.match(/(\d{4})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})\s*[월./]\s*(\d{1,2})\s*일?$/);
  if (m && fallbackYear) return `${fallbackYear}-${pad(m[1])}-${pad(m[2])}`;
  return '';
}
const titleDate = row => { if (row.filter(c => c != null && c !== '').length > 3) return ''; for (const c of row) { if (typeof c === 'string' && /\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/.test(c)) return cellDate(c); } return ''; };

/** 머리글 줄인지 판단하고 열 지도 반환 */
function headerMap(row) {
  const m = { cols: {}, name: -1, no: -1, date: -1, memo: -1, note: -1 };
  const known = new Map(cols().map(c => [normHead(c), c]));
  row.forEach((h, i) => {
    if (typeof h !== 'string') return;
    const n = normHead(h);
    if (!n) return;
    if (n === '이름' || n === '성명' || n === '헌금자') m.name = i;
    else if (n === '번호' || n === 'NO' || n === 'no' || n === 'No') m.no = i;
    else if (n === '날짜' || n === '일자' || n === '주일') { if (n !== '주일' || m.date < 0) m.date = i; }
    else if (n === '내용') m.memo = i;
    else if (n === '비고' || n === '메모') m.note = i;
    else if (known.has(n)) m.cols[i] = known.get(n);
    else if (HEAD_ALIAS[n] && cols().includes(HEAD_ALIAS[n])) m.cols[i] = HEAD_ALIAS[n];
    else if (accOfKind(h)) m.cols[i] = normKind(h);
    else if (/^합계|^계$|^총/.test(n)) { /* 합계 열은 무시 */ }
    else if (m.unknown) m.unknown.push(h); else m.unknown = [h];
  });
  return m.name >= 0 && Object.keys(m.cols).length >= 2 ? m : null;
}

/** 워크북 → 가져올 내용 */
function parseWorkbook(wb, srcName) {
  const out = { src: srcName, offerings: [], donors: [], incomes: [], expenses: [], deposits: [], budgets: [], donorInfo: [], accounts: null, expAccounts: null, bank: null, warn: [], sheets: [] };
  const rowsOf = ws => XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
  const isExample = r => r.some(c => typeof c === 'string' && /^예시/.test(c.trim()));
  const hdr = (r, names) => { const idx = {}; r.forEach((h, i) => { const n = normHead(h); for (const [k, alts] of Object.entries(names)) if (alts.includes(n)) idx[k] = i; }); return idx; };

  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn]; const rows = rowsOf(ws);
    if (!rows.length) continue;
    const name = sn.replace(/\s/g, '');

    // 교인 인적사항(주민번호) 엑셀 — 시트 이름·열 순서 무관. 이름 + 주민번호(또는 앞/뒷자리) 열이 있으면
    const rh = rows.slice(0, 6).findIndex(r => r.some(c => /^(이름|성명|교인명)$/.test(normHead(c))) && r.some(c => /주민/.test(String(c || ''))));
    if (rh >= 0 && !rows.slice(0, 6).some(r => r.some(c => normHead(c) === '헌금종류'))) { parseDonorInfo(rows, rh, sn, out); continue; }
    // 총입출금내역 (거래일시·내용·출금·입금·거래후 잔액·지출계정과목·비고·헌금종류·Month·현금입금)
    const lh = rows.slice(0, 6).findIndex(r => r.some(c => normHead(c) === '헌금종류') && r.some(c => /^(입금|출금)$/.test(normHead(c))));
    if (lh >= 0) { parseLedger(rows, lh, sn, out); continue; }
    // 수입예산서 (관·항·목·예산액)
    const ih = rows.slice(0, 12).findIndex(r => r.some(c => normHead(c) === '목') && r.some(c => normHead(c) === '관'));
    if (ih >= 0 && rows.slice(0, 12).some(r => r.some(c => normHead(c) === '예산액'))) { parseIncomeBudget(rows, ih, sn, out); continue; }
    // 지출예산서 (순위·항목·년간 예산 금액)
    const eh = rows.slice(0, 8).findIndex(r => r.some(c => normHead(c) === '순위') && r.some(c => /예산/.test(String(c || ''))));
    if (eh >= 0) { parseExpenseBudget(rows, eh, sn, out); continue; }

    if (name === '계정과목') {
      const h = hdr(rows[0], { type: ['구분'], gwan: ['관'], mid: ['항'], code: ['번호'], hang: ['목항목', '목', '항목'], kinds: ['연결된헌금종류'], note: ['비고'] });
      if (h.type == null || h.hang == null) continue;
      out.accounts = rows.slice(1).filter(r => r[h.hang] && /^(수입|지출)$/.test(String(r[h.type] || '').trim()))
        .map(r => ({ type: String(r[h.type]).trim(), gwan: String(r[h.gwan] ?? '').trim(), mid: String(r[h.mid] ?? '').trim(), code: String(r[h.code] ?? '').trim(), hang: String(r[h.hang]).trim(),
          kinds: String(r[h.kinds] ?? '').split(',').map(normKind).filter(Boolean), note: String(r[h.note] ?? '').trim() }));
      out.sheets.push(`${sn}: 계정 ${out.accounts.length}개`);
      continue;
    }
    if (name === '헌금자명단') {
      const h = hdr(rows[0], { no: ['번호'], name: ['이름', '성명'], title: ['직분'], phone: ['연락처', '전화'], address: ['주소영수증용', '주소'], rrn: ['주민등록번호영수증용선택', '주민등록번호'], note: ['비고'] });
      if (h.name == null) continue;
      for (const r of rows.slice(1)) {
        if (!r[h.name] || isExample(r)) continue;
        out.donors.push({ no: +r[h.no] || 0, name: normName(r[h.name]), title: r[h.title] || '', phone: r[h.phone] || '', address: r[h.address] || '', rrn: normRRN(r[h.rrn]), note: r[h.note] || '' });
      }
      out.sheets.push(`${sn}: ${out.donors.length}명`);
      continue;
    }
    if (name === '기타수입') {
      const h = hdr(rows[0], { date: ['날짜'], acc: ['계정', '항계정'], amount: ['금액'], memo: ['내용'] });
      if (h.date == null || h.acc == null) continue;
      let n = 0;
      for (const r of rows.slice(1)) {
        if (isExample(r) || !r[h.acc]) continue;
        const date = cellDate(r[h.date]), amount = parseAmt(r[h.amount]);
        if (!date || !amount) { out.warn.push(`${sn}: 날짜·금액을 읽지 못한 줄 건너뜀 (${r[h.acc]})`); continue; }
        out.incomes.push({ date, acc: String(r[h.acc]).trim(), amount, memo: r[h.memo] || '' }); n++;
      }
      out.sheets.push(`${sn}: ${n}건`);
      continue;
    }
    if (name === '지출내역') {
      const h = hdr(rows[0], { date: ['날짜'], acc: ['계정항', '계정', '항'], amount: ['금액'], payee: ['지급처'], memo: ['내용'], proof: ['증빙'], approve: ['결재'] });
      if (h.date == null || h.acc == null) continue;
      let n = 0;
      for (const r of rows.slice(1)) {
        if (isExample(r) || !r[h.acc]) continue;
        const date = cellDate(r[h.date]), amount = parseAmt(r[h.amount]);
        if (!date || !amount) { out.warn.push(`${sn}: 날짜·금액을 읽지 못한 줄 건너뜀 (${r[h.acc]})`); continue; }
        out.expenses.push({ date, acc: String(r[h.acc]).trim(), amount, payee: r[h.payee] || '', memo: r[h.memo] || '', proof: r[h.proof] || '', approve: r[h.approve] || '' }); n++;
      }
      out.sheets.push(`${sn}: ${n}건`);
      continue;
    }
    if (name === '예산') {
      const h = hdr(rows[0], { year: ['연도'], hang: ['항계정', '항', '계정'], amount: ['예산액', '예산'] });
      if (h.year == null || h.hang == null) continue;
      let n = 0;
      for (const r of rows.slice(1)) {
        const y = +r[h.year], amt = parseAmt(r[h.amount]);
        if (!y || !r[h.hang] || !amt) continue;
        out.budgets.push({ year: y, hang: String(r[h.hang]).trim(), amount: amt }); n++;
      }
      out.sheets.push(`${sn}: 예산 ${n}항목`);
      continue;
    }

    // 그 밖의 시트 → 헌금 (기본 양식 '헌금내역' 또는 구글시트 주간 블록)
    let map = null, curDate = '', n = 0, lastYear = new Date().getFullYear();
    for (const r of rows) {
      const td = titleDate(r);
      if (td) { curDate = td; lastYear = yearOf(td); map = null; continue; }
      const hm = headerMap(r);
      if (hm) { map = hm; if (hm.unknown) out.warn.push(`${sn}: 모르는 열 무시 — ${hm.unknown.join(', ')}`); continue; }
      if (!map) continue;
      const nm = r[map.name];
      if (nm == null || String(nm).trim() === '') continue;
      if (SKIP_NAME.test(String(nm).trim()) || (map.no >= 0 && SKIP_NAME.test(String(r[map.no] || '').trim()))) continue;
      if (isExample(r)) continue;
      const date = map.date >= 0 ? cellDate(r[map.date], lastYear) : curDate;
      const a = {}; let any = false;
      for (const [i, c] of Object.entries(map.cols)) { const v = parseAmt(r[i]); if (v) { a[c] = (a[c] || 0) + v; any = true; } }
      if (!any) continue;
      if (!date) { out.warn.push(`${sn}: 날짜를 알 수 없어 건너뜀 — ${nm}`); continue; }
      out.offerings.push({ date, name: normName(nm), no: map.no >= 0 ? +r[map.no] || 0 : 0, a, memo: map.memo >= 0 ? (r[map.memo] || '') : '', note: map.note >= 0 ? (r[map.note] || '') : '' });
      n++;
    }
    if (n) out.sheets.push(`${sn}: 헌금 ${n}줄`);
  }
  // 오프라인: 같은 주일·같은 이름 여러 줄 → 한 줄로 합침 (온라인은 거래마다 따로)
  const merged = new Map(), online = [];
  for (const o of out.offerings) {
    if (o.ch === 'on') { online.push(o); continue; }
    const k = o.date + '|' + o.name.replace(/\s/g, '');
    const p = merged.get(k);
    if (!p) { merged.set(k, { ...o, ch: 'off', a: { ...o.a } }); continue; }
    for (const [c, v] of Object.entries(o.a)) p.a[c] = (p.a[c] || 0) + v;
    p.memo = [p.memo, o.memo].filter(Boolean).join(' / ');
  }
  out.offerings = [...merged.values(), ...online];
  return out;
}

/* ---------- 총입출금내역 ---------- */
const KIND_WORDS = /(십일조헌금|십일조|감사헌금|감사현금|감사|주정헌금|주정|선교헌금|선교|구제헌금|구제|건축헌금|건축|장학헌금|장학|부활절|부활|맥추감사|맥추|신년감사|송구영신|찬조금|찬조|수련회비|수련회|회비|헌금|권사님|집사님|장로님|목사님|선교사님|권사|집사|장로|성도|님)/g;
const GROUP_NAME = /(구역|전도회|선교회|교회|청년회|여인들)$/;
function ymdTime(v) {
  if (v == null || v === '') return { d: '', t: '' };
  if (v instanceof Date && !isNaN(v)) return { d: cellDate(v), t: '' };
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
  return m ? { d: `${m[1]}-${pad(m[2])}-${pad(m[3])}`, t: m[4] ? `${m[1]}-${pad(m[2])}-${pad(m[3])} ${m[4]}` : '' } : { d: '', t: '' };
}
/** 통장 내용 → 헌금자 이름 (못 찾으면 '') */
function donorNameFrom(raw, known) {
  const s = String(raw || '').replace(/\s+/g, '');
  if (!s) return '';
  if (/^(무명|무기명)/.test(s)) return '무명';
  let best = '';
  for (const k of known) if (k.length >= 2 && s.includes(k) && k.length > best.length) best = k;
  if (best) return best;
  const c = s.replace(/\([^)]*\)/g, '').replace(KIND_WORDS, '');
  return /^[가-힣]{2,4}$/.test(c) && !/(오후|예배|무기명|주일|입금|이자)/.test(c) ? c : '';
}
function parseLedger(rows, hi, sn, out) {
  const H = rows[hi], col = re => H.findIndex(c => re.test(normHead(c)));
  const C = { t: col(/^거래일시|^일시|^거래일/), memo: col(/^내용$/), out: col(/^출금$/), in: col(/^입금$/), bal: col(/^거래후잔액|^잔액/),
    acc: col(/^지출계정과목/), ch: col(/^비고$/), kind: col(/^헌금종류$/), wk: col(/^Month$|^주일$|^월$/i), cash: col(/^현금입금$/) };
  const body = rows.slice(hi + 1);
  // 이름 사전: 기존 명단 + 이 파일의 오프라인 이름
  const known = new Set(db.donors.map(d => d.name.replace(/\s/g, '')));
  for (const r of body) if (r[C.memo] && parseAmt(r[C.in]) && (String(r[C.ch] || '').trim() === '오프라인' || (!ymdTime(r[C.t]).t && String(r[C.ch] || '').trim() !== '온라인'))) known.add(String(r[C.memo]).replace(/\s/g, ''));
  known.delete('무명');
  const off = [], counts = { off: 0, on: 0, inc: 0, exp: 0, dep: 0, nokind: 0 };
  let lastBal = null; const seen = new Map();
  body.forEach((r, i) => {
    const memo = r[C.memo] == null ? '' : String(r[C.memo]).trim();
    const { d: td, t: time } = ymdTime(r[C.t]);
    const wk = C.wk >= 0 ? cellDate(r[C.wk]) : '';
    const date = wk || td;
    const outAmt = parseAmt(r[C.out]), inAmt = parseAmt(r[C.in]), cash = C.cash >= 0 && typeof r[C.cash] === 'number' ? r[C.cash] : 0;
    const kind = normKind(C.kind >= 0 ? r[C.kind] : '');
    const ch = C.ch >= 0 ? String(r[C.ch] || '').trim() : '';
    if (C.bal >= 0 && typeof r[C.bal] === 'number' && time) lastBal = { balance: r[C.bal], time };
    if (!date && (outAmt || inAmt || cash)) { out.warn.push(`${sn} ${hi + i + 2}행: 날짜(Month)가 없어 건너뜀 — ${memo}`); return; }
    let key = time ? [time, memo, outAmt, inAmt, cash].join('|') : '';
    if (key) { const n = (seen.get(key) || 0) + 1; seen.set(key, n); if (n > 1) key += '#' + n; }   // 같은 시각·같은 내용 거래가 여러 건이면 순번
    if (cash) { out.deposits.push({ date, amount: cash, memo, key: key || [date, memo, cash].join('|') }); counts.dep++; }
    if (outAmt) {
      const acc = String(C.acc >= 0 ? r[C.acc] || '' : '').trim();
      out.expenses.push({ date, time, acc: acc || '(계정 없음)', amount: outAmt, payee: '', memo, proof: '', approve: '', key }); counts.exp++;
    }
    if (!inAmt) return;
    const a = accOfKind(kind);
    const offline = ch === '오프라인' || (!time && ch !== '온라인');   // 거래일시 없는 줄 = 손으로 적은 오프라인 헌금
    // 오프라인(현금)은 종류와 상관없이 주일 헌금으로 — 주차·회비·찬조도 그 주일 현금 합계·현금입금 대조에 들어가야 함
    if (!offline && (!kind || (a && !a.receipt))) {   // 온라인: 헌금 아닌 수입 또는 종류 빈칸 → 기타수입
      out.incomes.push({ date, time, kind, acc: '', amount: inAmt, memo, key: key || [date, memo, inAmt, kind, i].join('|') });
      if (!kind) counts.nokind++; counts.inc++; return;
    }
    if (offline) {
      const nm = /^무명/.test(memo.replace(/\s/g, '')) ? '무명' : (memo || '무명');
      if (!kind) counts.nokind++;
      off.push({ date, name: nm, no: 0, a: { [kind || '미분류']: inAmt }, memo: '', note: '', ch: 'off' }); counts.off++;
    } else {
      const nm = donorNameFrom(memo, known) || '무명';
      out.offerings.push({ date, name: nm, no: 0, a: { [kind]: inAmt }, memo: nm === '무명' || memo.replace(/\s/g, '') !== nm ? memo : '', note: '', ch: 'on', key: key || [date, memo, inAmt, kind, i].join('|') }); counts.on++;
    }
  });
  out.offerings.push(...off);
  if (lastBal) out.bank = lastBal;
  out.sheets.push(`${sn}: 오프라인 헌금 ${counts.off} · 온라인 헌금 ${counts.on} · 기타수입 ${counts.inc} · 지출 ${counts.exp} · 현금입금 ${counts.dep}`);
  if (counts.nokind) out.warn.push(`헌금종류가 빈 입금 ${counts.nokind}건 — '미분류'로 들어갑니다. 지출·기타수입 화면에서 계정을 정해 주세요.`);
  const accNames = new Set(db.accounts.filter(a => a.type === '지출').map(a => a.hang));
  const badAcc = [...new Set(out.expenses.map(x => x.acc).filter(a => !accNames.has(a)))];
  if (badAcc.length) out.warn.push(`지출예산에 없는 지출계정과목: ${badAcc.join(', ')}`);
}

/* ---------- 교인 인적사항(주민번호) ---------- */
function parseDonorInfo(rows, hi, sn, out) {
  const H = rows[hi].map(c => String(c ?? ''));
  const find = re => H.findIndex(c => re.test(normHead(c)));
  const cName = find(/^(이름|성명|교인명)$/), cA = find(/^주민.*(앞|생년)/), cB = find(/^주민.*(뒤|뒷)/), cR = cA < 0 ? find(/^주민/) : -1;
  const cAddr = find(/^주소/), cPhone = find(/^(연락처|전화|휴대폰|핸드폰)/);
  let n = 0, bad = 0;
  for (const r of rows.slice(hi + 1)) {
    const name = normName(r[cName]); if (!name) continue;
    let rrn = cR >= 0 ? normRRN(r[cR]) : (cA >= 0 && cB >= 0 ? normRRN(String(r[cA] ?? '').padStart(6, '0') + String(r[cB] ?? '')) : '');
    if (!rrn) continue;
    if (!rrnOk(rrn)) { bad++; continue; }
    out.donorInfo.push({ name, rrn, address: cAddr >= 0 ? String(r[cAddr] ?? '').trim() : '', phone: cPhone >= 0 ? String(r[cPhone] ?? '').trim() : '' }); n++;
  }
  out.sheets.push(`${sn}: 주민번호 ${n}명`);
  if (bad) out.warn.push(`${sn}: 주민번호 형식(13자리)이 아닌 ${bad}줄은 건너뜀`);
}

/* ---------- 수입·지출 예산서 ---------- */
const yearIn = rows => { for (const r of rows.slice(0, 5)) for (const c of r) { const m = String(c || '').match(/(\d{4})\s*년도/); if (m) return +m[1]; } return 0; };
function parseIncomeBudget(rows, hi, sn, out) {
  const H = rows[hi], y = yearIn(rows) || thisYearGuess();
  const cm = H.findIndex(c => normHead(c) === '목');
  let ca = rows.slice(0, hi + 2).map(r => r.findIndex(c => normHead(c) === '예산액')).find(i => i >= 0);
  let n = 0;
  for (const r of rows.slice(hi + 1)) {
    const m = String(r[cm] || '').trim().match(/^(\d{3})\.\s*(.+)$/);
    if (!m) continue;
    const amt = parseAmt(r[ca]); const a = db.accounts.find(x => x.code === m[1]) || accByHang(m[2].trim());
    if (!a) { out.warn.push(`${sn}: 앱 계정과목에 없는 목 — ${m[0]}`); continue; }
    if (amt) { out.budgets.push({ year: y, hang: a.hang, amount: amt }); n++; }
  }
  // 전년 이월
  for (let ri = 0; ri < hi; ri++) {
    const ci = rows[ri].findIndex(c => /이월/.test(String(c || '')));
    if (ci >= 0 && rows[ri + 1] && typeof rows[ri + 1][ci] === 'number') {
      const v = Math.round(rows[ri + 1][ci]);
      out.budgets.push({ year: y, hang: '전년도이월금', amount: v });
      out.incomes.push({ date: `${y}-01-01`, time: '', kind: '', acc: '전년도이월금', amount: v, memo: String(rows[ri][ci]).trim(), key: `carry-${y}` });
      out.sheets.push(`${sn}: 전년 이월 ${won0(v)}`);
      break;
    }
  }
  out.sheets.push(`${sn}: ${y}년 수입예산 ${n}개 목`);
}
function parseExpenseBudget(rows, hi, sn, out) {
  const H = rows[hi], y = yearIn(rows) || thisYearGuess();
  const cr = H.findIndex(c => normHead(c) === '순위'), ch = H.findIndex(c => /^항목/.test(normHead(c))), ca = H.findIndex(c => /예산/.test(String(c || ''))), cn = H.findIndex(c => normHead(c) === '비고');
  const list = [];
  for (const r of rows.slice(hi + 1)) {
    if (typeof r[cr] !== 'number' || !r[ch]) continue;
    list.push({ code: String(r[cr]), hang: String(r[ch]).trim(), amount: parseAmt(r[ca]), note: cn >= 0 && r[cn] ? String(r[cn]).trim() : '' });
  }
  out.expAccounts = list;
  for (const x of list) if (x.amount) out.budgets.push({ year: y, hang: x.hang, amount: x.amount });
  out.sheets.push(`${sn}: ${y}년 지출예산 ${list.length}개 항목`);
}
const thisYearGuess = () => new Date().getFullYear();

function readWorkbook(bytes) { return XLSX.read(bytes, { type: 'array', cellDates: true }); }

/** 미리보기 → 적용 */
/** v0.2.3 이전: 오프라인 주차·회비·찬조 등이 기타수입으로 들어간 것 */
const legacyOffIncomes = date => db.incomes.filter(x => x.date === date && !x.time && x.kind && x.key && x.key.startsWith(date + '|'));
function importPreview(P) {
  const byDate = new Map();
  for (const o of P.offerings.filter(o => o.ch !== 'on')) {
    let g = byDate.get(o.date); if (!g) byDate.set(o.date, g = { date: o.date, n: 0, sum: 0, rows: [] });
    g.n++; g.sum += Object.values(o.a).reduce((s, v) => s + v, 0); g.rows.push(o);
  }
  const nk = n => /^무명/.test(String(n).replace(/\s/g, '')) ? '무명' : String(n).replace(/\s/g, '');
  const add = (m, name, kind, v) => { if (!v) return; const k = nk(name) + '|' + kind; m.set(k, (m.get(k) || 0) + v); };
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).map(g => {
    const cur = offeringsOn(g.date, 'off');
    g.curN = cur.length; g.curSum = cur.reduce((s, o) => s + rowTotal(o), 0);
    g.legacy = legacyOffIncomes(g.date);
    // 이름·종류·금액을 한 칸씩 비교 (합계만 같아도 '같음'으로 보지 않음)
    const F = new Map(), C = new Map();
    for (const o of g.rows) for (const [k, v] of Object.entries(o.a)) add(F, o.name, k, v);
    for (const o of cur) { const d = donorById(o.donorId); for (const [k, v] of Object.entries(o.a)) add(C, d ? d.name : '?', k, v); }
    const CL = new Map(C); for (const x of g.legacy) add(CL, x.memo || '무명', x.kind, x.amount);
    const diff = (A, B) => [...new Set([...A.keys(), ...B.keys()])].filter(k => (A.get(k) || 0) !== (B.get(k) || 0))
      .map(k => { const [n, kind] = k.split('|'); return { name: n, kind, from: B.get(k) || 0, to: A.get(k) || 0 }; });
    g.changes = diff(F, C);
    g.status = !cur.length ? 'new' : !g.changes.length ? 'same' : (g.legacy.length && !diff(F, CL).length ? 'fix' : 'diff');
    g.pick = g.status === 'new' || g.status === 'fix';
    return g;
  });
}
/** 거래일시가 있는 줄의 '느슨한 키'(내용 빼고 일시·금액만) — 엑셀에서 내용·이름만 고친 거래를 같은 거래로 알아봄 */
const looseKey = k => { if (!k || !/^\d{4}-\d{2}-\d{2} \d/.test(k)) return null; const p = k.split('|'); return p.length >= 5 ? p[0] + '|' + p.slice(-3).join('|') : null; };
const haveKeys = () => { const k = new Set(); for (const o of db.offerings) for (const x of o.keys || []) k.add(x); return k; };
const keyOf = x => x.key || [x.date, x.acc || x.kind, x.amount, x.memo].join('|');
/** 새로 들어올 / 고쳐진 온라인 헌금·기타수입·지출·현금입금 개수 */
function importNewCounts(P) {
  const ok = haveKeys(), okL = new Set([...ok].map(looseKey).filter(Boolean));
  const sets = L => { const f = new Set(L.map(keyOf)); return { f, l: new Set([...f].map(looseKey).filter(Boolean)) }; };
  const I = sets(db.incomes), E = sets(db.expenses), D = sets(db.deposits);
  const cnt = (list, S, kf) => { let n = 0, u = 0; for (const x of list) { const k = kf(x); if (S.f.has(k)) continue; const lk = looseKey(k); if (lk && S.l.has(lk)) u++; else n++; } return [n, u]; };
  const [on, onU] = cnt(P.offerings.filter(o => o.ch === 'on'), { f: ok, l: okL }, o => o.key);
  const [inc, incU] = cnt(P.incomes, I, keyOf), [exp, expU] = cnt(P.expenses, E, keyOf), [dep, depU] = cnt(P.deposits, D, keyOf);
  return { on, inc, exp, dep, upd: onU + incU + expU + depU };
}

function applyImport(P, dates, opt = {}) {
  const res = { dates: 0, rows: 0, online: 0, newDonors: 0, donors: 0, incomes: 0, expenses: 0, deposits: 0, budgets: 0 };
  const before = db.donors.length;
  if (P.accounts && P.accounts.length && opt.accounts) {
    const old = new Map(db.accounts.map(a => [a.hang, a]));
    db.accounts = P.accounts.map(a => { const o = old.get(a.hang); return { ...a, id: o ? o.id : uid(), receipt: o ? o.receipt : a.type === '수입' && /^[123]\./.test(a.gwan) }; });
  }
  if (P.expAccounts && opt.expAccounts) {
    const keep = db.accounts.filter(a => a.type !== '지출'), old = new Map(db.accounts.map(a => [a.hang, a]));
    db.accounts = [...keep, ...P.expAccounts.map(x => ({ id: (old.get(x.hang) || {}).id || uid(), type: '지출', gwan: '', mid: '', code: x.code, hang: x.hang, kinds: [], receipt: false, note: x.note }))];
  }
  for (const d of P.donors) {
    let x = donorByName(d.name);
    if (!x) x = ensureDonor(d.name);
    if (d.no && !x.anon) x.no = d.no;
    for (const k of ['title', 'phone', 'address', 'rrn', 'note']) if (d[k]) x[k] = String(d[k]);
    res.donors++;
  }
  res.rrn = 0; res.rrnMiss = [];
  for (const d of P.donorInfo || []) {           // 주민번호: 명단에 있는 사람만 채움 (새로 추가하지 않음)
    const x = donorByName(d.name);
    if (!x || x.anon) { res.rrnMiss.push(d.name); continue; }
    x.rrn = d.rrn; if (!x.address && d.address) x.address = d.address; if (!x.phone && d.phone) x.phone = d.phone;
    res.rrn++;
  }
  for (const g of dates.filter(g => g.pick)) {
    db.offerings = db.offerings.filter(o => !(o.date === g.date && o.ch === 'off'));
    const lg = legacyOffIncomes(g.date); if (lg.length) { db.incomes = db.incomes.filter(x => !lg.includes(x)); res.fixed = (res.fixed || 0) + lg.length; }
    for (const o of g.rows) {
      const d = ensureDonor(o.name);
      db.offerings.push({ id: uid(), date: o.date, donorId: d.id, ch: 'off', a: o.a, memo: o.memo || '', note: o.note || '', t: now() });
      res.rows++;
    }
    res.dates++;
  }
  const ok = haveKeys();
  res.updated = 0;
  // 엑셀에서 고친 온라인 거래: 같은 일시·금액의 옛 기록을 빼고 새로 넣음
  const byLoose = new Map(); for (const r of db.offerings) if (r.ch === 'on') for (const k of r.keys || []) { const lk = looseKey(k); if (lk) byLoose.set(lk, { r, k }); }
  for (const o of P.offerings.filter(o => o.ch === 'on' && !ok.has(o.key))) {
    const lk = looseKey(o.key), hit = lk && byLoose.get(lk);
    if (hit) {
      const { r, k } = hit, amt = Object.values(o.a).reduce((s, v) => s + v, 0);
      const old = (r.ka && r.ka[k]) || (() => { const kk = Object.keys(o.a)[0]; const pick = (r.a[kk] || 0) >= amt ? kk : Object.keys(r.a).find(x => (r.a[x] || 0) >= amt); return pick ? { [pick]: amt } : {}; })();
      for (const [kk, v] of Object.entries(old)) { r.a[kk] = (r.a[kk] || 0) - v; if (r.a[kk] <= 0) delete r.a[kk]; }
      r.keys = r.keys.filter(x => x !== k); if (r.ka) delete r.ka[k];
      if (!Object.keys(r.a).length) db.offerings = db.offerings.filter(x => x !== r);
      byLoose.delete(lk); res.updated++;
    }
    const d = ensureDonor(o.name);
    let r = db.offerings.find(x => x.date === o.date && x.donorId === d.id && x.ch === 'on');
    if (!r) db.offerings.push(r = { id: uid(), date: o.date, donorId: d.id, ch: 'on', a: {}, memo: '', note: '', keys: [], t: now() });
    for (const [k, v] of Object.entries(o.a)) r.a[k] = (r.a[k] || 0) + v;
    if (o.memo && !(r.memo || '').includes(o.memo)) r.memo = [r.memo, o.memo].filter(Boolean).join(' / ');
    (r.keys = r.keys || []).push(o.key); (r.ka = r.ka || {})[o.key] = { ...o.a }; ok.add(o.key); if (!hit) res.online++;
  }
  res.newDonors = Math.max(0, db.donors.length - before);
  for (const d of db.donors.slice(before)) if (GROUP_NAME.test(d.name)) d.group = true;
  // 기타수입·지출·현금입금: 새 거래는 추가, 일시·금액이 같고 내용·계정만 고친 거래는 그 자리에서 고침
  const merge = (list, src, field, extra) => {
    const full = new Set(list.map(keyOf)), loose = new Map(); for (const x of list) { const lk = looseKey(keyOf(x)); if (lk) loose.set(lk, x); }
    for (const x of src) {
      const k = keyOf(x); if (full.has(k)) continue;
      const hit = looseKey(k) && loose.get(looseKey(k));
      if (hit) { const keep = { id: hit.id, proof: hit.proof, approve: hit.approve, payee: hit.payee }; Object.assign(hit, x, { key: k, t: now() }); for (const [a, v] of Object.entries(keep)) if (v) hit[a] = v; loose.delete(looseKey(k)); res.updated++; }
      else { list.push({ id: uid(), ...(extra ? { t: now() } : {}), ...x, key: k }); res[field]++; }
      full.add(k);
    }
  };
  merge(db.incomes, P.incomes, 'incomes', true); merge(db.expenses, P.expenses, 'expenses', true); merge(db.deposits, P.deposits, 'deposits', false);
  for (const b of P.budgets) { (db.budgets[b.year] = db.budgets[b.year] || {})[b.hang] = b.amount; res.budgets++; }
  if (P.bank && (!db.bank || P.bank.time >= db.bank.time)) db.bank = P.bank;
  logAct(`가져오기(${P.src}): 오프라인 주일 ${res.dates}개 ${res.rows}줄, 온라인 ${res.online}건, 새 헌금자 ${res.newDonors}명, 기타수입 ${res.incomes}, 지출 ${res.expenses}, 현금입금 ${res.deposits}, 고친 거래 ${res.updated}, 예산 ${res.budgets}${res.rrn ? `, 주민번호 ${res.rrn}명` : ''}`);
  save(true);
  return res;
}

/** 모르는 계정 이름 점검 */
function unknownAccounts(P) {
  const names = new Set(db.accounts.map(a => a.hang));
  if (P.accounts) P.accounts.forEach(a => names.add(a.hang));
  if (P.expAccounts) P.expAccounts.forEach(a => names.add(a.hang));
  return [...new Set([...P.incomes, ...P.expenses, ...P.budgets].map(x => x.acc || x.hang).filter(h => h && !names.has(h)))];
}
