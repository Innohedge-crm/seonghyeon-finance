/* 성현교회 재정 — 출력물 (Excel / PDF) */
'use strict';
const NF = '#,##0;-#,##0;"-"';
const A1 = (r, c) => XLSX.utils.encode_cell({ r, c });
const CL = c => XLSX.utils.encode_col(c);

/** aoa → 시트, 숫자 서식·열너비·병합·수식 적용 */
function makeSheet(aoa, opt = {}) {
  const ws = XLSX.utils.aoa_to_sheet(aoa.map(r => r.map(v => (v && typeof v === 'object' && v.f) ? null : v)));
  aoa.forEach((r, ri) => r.forEach((v, ci) => {
    const a = A1(ri, ci);
    if (v && typeof v === 'object' && v.f) ws[a] = { t: 'n', f: v.f, z: v.z || NF };
    else if (typeof v === 'number' && ws[a] && !(opt.plainCols || []).includes(ci)) ws[a].z = NF;
  }));
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  aoa.forEach((r, ri) => { if (r.length - 1 > range.e.c) range.e.c = r.length - 1; range.e.r = Math.max(range.e.r, ri); });
  ws['!ref'] = XLSX.utils.encode_range(range);
  if (opt.widths) ws['!cols'] = opt.widths.map(w => ({ wch: w }));
  if (opt.merges) ws['!merges'] = opt.merges;
  ws['!margins'] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
  return ws;
}
function book(sheets) { const wb = XLSX.utils.book_new(); for (const [n, ws] of sheets) XLSX.utils.book_append_sheet(wb, ws, n.slice(0, 31)); return wb; }

/* ---------- PDF용 HTML 틀 ---------- */
function docHTML(title, body, opt = {}) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:A4 ${opt.landscape ? 'landscape' : 'portrait'};margin:${opt.margin || '14mm 12mm'}}
*{box-sizing:border-box}
body{font-family:"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo",sans-serif;color:#111;font-size:${opt.fs || 10.5}pt;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1{font-size:17pt;text-align:center;margin:0 0 4mm;letter-spacing:.06em}
h2{font-size:12pt;margin:6mm 0 2mm}
.sub{text-align:center;margin:-2mm 0 5mm;color:#333}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #555;padding:${opt.cellPad || '3px 5px'};vertical-align:middle}
th{background:#e9edf2;font-weight:700;text-align:center}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td.c{text-align:center}
tr.sub td{background:#f2f2ee;font-weight:700}
tr.tot td{background:#dfe6ef;font-weight:700}
.sign{display:flex;justify-content:flex-end;gap:10mm;margin-top:8mm;font-size:10.5pt}
.sign span{min-width:38mm;border-bottom:1px solid #333;padding:0 0 1mm}
.right{text-align:right}
.note{font-size:9pt;color:#444;margin-top:3mm}
.page{page-break-after:always}
.page:last-child{page-break-after:auto}
${opt.css || ''}
</style></head><body>${body}</body></html>`;
}
const n = v => `<td class="n">${won(v)}</td>`;
const nb = v => `<td class="n">${v ? won0(v) : ''}</td>`;
const rateTxt = (a, b) => { const p = pct(a, b); return p == null ? '-' : p.toFixed(1) + '%'; };

/* ======================= 1. 주간 헌금집계표 (오프라인) ======================= */
function weekKinds(date) {
  const C = [...cols(), ...((typeof S !== 'undefined' && S.wx) || []).filter(k => !cols().includes(k))];
  for (const o of offeringsOn(date, 'off')) for (const k of Object.keys(o.a)) if (o.a[k] && !C.includes(k)) C.push(k);
  return C;
}
function weeklyRows(date, all) {
  const list = offeringsOn(date, 'off');
  const byD = new Map(list.map(o => [o.donorId, o]));
  let donors = all ? activeDonors() : [];
  for (const o of list) if (!donors.some(d => d.id === o.donorId)) donors.push(donorById(o.donorId));
  donors = donors.filter(Boolean);
  if (!all) donors.sort((a, b) => (a.anon - b.anon) || (a.no - b.no));
  return donors.map(d => ({ d, o: byD.get(d.id) }));
}
const onlineSum = date => offeringsOn(date, 'on').reduce((s, o) => s + rowTotal(o), 0);
const depositSum = date => db.deposits.filter(x => x.date === date).reduce((s, x) => s + x.amount, 0);
function weeklyXLSX(date, all) {
  const C = weekKinds(date), rows = weeklyRows(date, all), ch = db.settings.church;
  const W = 3 + C.length + 1;
  const aoa = [[`${korDate(date)} ${ch.short} 헌금집계`], [`주일 (${WD[parseISO(date).getDay()]}) · 오프라인 헌금`],
    ['NO.', '이름', ...C, '합계', '내용']];
  const first = 3;
  rows.forEach(({ d, o }, i) => {
    const r = first + i;
    aoa.push([d.anon ? '' : d.no, d.name, ...C.map(c => (o && o.a[c]) || null), { f: `SUM(${CL(2)}${r + 1}:${CL(1 + C.length)}${r + 1})` }, (o && [o.memo, o.note].filter(Boolean).join(' / ')) || '']);
  });
  const last = first + rows.length - 1;
  aoa.push(['', '소계', ...C.map((c, i) => ({ f: `SUM(${CL(2 + i)}${first + 1}:${CL(2 + i)}${last + 1})` })), { f: `SUM(${CL(2 + C.length)}${first + 1}:${CL(2 + C.length)}${last + 1})` }, '']);
  const subR = aoa.length;
  aoa.push(['', '총계', ...C.map(() => null), { f: `SUM(${CL(2)}${subR}:${CL(1 + C.length)}${subR})` }, '']);
  aoa.push([]);
  aoa.push(['', '온라인 입금', onlineSum(date) || null, '', '현금입금(통장)', depositSum(date) || null]);
  aoa.push(['', '집계', db.settings.counters || '', '', '', '재정부장', ch.treasurer || '', '', '', '일자', dotDate(date)]);
  const ws = makeSheet(aoa, { widths: [5, 10, ...C.map(() => 10), 12, 22], merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: W - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: W - 1 } }], plainCols: [0] });
  ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToWidth: 1 };
  return book([[date, ws]]);
}
function weeklyPDF(date, all) {
  const C = weekKinds(date), rows = weeklyRows(date, all), ch = db.settings.church;
  const tot = sumByCol(rows.map(x => x.o).filter(Boolean));
  const grand = C.reduce((s, c) => s + (tot[c] || 0), 0);
  const on = onlineSum(date);
  const body = `<h1>${korDate(date)} ${esc(ch.short)} 헌금집계</h1>
  <table style="table-layout:fixed"><thead><tr><th style="width:8mm">NO.</th><th style="width:27mm">이름</th>${C.map(c => `<th>${esc(c)}</th>`).join('')}<th style="width:22mm">합계</th><th style="width:30mm">내용</th></tr></thead><tbody>
  ${rows.map(({ d, o }) => `<tr><td class="c">${d.anon ? '' : d.no}</td><td style="white-space:nowrap;overflow:hidden">${esc(d.name)}</td>${C.map(c => nb(o && o.a[c])).join('')}${nb(o && rowTotal(o))}<td style="font-size:8pt">${esc(o ? [o.memo, o.note].filter(Boolean).join(' / ') : '')}</td></tr>`).join('')}
  <tr class="tot"><td></td><td>합계</td>${C.map(c => n(tot[c])).join('')}${n(grand)}<td></td></tr></tbody></table>
  <p class="note">오프라인 헌금 ${won0(grand)}원${on ? ` · 같은 주 온라인 입금 ${won0(on)}원 (별도)` : ''}</p>
  <div class="sign"><span>집계 : ${esc(db.settings.counters || '')}</span><span>재정부장 : ${esc(ch.treasurer || '')}</span><span>${dotDate(date)}</span></div>`;
  return docHTML(`${date} 헌금집계`, body, { landscape: true, fs: 9.5, cellPad: '2px 4px', margin: '10mm 10mm' });
}

/* ======================= 예산서 모양 표 (관·항·목 / 순위·항목) ======================= */
/** type 계정을 그룹으로: vals = {열이름: 항 → 값}; 수입은 이월금 제외, 미분류 그룹 추가 */
function acctGroups(type, vals, extraKeys = []) {
  const mk = a => ({ a, v: Object.fromEntries(Object.entries(vals).map(([k, f]) => [k, f(a.hang)])) });
  const gs = groupAccounts(type).filter(g => !(type === '수입' && g.gwan === '이월금')).map(g => ({ gwan: g.gwan, items: g.items.map(mk) }));
  if (type === '수입' && extraKeys.length) gs.push({ gwan: '미분류', items: extraKeys.map(k => mk({ hang: k, label: k.replace(/^\(미분류:(.*)\)$/, '$1'), code: '', mid: '', gwan: '미분류', note: '헌금종류 연결 필요' })) });
  for (const g of gs) g.v = Object.fromEntries(Object.keys(vals).map(k => [k, g.items.reduce((s, x) => s + (x.v[k] || 0), 0)]));
  return gs;
}
const gsTotal = (gs, k) => gs.reduce((s, g) => s + g.v[k], 0);
const unclKeys = (...maps) => [...new Set(maps.flatMap(m => Object.keys(m).filter(k => k.startsWith('(미분류') && m[k])))];
/** cols: [{label, k} | {label, rate:[k1,k2]}] */
function cellV(c, v) { if (c.rate) return `<td class="n">${rateTxt(v[c.rate[0]], v[c.rate[1]])}</td>`; return n(v[c.k]); }
function incomeTableHTML(gs, C, totLabel) {
  let h = `<tr><th style="width:22mm">관</th><th style="width:22mm">항</th><th>목</th>${C.map(c => `<th>${c.label}</th>`).join('')}</tr>`;
  for (const g of gs) {
    let i = 0;
    while (i < g.items.length) {
      let j = i; while (j < g.items.length && g.items[j].a.mid === g.items[i].a.mid) j++;
      for (let k = i; k < j; k++) {
        const x = g.items[k];
        h += `<tr>${k === 0 ? `<td rowspan="${g.items.length + 1}" class="c">${esc(g.gwan)}</td>` : ''}${k === i ? `<td rowspan="${j - i}">${esc(x.a.mid || '')}</td>` : ''}<td>${esc(accLabel(x.a))}</td>${C.map(c => cellV(c, x.v)).join('')}</tr>`;
      }
      i = j;
    }
    h += `<tr class="sub"><td colspan="2" class="c">소 계</td>${C.map(c => cellV(c, g.v)).join('')}</tr>`;
  }
  const T = Object.fromEntries(Object.keys(gs[0] ? gs[0].v : {}).map(k => [k, gsTotal(gs, k)]));
  h += `<tr class="tot"><td colspan="3" class="c">${totLabel}</td>${C.map(c => cellV(c, T)).join('')}</tr>`;
  return `<table style="font-size:9pt">${h}</table>`;
}
function expenseTableHTML(gs, C, totLabel) {
  const flat = gs.every(g => !g.gwan);
  let h = `<tr>${flat ? '<th style="width:9mm">순위</th>' : '<th style="width:20mm">관</th>'}<th>항 목</th>${C.map(c => `<th>${c.label}</th>`).join('')}<th>비 고</th></tr>`;
  for (const g of gs) {
    g.items.forEach((x, k) => {
      h += `<tr>${flat ? `<td class="c">${esc(x.a.code)}</td>` : (k === 0 ? `<td rowspan="${g.items.length + 1}" class="c">${esc(g.gwan)}</td>` : '')}<td>${esc(x.a.hang)}</td>${C.map(c => cellV(c, x.v)).join('')}<td style="font-size:8pt">${esc(x.a.note || '')}</td></tr>`;
    });
    if (!flat) h += `<tr class="sub"><td>소 계</td>${C.map(c => cellV(c, g.v)).join('')}<td></td></tr>`;
  }
  const T = Object.fromEntries(Object.keys(gs[0] ? gs[0].v : {}).map(k => [k, gsTotal(gs, k)]));
  h += `<tr class="tot"><td colspan="2" class="c">${totLabel}</td>${C.map(c => cellV(c, T)).join('')}<td></td></tr>`;
  return `<table style="font-size:9pt">${h}</table>`;
}
const rateCell = (a, b) => b ? Math.round(a / b * 1000) / 1000 : null;
function incomeAOA(gs, C, totLabel) {
  const a = [['관', '항', '목', ...C.map(c => c.label)]];
  const row = v => C.map(c => c.rate ? rateCell(v[c.rate[0]], v[c.rate[1]]) : (v[c.k] || null));
  for (const g of gs) { for (const x of g.items) a.push([g.gwan, x.a.mid || '', accLabel(x.a), ...row(x.v)]); a.push([g.gwan, '소 계', '', ...row(g.v)]); }
  const T = Object.fromEntries(Object.keys(gs[0] ? gs[0].v : {}).map(k => [k, gsTotal(gs, k)]));
  a.push([totLabel, '', '', ...row(T)]);
  return a;
}
function expenseAOA(gs, C, totLabel) {
  const flat = gs.every(g => !g.gwan);
  const a = [[flat ? '순위' : '관', '항 목', ...C.map(c => c.label), '비 고']];
  const row = v => C.map(c => c.rate ? rateCell(v[c.rate[0]], v[c.rate[1]]) : (v[c.k] || null));
  for (const g of gs) { for (const x of g.items) a.push([flat ? +x.a.code || x.a.code : g.gwan, x.a.hang, ...row(x.v), x.a.note || '']); if (!flat) a.push([g.gwan, '소 계', ...row(g.v), '']); }
  const T = Object.fromEntries(Object.keys(gs[0] ? gs[0].v : {}).map(k => [k, gsTotal(gs, k)]));
  a.push([totLabel, '', ...row(T), '']);
  return a;
}
/** 비율 열에 % 서식 */
function pctFormat(ws, aoa, C, offset) {
  C.forEach((c, i) => { if (!c.rate) return; for (let r = 1; r < aoa.length; r++) { const cell = ws[A1(r, offset + i)]; if (cell && cell.t === 'n') cell.z = '0.0%'; } });
}
const carryOf = y => actuals(`${y}-01-01`, `${y}-12-31`)['전년도이월금'] || budgetOf(y)['전년도이월금'] || 0;

/* ======================= 2. 제직회 분기 재정보고 ======================= */
function quarterData(y, q) {
  const [from, to] = qRange(y, q);
  const per = actuals(from, to), ytd = actuals(`${y}-01-01`, to), bud = budgetOf(y);
  const ex = unclKeys(per, ytd);
  const vals = { per: h => per[h] || 0, ytd: h => ytd[h] || 0, bud: h => bud[h] || 0 };
  const inc = acctGroups('수입', vals, ex), exp = acctGroups('지출', vals);
  const open = balanceBefore(y, from);
  const pi = gsTotal(inc, 'per'), pe = gsTotal(exp, 'per');
  const sundays = offeringDates().filter(d => inRange(d, from, to)).map(d => {
    const off = offeringsOn(d, 'off').reduce((s, o) => s + rowTotal(o), 0), on = onlineSum(d);
    return { date: d, off, on, dep: depositSum(d) };
  });
  return { y, q, from, to, inc, exp, open, pi, pe, close: open + pi - pe, sundays };
}
const QC = q => [{ label: `${q}분기 실적`, k: 'per' }, { label: '연 누계', k: 'ytd' }, { label: '연 예산', k: 'bud' }, { label: '집행률', rate: ['ytd', 'bud'] }];
function quarterPDF(y, q) {
  const Q = quarterData(y, q), ch = db.settings.church, C = QC(q);
  const body = `<div class="page"><h1>${y}년 ${q}/4분기 재정보고</h1><p class="sub">${dotDate(Q.from)} ~ ${dotDate(Q.to)} · ${esc(ch.name)} 제직회</p>
  <h2>1. 재정 요약</h2>
  <table><tr><th>전기 이월</th><th>당기 수입</th><th>당기 지출</th><th>차기 이월(잔액)</th></tr><tr>${n(Q.open)}${n(Q.pi)}${n(Q.pe)}${n(Q.close)}</tr></table>
  <h2>2. 수입부</h2>${incomeTableHTML(Q.inc, C, '총 수 입')}</div>
  <div class="page"><h2>3. 지출부</h2>${expenseTableHTML(Q.exp, C, '지출 합계')}</div>
  <div class="page"><h2>4. 주일별 헌금</h2>
  <table style="font-size:9pt"><tr><th>주일</th><th>오프라인</th><th>현금입금(통장)</th><th>차이</th><th>온라인</th><th>합계</th></tr>
  ${Q.sundays.map(s => `<tr><td class="c">${dotDate(s.date)}</td>${n(s.off)}${n(s.dep)}${n(s.off - s.dep)}${n(s.on)}${n(s.off + s.on)}</tr>`).join('') || '<tr><td colspan="6" class="c">기록 없음</td></tr>'}</table>
  <p class="note">※ 집행률은 1월 1일부터 ${dotDate(Q.to)}까지 누계 기준. 정관 제43조 2항에 따라 분기별로 제직회에 보고합니다.</p>
  <div class="sign"><span>재정부장 : ${esc(ch.treasurer || '')}</span><span>(인)</span></div></div>`;
  return docHTML(`${y}년 ${q}분기 재정보고`, body, { fs: 10 });
}
function quarterXLSX(y, q) {
  const Q = quarterData(y, q), C = QC(q);
  const head = [[`${y}년 ${q}/4분기 재정보고 (${dotDate(Q.from)} ~ ${dotDate(Q.to)})`], [], ['전기 이월', '당기 수입', '당기 지출', '차기 이월'], [Q.open, Q.pi, Q.pe, { f: 'A4+B4-C4' }]];
  const ia = incomeAOA(Q.inc, C, '총 수 입'), ea = expenseAOA(Q.exp, C, '지출 합계');
  const w1 = makeSheet(head, { widths: [15, 15, 15, 15] });
  const w2 = makeSheet(ia, { widths: [12, 12, 26, 14, 14, 14, 9] }); pctFormat(w2, ia, C, 3);
  const w3 = makeSheet(ea, { widths: [6, 22, 14, 14, 14, 9, 24] }); pctFormat(w3, ea, C, 2);
  const w4 = makeSheet([['주일', '오프라인', '현금입금(통장)', '차이', '온라인', '합계'], ...Q.sundays.map((s, i) => [s.date, s.off, s.dep, { f: `B${i + 2}-C${i + 2}` }, s.on, { f: `B${i + 2}+E${i + 2}` }])], { widths: [12, 14, 14, 12, 14, 14] });
  return book([['요약', w1], ['수입부', w2], ['지출부', w3], ['주일별', w4]]);
}

/* ======================= 3. 공동의회 예결산서 ======================= */
function annualData(y) {
  const act = actuals(`${y}-01-01`, `${y}-12-31`), bud = budgetOf(y), nb = budgetOf(y + 1);
  const vals = { bud: h => bud[h] || 0, act: h => act[h] || 0, next: h => nb[h] || 0 };
  const inc = acctGroups('수입', vals, unclKeys(act)), exp = acctGroups('지출', vals);
  for (const gs of [inc, exp]) for (const g of gs) { for (const x of g.items) x.v.diff = x.v.next - x.v.bud; g.v.diff = g.v.next - g.v.bud; }
  const asOf = y < thisYear ? `${y}-12-31` : (y === thisYear ? today() : null);
  const carry = { bud: bud['전년도이월금'] || 0, act: act['전년도이월금'] || 0, next: nb['전년도이월금'] || 0 };
  const S = k => ({ carry: carry[k], inc: gsTotal(inc, k), exp: gsTotal(exp, k) });
  return { y, inc, exp, asOf, bud: S('bud'), act: S('act'), next: S('next') };
}
const AC = y => [{ label: `${y} 예산액`, k: 'bud' }, { label: `${y} 실적`, k: 'act' }, { label: '달성률', rate: ['act', 'bud'] },
  ...(Object.keys(budgetOf(y + 1)).length ? [{ label: `${y + 1} 예산(안)`, k: 'next' }, { label: '증감', k: 'diff' }] : [])];
function annualPDF(y) {
  const A = annualData(y), ch = db.settings.church, C = AC(y);
  const partial = A.asOf && A.asOf < `${y}-12-31`;
  const sr = (lbl, s) => `<tr><th>${lbl}</th>${n(s.carry)}${n(s.inc)}${n(s.exp)}${n(s.carry + s.inc - s.exp)}</tr>`;
  const body = `<div class="page"><h1>${y}년도 결산 및 ${y + 1}년도 예산(안)</h1>
  <p class="sub">${esc(ch.name)} 공동의회${partial ? ` · ${y}년 실적은 ${dotDate(A.asOf)} 현재` : ''}</p>
  <table><tr><th></th><th>전년 이월</th><th>수입</th><th>지출</th><th>잔액(차기 이월)</th></tr>
  ${sr(`${y} 예산`, A.bud)}${sr(`${y} 실적`, A.act)}${Object.keys(budgetOf(y + 1)).length ? sr(`${y + 1} 예산(안)`, A.next) : ''}</table>
  ${Object.keys(budgetOf(y + 1)).length ? '' : `<p class="note">※ ${y + 1}년 예산(안)은 아직 입력되지 않아 표에서 뺐습니다.</p>`}
  <h2>1. 수입부</h2>${incomeTableHTML(A.inc, C, '총 수 입')}</div>
  <div class="page"><h2>2. 지출부</h2>${expenseTableHTML(A.exp, C, '지출 합계')}
  <p class="note">※ 정관 제43조: 예·결산 초안은 재정부가 작성하여 운영위원회 심의 후 공동의회에 보고하며, 공동의회에서 감사보고를 받습니다.</p>
  <h2>3. 감사 확인</h2><p>위 ${y}년도 결산 내역을 감사한 결과 장부와 증빙서류가 일치함을 확인합니다.</p>
  <p class="right">${y + (partial ? 0 : 1)}년 &nbsp;&nbsp;&nbsp;월 &nbsp;&nbsp;&nbsp;일</p>
  <div class="sign"><span>재정부장 : ${esc(ch.treasurer || '')} (인)</span><span>감사 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (인)</span><span>감사 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (인)</span></div>
  <div class="sign"><span>운영위원회 회장 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (인)</span></div></div>`;
  return docHTML(`${y} 예결산서`, body, { fs: 10 });
}
function annualXLSX(y) {
  const A = annualData(y), C = AC(y);
  const s = [[`${y}년도 결산 및 ${y + 1}년도 예산(안)` + (A.asOf && A.asOf < `${y}-12-31` ? ` — ${y} 실적 ${dotDate(A.asOf)} 현재` : '')], [],
    ['구분', '전년 이월', '수입', '지출', '잔액'],
    ...[[`${y} 예산`, A.bud], [`${y} 실적`, A.act], [`${y + 1} 예산(안)`, A.next]].map(([l, v], i) => [l, v.carry, v.inc, v.exp, { f: `B${i + 4}+C${i + 4}-D${i + 4}` }])];
  const ia = incomeAOA(A.inc, C, '총 수 입'), ea = expenseAOA(A.exp, C, '지출 합계');
  const w2 = makeSheet(ia, { widths: [12, 12, 26, 14, 14, 9, 14, 13] }); pctFormat(w2, ia, C, 3);
  const w3 = makeSheet(ea, { widths: [6, 22, 14, 14, 9, 14, 13, 24] }); pctFormat(w3, ea, C, 2);
  return book([['요약', makeSheet(s, { widths: [16, 15, 15, 15, 15] })], [`${y} 수입`, w2], [`${y} 지출`, w3]]);
}

/* ======================= 5. 지출 항목별 보고서 ======================= */
/** per: 'Y' | 'Q1'..'Q4' | 'M1'..'M12' */
function periodRange(y, per) {
  if (per[0] === 'Q') return qRange(y, +per.slice(1));
  if (per[0] === 'M') { const m = +per.slice(1); return [`${y}-${pad(m)}-01`, iso(new Date(y, m, 0))]; }
  return yearRange(y);
}
const periodLabel = (y, per) => per === 'Y' ? `${y}년 연간` : per[0] === 'Q' ? `${y}년 ${per.slice(1)}/4분기` : `${y}년 ${per.slice(1)}월`;
function expenseReportData(y, per, accHang) {
  const [from, to] = periodRange(y, per), bud = budgetOf(y);
  const m1 = +from.slice(5, 7), m2 = +to.slice(5, 7), months = []; for (let m = m1; m <= m2; m++) months.push(m);
  const inYear = db.expenses.filter(x => yearOf(x.date) === y);
  const known = db.accounts.filter(a => a.type === '지출');
  const extra = [...new Set(inYear.map(x => x.acc).filter(h => !known.some(a => a.hang === h)))].map(h => ({ hang: h, code: '', note: '예산 항목에 없음', extra: true }));
  let accs = [...known, ...extra];
  if (accHang) accs = accs.filter(a => a.hang === accHang);
  const rows = accs.map(a => {
    const all = inYear.filter(x => x.acc === a.hang);
    const list = all.filter(x => inRange(x.date, from, to)).sort((p, q) => (p.time || p.date).localeCompare(q.time || q.date));
    const ytd = all.filter(x => x.date <= to).reduce((s, x) => s + x.amount, 0);
    const mon = months.map(m => list.filter(x => +x.date.slice(5, 7) === m).reduce((s, x) => s + x.amount, 0));
    return { a, bud: bud[a.hang] || 0, per: list.reduce((s, x) => s + x.amount, 0), ytd, mon, list };
  });
  const T = k => rows.reduce((s, r) => s + r[k], 0);
  return { y, per, from, to, months, rows, tot: { bud: T('bud'), per: T('per'), ytd: T('ytd'), mon: months.map((_, i) => rows.reduce((s, r) => s + r.mon[i], 0)) } };
}
function expenseReportPDF(y, per, accHang, withDetail) {
  const D = expenseReportData(y, per, accHang), ch = db.settings.church;
  const rows = D.rows.filter(r => r.bud || r.per || r.ytd || accHang);
  const rem = r => r.bud ? r.bud - r.ytd : 0;
  const sum = `<h1>지출 항목별 보고서</h1><p class="sub">${periodLabel(y, per)} · ${dotDate(D.from)} ~ ${dotDate(D.to)} · ${esc(ch.name)}${accHang ? ` · ${esc(accHang)}` : ''}</p>
  <table style="font-size:8.5pt"><tr><th style="width:11mm">순위</th><th>항 목</th><th>연 예산</th><th>${per === 'Y' ? '연간 실적' : '기간 실적'}</th>${per === 'Y' ? '' : '<th>연 누계</th>'}<th style="width:15mm">집행률</th><th>잔여 예산</th><th style="width:12mm">건수</th><th>비 고</th></tr>
  ${rows.map(r => `<tr><td class="c">${esc(r.a.code)}</td><td>${esc(r.a.hang)}</td>${n(r.bud)}${n(r.per)}${per === 'Y' ? '' : n(r.ytd)}<td class="n">${rateTxt(r.ytd, r.bud)}</td><td class="n" style="${rem(r) < 0 ? 'color:#b42318' : ''}">${won(rem(r))}</td><td class="c">${r.list.length || ''}</td><td style="font-size:8pt">${esc(r.a.note || '')}</td></tr>`).join('')}
  <tr class="tot"><td colspan="2" class="c">합 계</td>${n(D.tot.bud)}${n(D.tot.per)}${per === 'Y' ? '' : n(D.tot.ytd)}<td class="n">${rateTxt(D.tot.ytd, D.tot.bud)}</td>${n(D.tot.bud - D.tot.ytd)}<td class="c">${rows.reduce((s, r) => s + r.list.length, 0)}</td><td></td></tr></table>
  <p class="note">※ 집행률·잔여 예산은 ${y}년 1월 1일부터 ${dotDate(D.to)}까지 누계 기준. 날짜는 총입출금의 주(Month) 기준.</p>`;
  const monthly = D.months.length > 1 ? `<div class="page wide"><h2>월별 지출</h2>
  <table style="font-size:7.5pt"><tr><th style="width:10mm">순위</th><th>항 목</th>${D.months.map(m => `<th>${m}월</th>`).join('')}<th>합계</th></tr>
  ${rows.filter(r => r.per).map(r => `<tr><td class="c">${esc(r.a.code)}</td><td style="white-space:nowrap">${esc(r.a.hang)}</td>${r.mon.map(v => nb(v)).join('')}${n(r.per)}</tr>`).join('')}
  <tr class="tot"><td colspan="2" class="c">합 계</td>${D.tot.mon.map(v => n(v)).join('')}${n(D.tot.per)}</tr></table></div>` : '';
  const detail = withDetail ? `<div class="page"><h2>항목별 상세 내역</h2>${rows.filter(r => r.list.length).map(r => `
  <h3 style="font-size:10.5pt;margin:5mm 0 1.5mm">${esc(r.a.code ? r.a.code + '. ' : '')}${esc(r.a.hang)} <span style="font-weight:400;color:#555">— ${r.list.length}건 · ${won0(r.per)}원${r.bud ? ` · 예산 ${won0(r.bud)}` : ''}</span></h3>
  <table style="font-size:8.5pt;page-break-inside:auto"><tr><th style="width:20mm">주(Month)</th><th style="width:30mm">거래일시</th><th>내용</th><th style="width:26mm">금액</th><th style="width:18mm">증빙</th></tr>
  ${r.list.map(x => `<tr><td class="c">${x.date.slice(5).replace('-', '.')}</td><td class="c">${esc((x.time || '').slice(5, 16).replace('-', '.'))}</td><td>${esc(x.memo || '')}${x.payee ? ' · ' + esc(x.payee) : ''}</td>${n(x.amount)}<td class="c">${esc(x.proof || '')}</td></tr>`).join('')}
  <tr class="sub"><td colspan="3" class="c">소 계</td>${n(r.per)}<td></td></tr></table>`).join('')}</div>` : '';
  const body = `<div class="page">${sum}<div class="sign"><span>재정부장 : ${esc(ch.treasurer || '')}</span><span>(인)</span></div></div>${monthly}${detail}`;
  return docHTML(`지출 항목별 보고서 ${periodLabel(y, per)}`, body, { fs: 10, cellPad: '1.5px 5px', margin: '10mm 12mm', css: '@page wide{size:A4 landscape;margin:10mm 12mm} .wide{page:wide}' });
}
function expenseReportXLSX(y, per, accHang) {
  const D = expenseReportData(y, per, accHang);
  const rows = D.rows.filter(r => r.bud || r.per || r.ytd || accHang);
  // 1) 요약 — 집행률·잔여는 수식
  const s1 = [[`지출 항목별 보고서 · ${periodLabel(y, per)} (${dotDate(D.from)} ~ ${dotDate(D.to)})`], [],
    ['순위', '항 목', '연 예산', '기간 실적', '연 누계', '집행률', '잔여 예산', '건수', '비 고']];
  rows.forEach((r, i) => { const R = i + 4; s1.push([+r.a.code || r.a.code, r.a.hang, r.bud || null, r.per || null, r.ytd || null, { f: `IF(C${R}=0,"",E${R}/C${R})`, z: '0.0%' }, { f: `IF(C${R}=0,"",C${R}-E${R})` }, r.list.length || null, r.a.note || '']); });
  const L = rows.length + 3;
  s1.push(['합 계', '', { f: `SUM(C4:C${L})` }, { f: `SUM(D4:D${L})` }, { f: `SUM(E4:E${L})` }, { f: `IF(C${L + 1}=0,"",E${L + 1}/C${L + 1})`, z: '0.0%' }, { f: `C${L + 1}-E${L + 1}` }, { f: `SUM(H4:H${L})`, z: '0' }, '']);
  const w1 = makeSheet(s1, { widths: [6, 22, 14, 14, 14, 9, 14, 6, 26], plainCols: [0, 7], merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }] });
  // 2) 월별
  const s2 = [['순위', '항 목', ...D.months.map(m => `${m}월`), '합계']];
  rows.forEach((r, i) => s2.push([+r.a.code || r.a.code, r.a.hang, ...r.mon.map(v => v || null), { f: `SUM(C${i + 2}:${CL(1 + D.months.length)}${i + 2})` }]));
  s2.push(['합 계', '', ...D.months.map((_, j) => ({ f: `SUM(${CL(2 + j)}2:${CL(2 + j)}${rows.length + 1})` })), { f: `SUM(${CL(2 + D.months.length)}2:${CL(2 + D.months.length)}${rows.length + 1})` }]);
  const w2 = makeSheet(s2, { widths: [6, 22, ...D.months.map(() => 12), 14], plainCols: [0] });
  // 3) 상세 — 한 줄에 한 건 (필터·피벗용)
  const det = rows.flatMap(r => r.list.map(x => [+r.a.code || r.a.code, r.a.hang, x.date, x.time || '', x.memo || '', x.payee || '', x.amount, x.proof || '', x.approve || '']));
  const s3 = [['순위', '지출계정과목', '주(Month)', '거래일시', '내용', '지급처', '금액', '증빙', '결재'], ...det, ['합계', '', '', '', '', '', { f: `SUM(G2:G${det.length + 1})` }]];
  const w3 = makeSheet(s3, { widths: [6, 20, 12, 18, 34, 14, 13, 10, 14], plainCols: [0] });
  w3['!autofilter'] = { ref: `A1:I${det.length + 1}` };
  return book([['항목별 요약', w1], ...(D.months.length > 1 ? [['월별', w2]] : []), ['상세 내역', w3]]);
}

/* ======================= 4. 기부금영수증 ======================= */
function donorYear(y, donorId) {
  const m = Array(12).fill(0);
  for (const o of db.offerings) if (o.donorId === donorId && yearOf(o.date) === y)
    for (const [k, v] of Object.entries(o.a)) { const a = accOfKind(k); if (v && a && a.receipt) m[+o.date.slice(5, 7) - 1] += v; }
  return m;
}
function receiptTargets(y) {
  return db.donors.filter(d => !d.anon && !d.group).map(d => ({ d, m: donorYear(y, d.id) })).map(x => ({ ...x, total: x.m.reduce((s, v) => s + v, 0) }))
    .filter(x => x.total > 0).sort((a, b) => (a.d.no - b.d.no) || a.d.name.localeCompare(b.d.name, 'ko'));
}
function serialFor(y, donorId) {
  const R = db.receipts[y] = db.receipts[y] || {};
  if (!R[donorId]) { const max = Math.max(0, ...Object.values(R).map(s => +String(s).split('-').pop() || 0)); R[donorId] = `${y}-${String(max + 1).padStart(3, '0')}`; }
  return R[donorId];
}
function receiptPage(y, x, issue) {
  const ch = db.settings.church, rc = db.settings.receipt, d = x.d;
  const lines = x.m.map((v, i) => v ? `<tr><td class="c">${esc(rc.code)}</td><td class="c">${esc(rc.kind)}</td><td class="c">${y}. ${i + 1}.</td><td class="c">헌금 (${i + 1}월분)</td>${n(v)}</tr>` : '').join('');
  return `<div class="page rc">
  <div class="rc-top"><span>[별지 제45호의2서식]</span><span>일련번호 : ${esc(serialFor(y, d.id))}</span></div>
  <h1 style="margin-top:4mm">기 부 금 영 수 증</h1>
  <table class="kvt">
    <tr><th colspan="4" class="sec">① 기부자</th></tr>
    <tr><th>성명(법인명)</th><td>${esc(d.name)}</td><th>주민등록번호<br>(사업자등록번호)</th><td>${esc(d.rrn || '')}</td></tr>
    <tr><th>주소(소재지)</th><td colspan="3">${esc(d.address || '')}</td></tr>
    <tr><th colspan="4" class="sec">② 기부금 단체</th></tr>
    <tr><th>단체명</th><td>${esc(ch.name)}</td><th>사업자등록번호<br>(고유번호)</th><td>${esc(ch.regNo || '')}</td></tr>
    <tr><th>소재지</th><td>${esc(ch.address)}</td><th>기부금공제대상<br>기부금단체 근거법령</th><td>${esc(rc.law)}</td></tr>
    <tr><th colspan="4" class="sec">③ 기부금 모집처(언론기관 등)</th></tr>
    <tr><th>단체명</th><td>해당 없음</td><th>사업자등록번호</th><td></td></tr>
  </table>
  <table style="margin-top:3mm"><tr><th colspan="5" class="sec">④ 기부내용</th></tr>
    <tr><th style="width:14mm">코드</th><th style="width:16mm">구분</th><th style="width:26mm">연월</th><th>내용</th><th style="width:34mm">금액</th></tr>
    ${lines}
    <tr class="tot"><td colspan="4" class="c">합 계</td>${n(x.total)}</tr></table>
  <p class="decl">「소득세법」 제34조 등 관계 법령에 따른 기부금을 위와 같이 기부하였음을 증명하여 주시기 바랍니다.</p>
  <p class="right">${dotDate(issue)}</p><p class="right">신청인 &nbsp; ${esc(d.name)} &nbsp; (서명 또는 인)</p>
  <p class="decl">위와 같이 기부금을 기부받았음을 증명합니다.</p>
  <p class="right">${dotDate(issue)}</p>
  <p class="right">기부금 수령인 &nbsp; ${esc(ch.name)} &nbsp; ${esc(rc.issuer || ch.rep || '')} &nbsp; (서명 또는 인)</p>
  </div>`;
}
function receiptsPDF(y, ids, issue) {
  const T = receiptTargets(y).filter(x => !ids || ids.includes(x.d.id));
  const html = docHTML(`${y} 기부금영수증`, T.map(x => receiptPage(y, x, issue)).join(''), { fs: 10, margin: '14mm 15mm', css: `
    .rc-top{display:flex;justify-content:space-between;font-size:9pt;color:#333}
    .kvt th{width:30mm;background:#f1f3f6;font-weight:600;font-size:9.5pt}
    th.sec{background:#dfe6ef!important;text-align:left;font-weight:700;width:auto}
    .decl{margin:6mm 0 2mm;line-height:1.6}
    .rc p.right{margin:1.5mm 0}` });
  save();
  return { html, count: T.length };
}
function receiptsXLSX(y) {
  const T = receiptTargets(y);
  const aoa = [['일련번호', '번호', '성명', '주민등록번호', '주소', ...Array.from({ length: 12 }, (_, i) => `${i + 1}월`), '합계']];
  T.forEach((x, i) => aoa.push([serialFor(y, x.d.id), x.d.no, x.d.name, x.d.rrn || '', x.d.address || '', ...x.m.map(v => v || null), { f: `SUM(F${i + 2}:Q${i + 2})` }]));
  aoa.push(['', '', '합계', '', '', ...Array.from({ length: 12 }, (_, i) => ({ f: `SUM(${CL(5 + i)}2:${CL(5 + i)}${T.length + 1})` })), { f: `SUM(R2:R${T.length + 1})` }]);
  const ws = makeSheet(aoa, { widths: [11, 5, 9, 16, 30, ...Array(12).fill(10), 13], plainCols: [1] });
  save();
  return book([[`${y} 기부금 발급명세`, ws]]);
}

/* ======================= 지출결의서 ======================= */
function voucherPDF(x) {
  const a = accByHang(x.acc) || {}, ch = db.settings.church;
  const body = `<h1>지 출 결 의 서</h1>
  <table style="width:60%;margin-left:auto;margin-bottom:6mm"><tr><th>재정부장</th><th>${x.amount > 1000000 ? '운영위원회 회장' : '(전결)'}</th></tr><tr style="height:18mm"><td></td><td></td></tr></table>
  <table class="kvt">
    <tr><th>지출일자</th><td>${dotDate(x.date)}</td><th>금 액</th><td class="n" style="font-size:13pt;font-weight:700">₩ ${won0(x.amount)}</td></tr>
    <tr><th>관 / 항</th><td>${esc(a.gwan || '')} / ${esc(x.acc)}</td><th>지급처</th><td>${esc(x.payee || '')}</td></tr>
    <tr><th>내 용</th><td colspan="3" style="height:30mm;vertical-align:top">${esc(x.memo || '')}</td></tr>
    <tr><th>증 빙</th><td>${esc(x.proof || '')}</td><th>결 재</th><td>${esc(x.approve || '')}</td></tr>
  </table>
  <p class="note">※ 정관 제44조: 재정은 재정부장의 결재와 운영위원회 회장의 승인으로 지출하며, 예산 범위 내 통상적 일정금액과 100만원 이하는 재정부장 전결로 지출할 수 있습니다.</p>
  <p class="right" style="margin-top:10mm">${dotDate(x.date)} &nbsp; ${esc(ch.name)} 재정부</p>`;
  return docHTML('지출결의서', body, { fs: 11, css: '.kvt th{width:28mm;background:#f1f3f6}.kvt td{padding:6px 8px}' });
}
