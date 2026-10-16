/* 성현교회 재정 — 화면 */
'use strict';
const thisYear = new Date().getFullYear();
const S = { wx: [], view: 'home', year: thisYear, date: lastSunday(), q: qOf(today()), lt: 'exp', lm: '', la: '', dq: '', upd: '' };
const NAV = [
  ['home', '현황'], ['week', '주일 헌금 입력'], ['weeks', '주일별 헌금'],
  ['_', '재정'], ['ledger', '지출 · 기타수입'], ['budget', '예산 · 결산'], ['reports', '보고서 출력'],
  ['_', '관리'], ['donors', '헌금자 명단'], ['import', '가져오기'], ['settings', '설정']
];
function go(v, extra) { Object.assign(S, extra || {}); S.view = v; render(); window.scrollTo(0, 0); }

function renderNav() {
  $('#nav').innerHTML = `<div class="brand"><b>${esc(db.settings.church.short)} 재정</b><small>주일 헌금 · 예결산</small></div>
  ${NAV.map(([k, l]) => k === '_' ? `<div class="grp">${l}</div>` : `<button data-go="${k}" ${S.view === k ? 'aria-current="page"' : ''}>${l}</button>`).join('')}
  <div class="foot"><span id="savestate">${esc(saveState || '이 PC에만 저장')}</span>
  ${db.settings.lockHash ? '<button class="btn sm" data-lock>잠그기</button>' : ''}<span>${esc(S.upd)}</span></div>`;
  $$('#nav [data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  const lk = $('#nav [data-lock]'); if (lk) lk.onclick = showLock;
}
function render() {
  renderNav();
  const f = VIEWS[S.view] || VIEWS.home;
  $('#main').innerHTML = f();
  (BIND[S.view] || (() => {}))();
}
const yearSel = (id, y, span = [-4, 1]) => {
  const ys = new Set([...db.offerings.map(o => yearOf(o.date)), ...Object.keys(db.budgets).map(Number), thisYear + span[1]]);
  for (let i = span[0]; i <= 0; i++) ys.add(thisYear + i);
  return `<select id="${id}">${[...ys].filter(Boolean).sort((a, b) => b - a).map(v => `<option ${v === y ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
};
const meter = (a, b, good) => { const p = b ? a / b * 100 : 0; return `<div class="meter ${p > 100 ? (good ? 'good' : 'over') : ''}" title="${p.toFixed(1)}%"><i style="width:${Math.min(100, p)}%"></i></div>`; };

const VIEWS = {}, BIND = {};

/* ======================= 현황 ======================= */
VIEWS.home = () => {
  const y = S.year, [f, t] = yearRange(y);
  const act = actuals(f, t), T = totals(act), bud = budgetOf(y);
  const budInc = db.accounts.filter(a => a.type === '수입' && !isCarry(a)).reduce((s, a) => s + (bud[a.hang] || 0), 0);
  const budExp = db.accounts.filter(a => a.type === '지출').reduce((s, a) => s + (bud[a.hang] || 0), 0);
  const ds = offeringDates().filter(d => yearOf(d) <= y).slice(-12);
  const wk = ds.map(d => { const off = offeringsOn(d, 'off').reduce((s, o) => s + rowTotal(o), 0), on = onlineSum(d); return { d, off, on, v: off + on }; });
  const mx = Math.max(1, ...wk.map(x => x.v));
  const last = ds[ds.length - 1];
  const lastSum = last ? sumByCol(offeringsOn(last)) : {};
  const empty = !db.offerings.length && !db.expenses.length;
  const recent = [...db.expenses].sort((a, b) => (b.time || b.date).localeCompare(a.time || a.date)).slice(0, 7);
  const uc = unclassified(f, t);
  const bal = T.carry + T.inc - T.exp;
  const incG = groupAccounts('수입').filter(g => g.gwan !== '이월금');
  return `<div class="head"><div><h1>현황</h1><p>${y}년 ${y === thisYear ? `· ${dotDate(today())} 현재` : '결산'}</p></div><div class="row">${yearSel('hy', y)}</div></div>
  ${empty ? `<div class="banner"><span>아직 데이터가 없습니다. 총입출금내역 파일과 수입·지출예산 파일을 올려 시작하세요.</span><span class="row"><button class="btn sm pri" data-go2="import">가져오기</button></span></div>` : ''}
  ${uc.length ? `<div class="banner warn"><span>계정이 정해지지 않은 수입 ${uc.length}종 ${won0(uc.reduce((s, x) => s + x.amount, 0))}원 — ${uc.slice(0, 4).map(x => esc(x.kind)).join(', ')}</span><button class="btn sm" data-go2="budget">확인</button></div>` : ''}
  <div class="kpis">
    <div class="kpi"><span>수입 누계</span><b class="inc">${won0(T.inc)}</b><small>예산 ${won0(budInc)} · ${budInc ? pct(T.inc, budInc) + '%' : '예산 없음'}</small></div>
    <div class="kpi"><span>지출 누계</span><b class="exp">${won0(T.exp)}</b><small>예산 ${won0(budExp)} · ${budExp ? pct(T.exp, budExp) + '%' : '예산 없음'}</small></div>
    <div class="kpi"><span>장부 잔액</span><b>${won0(bal)}</b><small>전년 이월 ${won0(T.carry)} + 수입 − 지출</small></div>
    <div class="kpi"><span>통장 잔액</span><b>${db.bank ? won0(db.bank.balance) : '-'}</b><small>${db.bank ? (() => { const R = reconData(); return `${esc(db.bank.time.slice(0, 10))} 기준 · 장부와 ${won0(R.diff)} 차이 <button class="btn link" id="recon">내역</button>`; })() : '총입출금을 올리면 표시'}</small></div>
  </div>
  <div class="grid2">
    <div class="panel"><h2>주일 헌금 (최근 ${wk.length}주, 오프라인+온라인)</h2>
      ${wk.length ? `<div class="bars">${wk.map(x => `<div class="bar" style="height:${Math.max(3, x.v / mx * 100)}%" title="${x.d} 오프라인 ${won0(x.off)} · 온라인 ${won0(x.on)}"><i>${x.v >= 1e6 ? (x.v / 1e4).toFixed(0) + '만' : won0(x.v)}</i></div>`).join('')}</div>
      <div class="bar-x">${wk.map(x => `<span>${+x.d.slice(5, 7)}.${+x.d.slice(8)}</span>`).join('')}</div>` : '<div class="empty">기록 없음</div>'}
    </div>
    <div class="panel"><h2>${last ? `지난 주일 ${dotDate(last)}` : '지난 주일'}</h2>
      ${last ? `<table><tbody>${Object.entries(lastSum).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<tr><td>${esc(c)}</td><td class="num">${won(v)}</td></tr>`).join('')}
      <tr class="tot"><td>합계</td><td class="num">${won0(Object.values(lastSum).reduce((s, v) => s + v, 0))}</td></tr></tbody></table>
      <p class="hint">오프라인 ${offeringsOn(last, 'off').length}명 · 온라인 ${offeringsOn(last, 'on').length}명 · <button class="btn link" data-wk="${last}">입력 화면 열기</button></p>` : '<div class="empty">기록 없음</div>'}
    </div>
  </div>
  <div class="grid2">
    <div class="panel"><h2>수입 ${y}년 실적 · 예산 대비</h2>
      <table><thead><tr><th>목</th><th class="num">실적</th><th class="num">예산</th><th></th></tr></thead><tbody>
      ${incG.map(g => g.items.map(a => { const v = act[a.hang] || 0, b = bud[a.hang] || 0; return v || b ? `<tr><td>${esc(accLabel(a))}</td><td class="num">${won(v)}</td><td class="num muted">${won(b)}</td><td>${b ? meter(v, b, true) : ''}</td></tr>` : ''; }).join('')).join('')}
      </tbody></table></div>
    <div class="panel"><h2>최근 지출</h2>
      ${recent.length ? `<table><tbody>${recent.map(x => `<tr><td class="muted">${(x.time || x.date).slice(5, 10).replace('-', '.')}</td><td>${esc(x.acc)}</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${esc(x.memo || x.payee || '')}</td><td class="num exp">${won0(x.amount)}</td></tr>`).join('')}</tbody></table>
      <p class="hint"><button class="btn link" data-go2="ledger">지출 · 기타수입 화면으로</button></p>` : '<div class="empty">지출 기록 없음</div>'}
    </div>
  </div>`;
};
BIND.home = () => {
  if ($('#recon')) $('#recon').onclick = () => reconDialog();
  $('#hy').onchange = e => go('home', { year: +e.target.value });
  $$('[data-go2]').forEach(b => b.onclick = () => go(b.dataset.go2));
  $$('[data-wk]').forEach(b => b.onclick = () => go('week', { date: b.dataset.wk }));
};

/* ======================= 주일 헌금 입력 ======================= */
VIEWS.week = () => {
  const d = S.date, C = weekKinds(d), all = db.settings.showAllDonors;
  const rows = weeklyRows(d, all);
  const tot = sumByCol(offeringsOn(d, 'off'));
  const on = offeringsOn(d, 'on'), onSum = on.reduce((s, o) => s + rowTotal(o), 0), dep = depositSum(d), cx = cashExpSum(d);
  const grand = Object.values(tot).reduce((s, v) => s + v, 0);
  const ds = offeringDates();
  const i = ds.indexOf(d);
  return `<div class="head"><div><h1>주일 헌금 입력</h1><p>${korDate(d)} (${WD[parseISO(d).getDay()]}) · 오프라인 ${offeringsOn(d, 'off').length}명 · 합계 ${won0(grand)}원</p></div>
  <div class="row"><button class="btn" data-mv="-7" title="이전 주일">◀</button><input type="date" id="wd" value="${d}"><button class="btn" data-mv="7" title="다음 주일">▶</button>
  <button class="btn" data-out="x">집계표 Excel</button><button class="btn pri" data-out="p">집계표 PDF</button></div></div>
  ${on.length || dep || cx ? `<div class="banner"><span>이 주 온라인 입금 ${on.length}명 ${won0(onSum)}원 (별도 집계)${dep || cx ? ` · 현금입금(통장) ${won0(dep)}원${cx ? ` + 현금지출 ${won0(cx)}원` : ''} — 오프라인 합계와 ${dep + cx === grand ? '<b>일치</b>' : `<b>${won0(grand - dep - cx)}원 차이</b>`}` : ''}</span>${dep || cx ? '<button class="btn" id="wcx">현금지출 확인</button>' : ''}</div>` : ''}
  ${!isSunday(d) ? `<div class="banner warn"><span>${korDate(d)}은 주일이 아닙니다. 절기·특별예배 헌금이면 그대로 입력하셔도 됩니다.</span></div>` : ''}
  <div class="toolbar"><div class="seg"><button data-all="1" aria-pressed="${all}">전체 명단</button><button data-all="0" aria-pressed="${!all}">헌금한 사람만</button></div>
  <div class="seg"><button data-sort="name" aria-pressed="${(db.settings.sortBy || 'name') === 'name'}">가나다순</button><button data-sort="no" aria-pressed="${db.settings.sortBy === 'no'}">번호순</button></div>
  <input type="search" id="addname" placeholder="이름 입력 후 Enter — 명단에 없으면 새로 추가" class="grow" list="dnames">
  <datalist id="dnames">${db.donors.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>
  <select id="wxk" title="이 화면에 헌금종류 열 추가"><option value="">+ 열 추가 (부활·맥추 등)</option>${db.accounts.filter(x => x.receipt || x.kinds.length).flatMap(x => x.kinds).filter(k => !C.includes(k)).map(k => `<option>${esc(k)}</option>`).join('')}</select>
  <span class="hint">금액 입력 후 <kbd>Enter</kbd> 아래 칸, <kbd>Tab</kbd> 옆 칸. 자동 저장. ‘3만’처럼 써도 됩니다.</span></div>
  <div class="tbl-wrap grid-in"><table><thead><tr><th>NO</th><th style="text-align:left">이름</th>${C.map(c => `<th>${esc(c)}</th>`).join('')}<th>합계</th><th>내용 · 비고</th></tr></thead>
  <tbody>${rows.map(({ d: dn, o }, ri) => `<tr data-did="${dn.id}" class="${o ? 'has' : ''}"><td class="no">${dn.anon ? '' : dn.no}</td><td class="nm">${esc(dn.name)}${dn.title ? ` <span class="muted" style="font-weight:400;font-size:13px">${esc(dn.title)}</span>` : ''}</td>
    ${C.map((c, ci) => `<td><input inputmode="numeric" data-c="${esc(c)}" data-r="${ri}" data-ci="${ci}" value="${o && o.a[c] ? won0(o.a[c]) : ''}" aria-label="${esc(dn.name)} ${esc(c)}"></td>`).join('')}
    <td class="sum">${o ? won(rowTotal(o)) : ''}</td><td><input class="memo" data-memo data-r="${ri}" value="${esc(o ? o.memo || '' : '')}" aria-label="${esc(dn.name)} 내용"></td></tr>`).join('') || `<tr><td colspan="${C.length + 4}" class="empty">이 주일에 입력된 헌금이 없습니다. 위에서 이름을 입력하거나 ‘전체 명단’을 누르세요.</td></tr>`}</tbody>
  <tfoot><tr><td></td><td>합계</td>${C.map(c => `<td data-tc="${esc(c)}">${won(tot[c])}</td>`).join('')}<td id="tg">${won0(grand)}</td><td></td></tr></tfoot></table></div>
  <p class="hint">기록된 주일 ${ds.length}개${i >= 0 ? ` · 이 주일은 ${i + 1}번째` : ''}. 이 화면은 오프라인(현금) 헌금입니다. 온라인 입금은 총입출금 가져오기로 들어옵니다. 같은 주일을 파일에서 다시 가져오면 바뀔 수 있으니 한 곳에서만 입력하세요.</p>`;
};
function weekCellChange(inp) {
  const tr = inp.closest('tr'), did = tr.dataset.did, d = S.date;
  let o = db.offerings.find(x => x.date === d && x.donorId === did && x.ch === 'off');
  if (inp.dataset.memo != null) {
    if (!o) { if (!inp.value.trim()) return; o = { id: uid(), date: d, donorId: did, ch: 'off', a: {}, memo: '', note: '', t: now() }; db.offerings.push(o); }
    o.memo = inp.value.trim(); o.t = now();
  } else {
    const c = inp.dataset.c, v = parseAmt(inp.value);
    if (!o) { if (!v) { inp.value = ''; return; } o = { id: uid(), date: d, donorId: did, ch: 'off', a: {}, memo: '', note: '', t: now() }; db.offerings.push(o); }
    if (v) o.a[c] = v; else delete o.a[c];
    o.t = now();
    inp.value = v ? won0(v) : '';
  }
  if (!Object.keys(o.a).length && !o.memo) db.offerings = db.offerings.filter(x => x !== o);
  const left = db.offerings.find(x => x.id === o.id);
  tr.classList.toggle('has', !!left);
  tr.querySelector('.sum').textContent = left ? won(rowTotal(left)) : '';
  const tot = sumByCol(offeringsOn(d, 'off'));
  $$('[data-tc]').forEach(td => td.textContent = won(tot[td.dataset.tc]));
  const g = Object.values(tot).reduce((s, v) => s + v, 0);
  $('#tg').textContent = won0(g);
  $('.head p').textContent = `${korDate(d)} (${WD[parseISO(d).getDay()]}) · 오프라인 ${offeringsOn(d, 'off').length}명 · 합계 ${won0(g)}원`;
  save();
}
BIND.week = () => {
  if ($('#wcx')) $('#wcx').onclick = () => cashExpDialog(S.date, () => go('week', { date: S.date }));
  $('#wd').onchange = e => e.target.value && go('week', { date: e.target.value });
  $$('[data-mv]').forEach(b => b.onclick = () => go('week', { date: addDays(isSunday(S.date) ? S.date : lastSunday(S.date), +b.dataset.mv) }));
  $('#wxk').onchange = e => { if (e.target.value) { S.wx = [...(S.wx || []), e.target.value]; render(); } };
  $$('[data-sort]').forEach(b => b.onclick = () => { db.settings.sortBy = b.dataset.sort; save(); render(); });
  $$('[data-all]').forEach(b => b.onclick = () => { db.settings.showAllDonors = b.dataset.all === '1'; save(); render(); });
  $$('[data-out]').forEach(b => b.onclick = async () => {
    const all = db.settings.showAllDonors;
    if (b.dataset.out === 'x') await saveXLSX(`헌금집계_${S.date}.xlsx`, weeklyXLSX(S.date, all));
    else await savePDF(`헌금집계_${S.date}.pdf`, weeklyPDF(S.date, all), { landscape: true });
  });
  const tb = $('.grid-in tbody');
  tb.addEventListener('change', e => { if (e.target.matches('input')) weekCellChange(e.target); });
  tb.addEventListener('focusin', e => { if (e.target.matches('input:not(.memo)')) { e.target.value = e.target.value.replace(/,/g, ''); e.target.select(); } });
  tb.addEventListener('focusout', e => { if (e.target.matches('input:not(.memo)')) { const v = parseAmt(e.target.value); e.target.value = v ? won0(v) : ''; } });
  tb.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const t = e.target; if (!t.matches('input')) return;
    e.preventDefault();
    const r = +t.dataset.r + (e.key === 'ArrowUp' ? -1 : 1);
    const sel = t.dataset.memo != null ? `input[data-memo][data-r="${r}"]` : `input[data-ci="${t.dataset.ci}"][data-r="${r}"]`;
    const nx = $(sel, tb); if (t.dataset.memo == null) weekCellChange(t);
    if (nx) nx.focus(); else t.blur();
  });
  const an = $('#addname');
  an.onkeydown = async e => {
    if (e.key !== 'Enter' || !an.value.trim()) return;
    const nm = normName(an.value);
    let d = donorByName(nm) || (/^무명/.test(nm) ? donorById('anon') : null);
    if (!d) {
      if (!(await confirmBox(`'${nm}' 님은 명단에 없습니다. 새 헌금자로 추가할까요?`, '추가'))) return;
      d = ensureDonor(nm); logAct(`헌금자 추가: ${nm}`); save();
    }
    if (d.inactive) { d.inactive = false; save(); }
    if (!offeringsOn(S.date, 'off').some(o => o.donorId === d.id)) { db.offerings.push({ id: uid(), date: S.date, donorId: d.id, ch: 'off', a: {}, memo: '', note: '', t: now() }); }
    render();
    const tr = $(`tr[data-did="${d.id}"]`); if (tr) { tr.scrollIntoView({ block: 'center' }); tr.querySelector('input').focus(); }
    // 빈 행은 금액 입력 없이 떠나면 정리
    db.offerings = db.offerings.filter(o => Object.keys(o.a).length || o.memo || (o.date === S.date && o.donorId === d.id && o.ch === 'off'));
  };
};

/* ======================= 주일별 헌금 ======================= */
VIEWS.weeks = () => {
  const y = S.year;
  const ds = offeringDates().filter(d => yearOf(d) === y).reverse();
  const rows = ds.map(d => { const off = offeringsOn(d, 'off').reduce((s, o) => s + rowTotal(o), 0), on = onlineSum(d), dep = depositSum(d), cx = cashExpSum(d);
    return { d, off, on, dep, cx, oi: otherIncSum(d), diff: off - dep - cx, nOff: offeringsOn(d, 'off').length, nOn: offeringsOn(d, 'on').length, nk: db.incomes.some(x => x.date === d && !incAcc(x)) }; });
  const S2 = k => rows.reduce((s, r) => s + r[k], 0);
  const dcell = r => !(r.dep || r.cx) ? '<td class="num"></td>' : `<td class="num ${r.diff ? 'exp' : 'muted'}"><span class="click" data-cxw="${r.d}" title="이 주 지출 보기 · 현금 표시">${r.diff ? won0(r.diff) : '일치'}</span></td>`;
  return `<div class="head"><div><h1>주일별 헌금</h1><p>${y}년 · ${ds.length}주 · 오프라인 ${won0(S2('off'))} · 온라인 ${won0(S2('on'))} · 합계 ${won0(S2('off') + S2('on'))}원</p></div>
  <div class="row">${yearSel('wy', y)}${db.bank ? '<button class="btn" id="wrc">장부·통장 대조</button>' : ''}<button class="btn" id="wx">연간 Excel</button><button class="btn pri" data-go2="week">새 주일 입력</button></div></div>
  <p class="hint" style="margin-top:-8px">‘현금입금’은 총입출금의 현금입금 칸(통장에 넣은 금액), ‘현금지출’은 받은 현금에서 바로 쓴 돈 — 증빙이 <b>현금</b>이거나 <b>거래일시 없는</b> 지출(통장에서 나간 기록이 아님)입니다. 차이 = 오프라인 − 현금입금 − 현금지출. 차이 칸을 누르면 그 주 지출을 보고 현금으로 표시할 수 있습니다. ‘온라인’은 기부금영수증 대상 헌금만, ‘기타입금’은 그 밖의 통장 입금(주차·회비·찬조·이자·종류 빈칸) — 온라인 금액을 누르면 그 주 통장 입금 전체를 한 건씩 대조할 수 있습니다.</p>
  <div class="tbl-wrap"><table><thead><tr><th>주일</th><th class="num">오프라인</th><th class="num">인원</th><th class="num">현금입금(통장)</th><th class="num">현금지출</th><th class="num">차이</th><th class="num">온라인</th><th class="num">인원</th><th class="num">합계</th><th class="num" title="온라인 헌금 외 통장 입금(주차·회비·찬조·이자·종류 빈칸 등) — 헌금 합계에는 들어가지 않음">기타입금</th></tr></thead><tbody>
  ${rows.map(r => `<tr class="click" data-wk="${r.d}"><td>${dotDate(r.d)}</td><td class="num">${won(r.off)}</td><td class="num muted">${r.nOff || ''}</td><td class="num">${won(r.dep)}</td><td class="num">${r.cx ? `<span class="click" data-cxw="${r.d}">${won0(r.cx)}</span>` : ''}</td>${dcell(r)}<td class="num">${r.on || r.oi ? `<span class="click" data-onw="${r.d}" title="이 주 통장 입금 내역">${won0(r.on)}</span>` : ''}</td><td class="num muted">${r.nOn || ''}</td><td class="num"><b>${won0(r.off + r.on)}</b></td><td class="num muted">${r.oi ? `<span class="click" data-onw="${r.d}">${won0(r.oi)}</span>${r.nk ? ' <span class="pill bad" title="헌금종류 빈칸">미분류</span>' : ''}` : ''}</td></tr>`).join('') || `<tr><td colspan="10" class="empty">기록 없음</td></tr>`}
  ${rows.length ? `<tr class="tot"><td>합계</td><td class="num">${won0(S2('off'))}</td><td></td><td class="num">${won0(S2('dep'))}</td><td class="num">${won0(S2('cx'))}</td><td class="num">${won0(S2('diff'))}</td><td class="num">${won0(S2('on'))}</td><td></td><td class="num">${won0(S2('off') + S2('on'))}</td><td class="num">${won0(S2('oi'))}</td></tr>` : ''}
  </tbody></table></div>`;
};
/** 장부 잔액 − 통장 잔액 차이 풀이 */
function reconDialog() {
  const R = reconData(); if (!R) return toast('총입출금을 먼저 올리세요');
  const sg = v => v > 0 ? '+' + won0(v) : won0(v);
  const d = modal(`<h2>장부·통장 대조 — ${dotDate(R.cut)} 주까지</h2>
  <table><tbody>
  <tr><td>장부 잔액 <span class="muted">(이월 + 수입 − 지출, ${dotDate(R.cut)} 주까지)</span></td><td class="num">${won0(R.book)}</td></tr>
  <tr><td>통장 잔액 <span class="muted">(${esc(R.time)} 거래후 잔액)</span></td><td class="num">${won0(R.bank)}</td></tr>
  <tr class="tot"><td>차이 (장부 − 통장)</td><td class="num">${sg(R.diff)}</td></tr>
  <tr><td>① 손에 있는 현금 <span class="muted">— 오프라인 헌금 − 현금입금 − 현금지출 (아래 주별)</span></td><td class="num">${sg(R.cash)}</td></tr>
  <tr><td>② 통장 잔액이 끊긴 곳 <span class="muted">— 총입출금에 빠졌거나 금액이 다른 통장 거래 (거래일시 빈 ‘온라인’ 줄 반영)</span></td><td class="num">${R.checks ? sg(R.chain) : '<span class="muted">총입출금 다시 올리면 검사</span>'}</td></tr>
  <tr><td>③ 전년 이월금 − 첫 거래 전 통장 잔액</td><td class="num">${R.hasOpen ? sg(R.open) : '<span class="muted">-</span>'}</td></tr>
  ${R.odd.length ? `<tr><td>⑤ 통장 기록과 어긋나게 적힌 줄 <span class="muted">— 거래일시 없는 현금입금, 거래일시 있는데 비고 ‘오프라인’인 출금 (아래)</span></td><td class="num">${sg(R.oddSum)}</td></tr>` : ''}
  <tr class="tot"><td>④ 설명 안 되는 차이</td><td class="num ${R.rest ? 'exp' : ''}">${R.rest ? sg(R.rest) : '0 ✓'}</td></tr>
  </tbody></table>
  <div style="margin-top:10px">
  ${R.weeks.length ? `<h3 style="margin:8px 0 4px">① 현금이 남거나 모자란 주 <span class="muted" style="font-weight:400">— 누르면 그 주 지출에서 현금지출을 고를 수 있습니다</span></h3>
  <table><thead><tr><th>주일</th><th class="num">오프라인</th><th class="num">현금입금</th><th class="num">현금지출</th><th class="num">남은 현금</th></tr></thead><tbody>
  ${R.weeks.map(o => `<tr class="click" data-rw="${o.d}"><td>${dotDate(o.d)}</td><td class="num">${won(o.off + o.ci)}</td><td class="num">${won(o.dep)}</td><td class="num">${won(o.cx)}</td><td class="num ${o.r < 0 ? 'exp' : ''}">${sg(o.r)}</td></tr>`).join('')}</tbody></table>
  <p class="hint">+ 는 받았는데 통장에 안 넣은 현금(또는 현금지출 미기록), − 는 받은 것보다 더 넣거나 쓴 경우(다른 주 현금, 오프라인 헌금 누락).</p>` : ''}
  ${R.checks && R.checks.length ? `<h3 style="margin:12px 0 4px">② 통장 잔액이 끊긴 곳 <span class="muted" style="font-weight:400">— 엑셀 행 번호 바로 위쪽을 은행 거래내역과 비교</span></h3>
  <table><thead><tr><th>엑셀 행</th><th>거래일시</th><th>내용</th><th class="num">통장 − 계산</th><th>의심</th></tr></thead><tbody>
  ${R.checks.map(c => `<tr><td>${c.row}</td><td class="muted">${esc(c.time.slice(5, 16).replace('-', '.'))}</td><td>${esc(c.memo)}</td><td class="num">${sg(c.gap)}</td><td>${c.by ? `<span class="pill">설명됨</span> ${c.by.row}행 ‘${esc(c.by.memo)}’ 거래일시 빈칸 — 거래일시를 넣으면 사라짐` : c.gap > 0 ? `입금 ${won0(c.gap)}원 빠짐 (또는 출금 과다 기록)` : `출금 ${won0(-c.gap)}원 빠짐 (또는 입금 중복·과다 기록)`}</td></tr>`).join('')}</tbody></table>` : ''}
  ${R.odd.length ? `<h3 style="margin:12px 0 4px">⑤ 통장 기록과 어긋나게 적힌 줄</h3>
  <table><thead><tr><th>엑셀 행</th><th>주(Month)</th><th>내용</th><th class="num">금액</th><th>문제</th></tr></thead><tbody>
  ${R.odd.map(x => `<tr><td>${x.row}</td><td>${dotDate(x.date)}</td><td>${esc(x.memo)}</td><td class="num">${sg(x.d)}</td><td>${esc(x.why)} — ${/현금입금/.test(x.why) ? '실제로 통장에 넣었으면 거래일시를 넣고, 안 넣었으면 현금입금 칸을 비우세요' : '통장 거래면 비고를 온라인으로, 현금이면 거래일시를 지우세요'}</td></tr>`).join('')}</tbody></table>` : ''}
  ${R.noTime.filter(x => !x.hit).length ? `<p class="hint">거래일시 빈 ‘온라인’ 줄 — 맞는 통장 잔액 끊김이 없어 현금 거래일 수 있습니다(그렇다면 비고를 ‘오프라인’으로): ${R.noTime.filter(x => !x.hit).map(x => `${x.row}행 ${esc(x.memo)} ${won0(x.d)}`).join(', ')}</p>` : ''}
  </div>
  <div class="acts"><button class="btn pri" data-x>닫기</button></div>`, { wide: true });
  d.querySelector('[data-x]').onclick = closeModal;
  $$('[data-rw]', d).forEach(b => b.onclick = () => { closeModal(); cashExpDialog(b.dataset.rw, () => { go(S.view); reconDialog(); }); });
}
/** 그 주 통장 입금 전체 — 온라인 헌금(이름·종류) + 기타입금(계정), 거래일시 순 */
function onlineDialog(date) {
  const L = [];
  for (const o of offeringsOn(date, 'on')) {
    const nm = (donorById(o.donorId) || {}).name || '?', ka = o.ka || {}, keys = (o.keys || []).filter(k => ka[k]);
    if (keys.length) for (const k of keys) { const [t, memo] = k.split('|'); for (const [kind, v] of Object.entries(ka[k])) L.push({ t, memo, amt: v, who: nm, cls: kind, on: 1, anon: nm === '무명' }); }
    const rest = rowTotal(o) - keys.reduce((s, k) => s + Object.values(ka[k]).reduce((a, b) => a + b, 0), 0);
    if (rest) L.push({ t: '', memo: o.memo || '', amt: rest, who: nm, cls: Object.keys(o.a).join('·'), on: 1, anon: nm === '무명' });
  }
  for (const x of db.incomes.filter(x => x.date === date)) { const a = incAcc(x); L.push({ t: x.time || '', memo: x.memo || '', amt: x.amount, who: '', cls: a ? accLabel(a) + (x.kind ? ` (${x.kind})` : '') : '', on: 0, bad: !a }); }
  L.sort((a, b) => (a.t || '9').localeCompare(b.t || '9'));
  const S1 = L.filter(x => x.on).reduce((s, x) => s + x.amt, 0), S0 = L.filter(x => !x.on).reduce((s, x) => s + x.amt, 0);
  const d = modal(`<h2>${korDate(date)} 주 통장 입금 (Month 기준)</h2>
  <p>온라인 헌금 <b>${won0(S1)}</b> + 기타입금 <b>${won0(S0)}</b> = 통장 입금 합계 <b>${won0(S1 + S0)}</b>원 · ${L.length}건</p>
  <p class="muted" style="margin-top:-6px">통장 거래내역의 같은 기간 입금 합계와 비교하세요. 현금입금(헌금 현금을 통장에 넣은 것)은 여기 들어가지 않습니다.</p>
  <div class="tbl-wrap" style="max-height:55vh"><table><thead><tr><th>거래일시</th><th>내용</th><th class="num">금액</th><th>구분</th><th>헌금자 / 계정</th></tr></thead><tbody>
  ${L.map(x => `<tr><td class="muted">${esc((x.t || '').slice(5, 16).replace('-', '.'))}</td><td>${esc(x.memo)}</td><td class="num">${won0(x.amt)}</td><td>${x.on ? '<span class="pill">헌금</span>' : '<span class="pill warn">기타입금</span>'}</td><td>${x.on ? `${x.anon ? '<span class="pill bad">무명</span>' : esc(x.who)} <span class="muted">${esc(x.cls)}</span>` : x.bad ? '<span class="pill bad">미분류 — 헌금종류 빈칸</span>' : esc(x.cls)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">입금 없음</td></tr>'}
  </tbody></table></div>
  <div class="acts"><button class="btn" data-xl>Excel</button><button class="btn pri" data-x>닫기</button></div>`);
  d.querySelector('[data-x]').onclick = closeModal;
  d.querySelector('[data-xl]').onclick = () => saveXLSX(`통장입금_${date}.xlsx`, book([['입금', makeSheet([['거래일시', '내용', '금액', '구분', '헌금자', '종류/계정'], ...L.map(x => [x.t, x.memo, x.amt, x.on ? '헌금' : '기타입금', x.who, x.bad ? '미분류' : x.cls]), ['합계', '', { f: `SUM(C2:C${L.length + 1})` }]], { widths: [18, 26, 13, 10, 10, 24] })]]));
}
/** 그 주 지출 목록 — 체크하면 증빙 '현금'(현금지출), 해제하면 원래 증빙(없으면 기타) */
function cashExpDialog(date, after) {
  const L = db.expenses.filter(x => x.date === date || (!isSunday(x.date) && lastSunday(x.date) === date)).sort((a, b) => (a.time || a.date).localeCompare(b.time || b.date));
  const off = offeringsOn(date, 'off').reduce((s, o) => s + rowTotal(o), 0), dep = depositSum(date);
  const d = modal(`<h2>${korDate(date)} 주 지출 — 현금지출 표시</h2>
  <p class="muted">오프라인 ${won0(off)} − 현금입금 ${won0(dep)} = <b>${won0(off - dep)}</b>원. 받은 현금에서 바로 쓴 지출을 체크하세요(증빙이 ‘현금’으로 바뀜). 거래일시 없는 지출은 처음부터 체크되어 있고, 통장에서 나간 것이면 체크를 풉니다.</p>
  <div class="tbl-wrap" style="max-height:50vh"><table><thead><tr><th>현금</th><th>거래일시</th><th>계정</th><th class="num">금액</th><th>내용</th><th>지금 증빙</th></tr></thead><tbody>
  ${L.map(x => `<tr><td><input type="checkbox" data-cid="${x.id}" ${isCashExp(x) ? 'checked' : ''}></td><td class="muted">${esc((x.time || '').slice(5, 16).replace('-', '.')) || dotDate(x.date)}</td><td>${esc(x.acc)}</td><td class="num">${won0(x.amount)}</td><td>${esc(x.memo || '')}${x.payee ? ' · ' + esc(x.payee) : ''}</td><td>${x.proof ? `<span class="pill">${esc(x.proof)}</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">이 주 지출 기록 없음</td></tr>'}
  </tbody></table></div>
  <p id="cxsum" style="margin-top:10px"></p>
  <div class="acts"><button class="btn" data-x>취소</button><button class="btn pri" data-ok>저장</button></div>`);
  const sum = () => { const c = L.filter(x => $(`[data-cid="${x.id}"]`, d).checked).reduce((s, x) => s + x.amount, 0), r = off - dep - c;
    $('#cxsum', d).innerHTML = `현금지출 ${won0(c)}원 → 차이 <b class="${r ? 'exp' : ''}">${r ? won0(r) + '원' : '일치'}</b>`; };
  $$('[data-cid]', d).forEach(b => b.onchange = sum); sum();
  d.querySelector('[data-x]').onclick = closeModal;
  d.querySelector('[data-ok]').onclick = () => {
    let n = 0;
    L.forEach(x => { const on = $(`[data-cid="${x.id}"]`, d).checked; if (on === isCashExp(x)) return;
      if (on) { x.cash = true; if (x.proof !== '현금') { x.proof0 = x.proof || ''; x.proof = '현금'; } }
      else { x.cash = false; if (x.proof === '현금') { x.proof = x.proof0 || '기타'; delete x.proof0; } }
      x.t = now(); n++; });
    save(); closeModal(); toast(n ? `${n}건 증빙 변경` : '변경 없음'); after && after();
  };
}
BIND.weeks = () => {
  $('#wy').onchange = e => go('weeks', { year: +e.target.value });
  $$('[data-wk]').forEach(b => b.onclick = () => go('week', { date: b.dataset.wk }));
  if ($('#wrc')) $('#wrc').onclick = () => reconDialog();
  $$('[data-onw]').forEach(b => b.onclick = e => { e.stopPropagation(); onlineDialog(b.dataset.onw); });
  $$('[data-cxw]').forEach(b => b.onclick = e => { e.stopPropagation(); cashExpDialog(b.dataset.cxw, () => go('weeks')); });
  $$('[data-go2]').forEach(b => b.onclick = () => go(b.dataset.go2, { date: lastSunday() }));
  $('#wx').onclick = () => {
    const y = S.year;
    const kinds = [...new Set(db.offerings.filter(o => yearOf(o.date) === y).flatMap(o => Object.keys(o.a)))].sort((a, b) => (cols().indexOf(a) + 1 || 99) - (cols().indexOf(b) + 1 || 99));
    const ds = offeringDates().filter(d => yearOf(d) === y);
    const aoa = [['주일', '오프라인', '현금입금(통장)', '현금지출', '차이', '온라인', ...kinds, '합계'], ...ds.map((d, i) => { const s = sumByCol(offeringsOn(d)), R = i + 2; return [d, offeringsOn(d, 'off').reduce((t, o) => t + rowTotal(o), 0), depositSum(d) || null, cashExpSum(d) || null, { f: `IF(AND(C${R}="",D${R}=""),"",B${R}-N(C${R})-N(D${R}))` }, onlineSum(d) || null, ...kinds.map(k => s[k] || null), { f: `SUM(${CL(6)}${R}:${CL(5 + kinds.length)}${R})` }]; })];
    aoa.push(['합계', ...[1, 2, 3].map(c => ({ f: `SUM(${CL(c)}2:${CL(c)}${ds.length + 1})` })), ...kinds.map((k, i) => ({ f: `SUM(${CL(4 + i)}2:${CL(4 + i)}${ds.length + 1})` })), { f: `SUM(${CL(4 + kinds.length)}2:${CL(4 + kinds.length)}${ds.length + 1})` }]);
    const ppl = db.donors.map(d => ({ d, s: sumByCol(db.offerings.filter(o => o.donorId === d.id && yearOf(o.date) === y)) })).filter(x => Object.values(x.s).some(v => v)).sort((a, b) => (a.d.anon - b.d.anon) || a.d.no - b.d.no);
    const aoa2 = [['번호', '이름', ...kinds, '합계'], ...ppl.map((x, i) => [x.d.anon ? '' : x.d.no, x.d.name, ...kinds.map(k => x.s[k] || null), { f: `SUM(C${i + 2}:${CL(1 + kinds.length)}${i + 2})` }])];
    saveXLSX(`주일헌금_${y}.xlsx`, book([[`${y} 주일별`, makeSheet(aoa, { widths: [12, 13, 14, 13, ...kinds.map(() => 11), 13] })], [`${y} 헌금자별`, makeSheet(aoa2, { widths: [6, 12, ...kinds.map(() => 11), 13], plainCols: [0] })]]));
  };
};

/* ======================= 지출 · 기타수입 ======================= */
VIEWS.ledger = () => {
  const y = S.year, isExp = S.lt === 'exp';
  let list = (isExp ? db.expenses : db.incomes).filter(x => yearOf(x.date) === y);
  if (S.lm) list = list.filter(x => +x.date.slice(5, 7) === +S.lm);
  if (S.la) list = list.filter(x => (isExp ? x.acc : (incAcc(x) || {}).hang || '(미분류)') === S.la);
  list = [...list].sort((a, b) => (b.time || b.date).localeCompare(a.time || a.date) || b.t - a.t);
  const sum = list.reduce((s, x) => s + x.amount, 0);
  const accs = db.accounts.filter(a => isExp ? a.type === '지출' : a.type === '수입');
  const lbl = x => { if (isExp) { const a = accByHang(x.acc); return a ? `${esc(a.code)}. ${esc(x.acc)}` : `${esc(x.acc)} <span class="pill bad">예산에 없음</span>`; }
    const a = incAcc(x); return a ? esc(accLabel(a)) + (x.kind ? ` <span class="muted" style="font-size:13px">(${esc(x.kind)})</span>` : '') : `<span class="pill bad">미분류</span> ${esc(x.kind || '')}`; };
  return `<div class="head"><div><h1>지출 · 기타수입</h1><p>${y}년 ${S.lm ? S.lm + '월 ' : ''}${S.la ? '· ' + esc(S.la) + ' ' : ''}· ${list.length}건 · ${won0(sum)}원</p></div>
  <div class="row"><button class="btn pri" id="addx">+ ${isExp ? '지출' : '기타수입'} 기록</button></div></div>
  <div class="toolbar"><div class="seg"><button data-lt="exp" aria-pressed="${isExp}">지출</button><button data-lt="inc" aria-pressed="${!isExp}">기타수입 (사용료·월세·주차·이월 등)</button></div>
  ${yearSel('ly', y)}<select id="lm"><option value="">전체 월</option>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${+S.lm === i + 1 ? 'selected' : ''}>${i + 1}월</option>`).join('')}</select>
  <select id="la"><option value="">전체 계정</option>${accs.map(a => `<option value="${esc(a.hang)}" ${S.la === a.hang ? 'selected' : ''}>${esc(accLabel(a))}</option>`).join('')}${isExp ? '' : `<option value="(미분류)" ${S.la === '(미분류)' ? 'selected' : ''}>미분류</option>`}</select>
  <button class="btn" id="lx">Excel</button></div>
  <div class="tbl-wrap"><table><thead><tr><th>주(Month)</th><th>거래일시</th><th>계정</th><th class="num">금액</th><th>내용</th>${isExp ? '<th>증빙</th><th>결재</th>' : ''}</tr></thead><tbody>
  ${list.map(x => `<tr class="click" data-id="${x.id}"><td>${dotDate(x.date)}</td><td class="muted">${esc((x.time || '').slice(5, 16).replace('-', '.'))}</td><td>${lbl(x)}</td><td class="num ${isExp ? 'exp' : 'inc'}">${won0(x.amount)}</td><td style="max-width:320px;overflow:hidden;text-overflow:ellipsis">${esc(x.memo || '')}${x.payee ? ` · ${esc(x.payee)}` : ''}</td>${isExp ? `<td>${x.proof ? `<span class="pill">${esc(x.proof)}</span>` : ''}</td><td>${esc(x.approve || '')}</td>` : ''}</tr>`).join('') || `<tr><td colspan="7" class="empty">기록 없음</td></tr>`}
  </tbody></table></div>`;
};
function ledgerForm(isExp, x) {
  const accs = db.accounts.filter(a => isExp ? a.type === '지출' : a.type === '수입');
  const groups = [...new Set(accs.map(a => a.gwan))];
  x = x || { date: today(), acc: '', amount: 0, payee: '', memo: '', proof: isExp ? '영수증' : '', approve: '' };
  const curAcc = isExp ? x.acc : ((incAcc(x) || {}).hang || '');
  const opts = g => accs.filter(a => a.gwan === g).map(a => `<option value="${esc(a.hang)}" ${a.hang === curAcc ? 'selected' : ''}>${esc(accLabel(a))}</option>`).join('');
  const d = modal(`<h2>${x.id ? '수정' : '새'} ${isExp ? '지출' : '기타수입'}</h2>
  ${x.time ? `<p class="muted">통장 거래 ${esc(x.time)}${x.kind ? ` · 헌금종류 ‘${esc(x.kind)}’` : ''}</p>` : ''}
  <div class="fgrid">
    <label class="f">주(Month) / 날짜<input type="date" id="fd" value="${x.date}"></label>
    <label class="f">계정<select id="fa">${!curAcc && !isExp ? '<option value="">(미분류 — 골라 주세요)</option>' : ''}${groups.map(g => g ? `<optgroup label="${esc(g)}">${opts(g)}</optgroup>` : opts(g)).join('')}</select></label>
    <label class="f">금액<input type="text" inputmode="numeric" id="fm" value="${x.amount ? won0(x.amount) : ''}" autofocus></label>
    ${isExp ? `<label class="f">지급처<input type="text" id="fp" value="${esc(x.payee || '')}"></label>` : ''}
  </div>
  <label class="f" style="margin-top:12px">내용<input type="text" id="fn" value="${esc(x.memo || '')}"></label>
  ${isExp ? `<div class="fgrid" style="margin-top:12px">
    <label class="f">증빙<select id="fpr">${['지출결의서', '영수증', '카드전표', '세금계산서', '이체확인증', '현금', '기타', ''].map(v => `<option value="${v}" ${v === (x.proof || '') ? 'selected' : ''}>${v || '(없음)'}</option>`).join('')}</select></label>
    <label class="f">결재<select id="fap">${['', '재정부장 전결', '재정부장·운영위원장', '운영위원회 결의'].map(v => `<option value="${v}" ${v === (x.approve || '') ? 'selected' : ''}>${v || '(미기재)'}</option>`).join('')}</select></label></div>
    <p class="hint" id="fhint"></p>` : ''}
  <div class="acts">${x.id ? `<button class="btn danger" data-del style="margin-right:auto">삭제</button>${isExp ? '<button class="btn" data-vc>지출결의서 PDF</button>' : ''}` : ''}<button class="btn" data-x>취소</button><button class="btn pri" data-ok>저장</button></div>`);
  const hint = () => { const h = $('#fhint', d); if (!h) return; const v = parseAmt($('#fm', d).value); h.textContent = v > 1000000 ? '100만원 초과 — 재정부장 결재와 운영위원회 회장 승인이 필요합니다 (정관 제44조 1·3항).' : v ? '100만원 이하 — 예산 범위 내 통상 지출은 재정부장 전결 가능 (정관 제44조 3항).' : ''; };
  $('#fm', d).oninput = hint; hint();
  const read = () => ({ date: $('#fd', d).value, acc: $('#fa', d).value, amount: parseAmt($('#fm', d).value), memo: $('#fn', d).value.trim(),
    ...(isExp ? { payee: $('#fp', d).value.trim(), proof: $('#fpr', d).value, approve: $('#fap', d).value } : {}) });
  d.querySelector('[data-x]').onclick = closeModal;
  d.querySelector('[data-ok]').onclick = () => {
    const v = read();
    if (!v.date || !v.amount || (isExp && !v.acc)) return toast('날짜·계정·금액을 입력하세요');
    const L = isExp ? db.expenses : db.incomes;
    if (x.id) Object.assign(L.find(z => z.id === x.id), v, { t: now() });
    else L.push({ id: uid(), t: now(), time: '', kind: '', key: '', ...v });
    logAct(`${isExp ? '지출' : '기타수입'} ${x.id ? '수정' : '기록'}: ${v.date} ${v.acc || '미분류'} ${won0(v.amount)}`);
    save(); closeModal(); render();
  };
  const del = d.querySelector('[data-del]');
  if (del) del.onclick = async () => {
    if (!(await confirmBox(`${dotDate(x.date)} ${x.acc || x.kind || ''} ${won0(x.amount)}원 기록을 삭제할까요?${x.key ? '\n(총입출금 거래 — 다시 올려도 들어오지 않게 기억합니다. 설정 → 지운 거래에서 되살릴 수 있습니다)' : ''}`, '삭제', true))) return;
    if (x.key) rememberDeleted(x, isExp ? '지출' : '기타수입');
    if (isExp) db.expenses = db.expenses.filter(z => z.id !== x.id); else db.incomes = db.incomes.filter(z => z.id !== x.id);
    logAct(`${isExp ? '지출' : '기타수입'} 삭제: ${x.date} ${x.acc} ${won0(x.amount)}`); save(); render();
  };
  const vc = d.querySelector('[data-vc]');
  if (vc) vc.onclick = () => savePDF(`지출결의서_${x.date}_${x.acc}.pdf`, voucherPDF({ ...x, ...read() }));
}
BIND.ledger = () => {
  const isExp = S.lt === 'exp';
  $$('[data-lt]').forEach(b => b.onclick = () => go('ledger', { lt: b.dataset.lt, la: '' }));
  $('#ly').onchange = e => go('ledger', { year: +e.target.value });
  $('#lm').onchange = e => go('ledger', { lm: e.target.value });
  $('#la').onchange = e => go('ledger', { la: e.target.value });
  $('#addx').onclick = () => ledgerForm(isExp);
  $$('tr[data-id]').forEach(tr => tr.onclick = () => ledgerForm(isExp, (isExp ? db.expenses : db.incomes).find(x => x.id === tr.dataset.id)));
  $('#lx').onclick = () => {
    const y = S.year, L = (isExp ? db.expenses : db.incomes).filter(x => yearOf(x.date) === y).sort((a, b) => (a.time || a.date).localeCompare(b.time || b.date));
    const aoa = isExp ? [['주(Month)', '거래일시', '순위', '지출계정과목', '금액', '내용', '증빙', '결재'], ...L.map(x => [x.date, x.time || '', +(accByHang(x.acc) || {}).code || '', x.acc, x.amount, x.memo || '', x.proof || '', x.approve || ''])]
      : [['주(Month)', '거래일시', '목', '헌금종류', '금액', '내용'], ...L.map(x => [x.date, x.time || '', accLabel(incAcc(x)) || '미분류', x.kind || '', x.amount, x.memo || ''])];
    aoa.push(['합계', '', '', '', { f: `SUM(E2:E${L.length + 1})` }]);
    saveXLSX(`${isExp ? '지출' : '기타수입'}_${y}.xlsx`, book([[`${y} ${isExp ? '지출' : '기타수입'}`, makeSheet(aoa, { widths: [12, 18, 6, 20, 13, 34, 12, 16], plainCols: [2] })]]));
  };
};

/* ======================= 예산 · 결산 ======================= */
VIEWS.budget = () => {
  const y = S.year, [f, t] = yearRange(y), act = actuals(f, t), bud = budgetOf(y), prev = actuals(...yearRange(y - 1));
  const uc = unclassified(f, t);
  const row = (a, label) => {
    const b = bud[a.hang] || 0, v = act[a.hang] || 0;
    return `<td class="num"><input type="text" inputmode="numeric" data-b="${esc(a.hang)}" value="${b ? won0(b) : ''}" style="width:125px;text-align:right"></td>
      <td class="num">${won(v)}</td><td class="num ${v - b > 0 && a.type === '지출' ? 'exp' : ''}">${b || v ? won(v - b) : ''}</td><td>${b ? meter(v, b, a.type === '수입') : ''}</td><td class="num muted">${b ? pct(v, b) + '%' : ''}</td><td class="num muted">${won(prev[a.hang])}</td>`;
  };
  const sums = items => { const b = items.reduce((s, a) => s + (bud[a.hang] || 0), 0), v = items.reduce((s, a) => s + (act[a.hang] || 0), 0); return { b, v }; };
  const sumCells = ({ b, v }) => `<td class="num">${won0(b)}</td><td class="num">${won0(v)}</td><td class="num">${won(v - b)}</td><td>${b ? meter(v, b) : ''}</td><td class="num">${b ? pct(v, b) + '%' : ''}</td><td></td>`;
  // 수입: 관·항·목
  let ih = '';
  const ig = groupAccounts('수입').filter(g => g.gwan !== '이월금');
  for (const g of ig) {
    for (const a of g.items) ih += `<tr><td class="muted">${esc(g.gwan)}</td><td class="muted">${esc(a.mid)}</td><td style="white-space:normal;min-width:180px;max-width:300px">${esc(accLabel(a))}<span class="muted" style="display:block;font-size:12px;line-height:1.35">${esc(a.kinds.join(', '))}</span></td>${row(a)}</tr>`;
    ih += `<tr class="sub"><td>${esc(g.gwan)}</td><td colspan="2">소 계</td>${sumCells(sums(g.items))}</tr>`;
  }
  const ucSum = uc.reduce((s, x) => s + x.amount, 0);
  if (uc.length) ih += uc.map(x => `<tr><td><span class="pill bad">미분류</span></td><td></td><td>${esc(x.kind)} <span class="muted">(${x.n}건)</span></td><td></td><td class="num">${won0(x.amount)}</td><td colspan="4"></td></tr>`).join('');
  const IT = sums(ig.flatMap(g => g.items)); IT.v += ucSum;
  ih += `<tr class="tot"><td colspan="3">총 수 입</td>${sumCells(IT)}</tr>`;
  // 지출
  let eh = '';
  const ea = db.accounts.filter(a => a.type === '지출');
  for (const a of ea) eh += `<tr><td class="num muted">${esc(a.code)}</td><td>${esc(a.hang)}</td>${row(a)}<td class="muted" style="font-size:13px">${esc(a.note || '')}</td></tr>`;
  const ET = sums(ea);
  eh += `<tr class="tot"><td colspan="2">지출 합계</td>${sumCells(ET)}<td></td></tr>`;
  const carryA = db.accounts.find(isCarry), carryB = carryA ? bud[carryA.hang] || 0 : 0, carryV = carryA ? act[carryA.hang] || 0 : 0;
  const H = l => `<th class="num">${y} 예산</th><th class="num">${y} 실적</th><th class="num">차액</th><th>${l}</th><th></th><th class="num">${y - 1} 실적</th>`;
  return `<div class="head"><div><h1>예산 · 결산</h1><p>${y}년 · 수입예산 ${won0(IT.b)} / 지출예산 ${won0(ET.b)}</p></div>
  <div class="row">${yearSel('by', y)}<button class="btn" id="mk">${y + 1}년 예산안 만들기</button></div></div>
  ${uc.length ? `<div class="banner warn"><span>계정이 정해지지 않은 수입 ${won0(ucSum)}원 — 실적 합계에는 넣었지만 목에는 안 들어갑니다. 헌금종류는 설정 → ‘헌금종류 연결’에서, 종류 빈칸은 ‘지출 · 기타수입 → 기타수입’에서 계정을 정하세요.</span><span class="row"><button class="btn sm" data-go3="settings">헌금종류 연결</button><button class="btn sm" data-go3="ledger">기타수입</button></span></div>` : ''}
  <div class="kpis">
    <div class="kpi"><span>전년 이월</span><b>${won0(carryV || carryB)}</b><small>예산 <input type="text" inputmode="numeric" data-b="${esc(carryA ? carryA.hang : '전년도이월금')}" value="${carryB ? won0(carryB) : ''}" style="width:120px;text-align:right;padding:2px 6px"></small></div>
    <div class="kpi"><span>수입 예산 / 실적</span><b>${won0(IT.v)}</b><small>예산 ${won0(IT.b)}</small></div>
    <div class="kpi"><span>지출 예산 / 실적</span><b>${won0(ET.v)}</b><small>예산 ${won0(ET.b)}</small></div>
    <div class="kpi"><span>예상 잔액 (예산 기준)</span><b>${won0(carryB + IT.b - ET.b)}</b><small>실적 기준 ${won0((carryV || carryB) + IT.v - ET.v)}</small></div>
  </div>
  <h2 style="font-size:16px;margin:18px 0 8px">1. 수입부</h2><div class="tbl-wrap"><table><thead><tr><th>관</th><th>항</th><th>목 · 연결된 헌금종류</th>${H('달성률')}</tr></thead><tbody>${ih}</tbody></table></div>
  <h2 style="font-size:16px;margin:22px 0 8px">2. 지출부</h2><div class="tbl-wrap"><table><thead><tr><th class="num">순위</th><th>항 목</th>${H('실적(%)')}<th>비 고</th></tr></thead><tbody>${eh}</tbody></table></div>`;
};
BIND.budget = () => {
  $$('[data-go3]').forEach(b => b.onclick = () => go(b.dataset.go3, b.dataset.go3 === 'ledger' ? { lt: 'inc', la: '(미분류)' } : {}));
  $('#by').onchange = e => go('budget', { year: +e.target.value });
  $$('[data-b]').forEach(i => {
    i.onfocus = () => { i.value = i.value.replace(/,/g, ''); i.select(); };
    i.onchange = () => { const v = parseAmt(i.value); const B = db.budgets[S.year] = db.budgets[S.year] || {}; if (v) B[i.dataset.b] = v; else delete B[i.dataset.b]; save(); render(); };
    i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const all = $$('[data-b]'); const nx = all[all.indexOf(i) + 1]; i.dispatchEvent(new Event('change')); setTimeout(() => { const n2 = $$('[data-b]')[all.indexOf(i) + 1]; if (n2) n2.focus(); }, 0); } };
  });
  $('#mk').onclick = () => {
    const y = S.year, ny = y + 1;
    const d = modal(`<h2>${ny}년 예산안 만들기</h2>
    <p>${ny}년 각 항의 예산을 아래 기준으로 채웁니다. 만든 뒤 항목별로 고칠 수 있습니다.</p>
    <div class="fgrid"><label class="f">기준<select id="mb"><option value="bud">${y}년 예산</option><option value="act">${y}년 실적(현재까지)</option><option value="ann" ${y === thisYear ? 'selected' : ''}>${y}년 실적 연환산</option></select></label>
    <label class="f">일괄 증감률(%)<input type="number" id="mr" value="0" step="0.5"></label>
    <label class="f">반올림 단위<select id="mu"><option value="1000">천원</option><option value="10000" selected>만원</option><option value="100000">10만원</option></select></label></div>
    <label style="display:flex;gap:8px;margin-top:12px"><input type="checkbox" id="mo"> 이미 입력된 ${ny}년 예산도 덮어쓰기</label>
    <p class="hint">연환산 = 현재까지 실적 × 12 ÷ 지난 개월 수. 전년도이월금 항목은 비워 두니 결산 후 입력하세요.</p>
    <div class="acts"><button class="btn" data-x>취소</button><button class="btn pri" data-ok>만들기</button></div>`);
    d.querySelector('[data-x]').onclick = closeModal;
    d.querySelector('[data-ok]').onclick = () => {
      const base = $('#mb', d).value, r = 1 + (+$('#mr', d).value || 0) / 100, u = +$('#mu', d).value, over = $('#mo', d).checked;
      const act = actuals(...yearRange(y)), bud = budgetOf(y);
      const months = y === thisYear ? Math.max(1, new Date().getMonth() + (new Date().getDate() > 15 ? 1 : 0.5)) : 12;
      const B = db.budgets[ny] = db.budgets[ny] || {}; let n = 0;
      for (const a of db.accounts) {
        if (isCarry(a)) continue;
        if (B[a.hang] && !over) continue;
        const v0 = base === 'bud' ? bud[a.hang] || 0 : base === 'act' ? act[a.hang] || 0 : (act[a.hang] || 0) * 12 / months;
        const v = Math.round(v0 * r / u) * u;
        if (v) { B[a.hang] = v; n++; }
      }
      logAct(`${ny}년 예산안 생성 (${n}개 항)`); save(); closeModal(); go('budget', { year: ny }); toast(`${ny}년 예산 ${n}개 항목을 채웠습니다`);
    };
  };
};

/* ======================= 보고서 출력 ======================= */
VIEWS.reports = () => {
  const y = S.year, rt = receiptTargets(y);
  const ds = offeringDates();
  const missing = rt.filter(x => !x.d.rrn || !x.d.address).length;
  const ch = db.settings.church;
  return `<div class="head"><div><h1>보고서 출력</h1><p>Excel은 수식이 들어간 편집용, PDF는 인쇄·배포용입니다.</p></div><div class="row">${yearSel('ry', y)}</div></div>
  <div class="grid2">
  <div class="panel"><h2>1. 주간 헌금집계표</h2>
    <p class="muted">지금 쓰시는 12열 양식 (번호·이름·항목·합계·내용, 소계·총계·담당자 줄).</p>
    <div class="row"><select id="r1d">${ds.slice().reverse().map(d => `<option value="${d}">${dotDate(d)}</option>`).join('') || '<option value="">기록 없음</option>'}</select>
    <button class="btn" data-r="1x">Excel</button><button class="btn pri" data-r="1p">PDF</button></div></div>
  <div class="panel"><h2>2. 제직회 분기 재정보고</h2>
    <p class="muted">재정 요약(전기이월·수입·지출·차기이월), 관/항별 분기 실적·연누계·예산 대비, 주일별 헌금 (정관 제43조 2항).</p>
    <div class="row"><select id="r2q">${[1, 2, 3, 4].map(q => `<option value="${q}" ${q === (y === thisYear ? Math.max(1, qOf(today()) - (new Date().getMonth() % 3 === 0 ? 1 : 0)) : 4) ? 'selected' : ''}>${y}년 ${q}/4분기</option>`).join('')}</select>
    <button class="btn" data-r="2x">Excel</button><button class="btn pri" data-r="2p">PDF</button></div></div>
  <div class="panel"><h2>3. 공동의회 예결산서</h2>
    <p class="muted">${y}년 예산·결산·차액·집행률과 ${y + 1}년 예산(안), 감사 확인란 (정관 제43조). ${y + 1}년 예산은 ‘예산 · 결산’ 화면에서 먼저 입력하세요.</p>
    <p class="hint">${Object.keys(budgetOf(y + 1)).length ? `${y + 1}년 예산 ${Object.keys(budgetOf(y + 1)).length}개 항목 입력됨` : `<span class="pill warn">${y + 1}년 예산 없음</span>`}</p>
    <div class="row"><button class="btn" data-r="3x">Excel</button><button class="btn pri" data-r="3p">PDF</button></div></div>
  <div class="panel"><h2>4. 교인별 기부금영수증</h2>
    <p class="muted">${y}년 헌금한 ${rt.length}명 · 월별 헌금 합계(오프라인+온라인)로 작성. 무명·구역/단체 이름과 ‘영수증’ 표시가 없는 수입(4.기타헌금: 사용료·월세·주차·회비 등)은 제외. 일련번호는 한 번 정해지면 다시 출력해도 같습니다.</p>
    ${missing ? `<p class="hint"><span class="pill warn">${missing}명 주소·주민번호 빈칸</span> 헌금자 명단에서 채우거나, 출력 후 손으로 쓰셔도 됩니다.</p>` : ''}
    ${!ch.regNo ? '<p class="hint"><span class="pill warn">교회 고유번호 없음</span> 설정에서 입력하세요.</p>' : ''}
    <div class="row"><label class="f" style="flex-direction:row;align-items:center;gap:6px">발행일 <input type="date" id="r4d" value="${y < thisYear ? `${y + 1}-01-15` : today()}"></label></div>
    <div class="row" style="margin-top:8px"><select id="r4w"><option value="">전체 (${rt.length}명)</option>${rt.map(x => `<option value="${x.d.id}">${esc(x.d.name)} · ${won0(x.total)}</option>`).join('')}</select>
    <button class="btn" data-r="4x">발급명세 Excel</button><button class="btn pri" data-r="4p">영수증 PDF</button></div></div>
  <div class="panel"><h2>5. 지출 항목별 보고서</h2>
    <p class="muted">지출예산 항목(순위)별 예산·실적·집행률·잔여 예산, 월별 지출표, 항목별 거래 상세. Excel은 상세 내역이 한 줄 한 건이라 필터·피벗에 바로 쓸 수 있습니다.</p>
    <div class="row"><select id="r5p"><option value="Y">${y}년 연간</option>${[1, 2, 3, 4].map(q => `<option value="Q${q}">${q}/4분기</option>`).join('')}${Array.from({ length: 12 }, (_, i) => `<option value="M${i + 1}">${i + 1}월</option>`).join('')}</select>
    <select id="r5a"><option value="">전체 항목</option>${db.accounts.filter(a => a.type === '지출').map(a => `<option value="${esc(a.hang)}">${esc(a.code)}. ${esc(a.hang)}</option>`).join('')}</select></div>
    <label style="display:flex;gap:8px;margin-top:8px"><input type="checkbox" id="r5d" checked> PDF에 거래 상세 내역 포함</label>
    <div class="row" style="margin-top:8px"><button class="btn" data-r="5x">Excel</button><button class="btn pri" data-r="5p">PDF</button></div></div>
  </div>
  <p class="hint">기부금영수증 서식은 「소득세법 시행규칙」 별지 제45호의2서식의 항목을 따랐습니다. 코드·근거법령 문구는 설정에서 바꿀 수 있으니, 처음 발급 전 세무서·노회 안내와 한 번 맞춰 보세요.</p>`;
};
BIND.reports = () => {
  $('#ry').onchange = e => go('reports', { year: +e.target.value });
  $$('[data-r]').forEach(b => b.onclick = async () => {
    const y = S.year, k = b.dataset.r;
    if (k[0] === '1') { const d = $('#r1d').value; if (!d) return toast('주일 기록이 없습니다'); return k === '1x' ? saveXLSX(`헌금집계_${d}.xlsx`, weeklyXLSX(d, db.settings.showAllDonors)) : savePDF(`헌금집계_${d}.pdf`, weeklyPDF(d, db.settings.showAllDonors), { landscape: true }); }
    if (k[0] === '2') { const q = +$('#r2q').value; return k === '2x' ? saveXLSX(`재정보고_${y}_${q}분기.xlsx`, quarterXLSX(y, q)) : savePDF(`재정보고_${y}_${q}분기.pdf`, quarterPDF(y, q)); }
    if (k[0] === '3') return k === '3x' ? saveXLSX(`예결산서_${y}.xlsx`, annualXLSX(y)) : savePDF(`예결산서_${y}.pdf`, annualPDF(y));
    if (k[0] === '5') { const per = $('#r5p').value, acc = $('#r5a').value, nm = `지출보고서_${y}_${per === 'Y' ? '연간' : per[0] === 'Q' ? per.slice(1) + '분기' : per.slice(1) + '월'}${acc ? '_' + acc.replace(/[\\/:*?"<>|]/g, '') : ''}`;
      return k === '5x' ? saveXLSX(nm + '.xlsx', expenseReportXLSX(y, per, acc)) : savePDF(nm + '.pdf', expenseReportPDF(y, per, acc, $('#r5d').checked)); }
    if (k === '4x') return saveXLSX(`기부금영수증_발급명세_${y}.xlsx`, receiptsXLSX(y));
    if (k === '4p') {
      const w = $('#r4w').value, r = receiptsPDF(y, w ? [w] : null, $('#r4d').value || today());
      if (!r.count) return toast(`${y}년 헌금 기록이 없습니다`);
      logAct(`${y}년 기부금영수증 출력 ${r.count}매`);
      return savePDF(`기부금영수증_${y}${w ? '_' + donorById(w).name : ''}.pdf`, r.html);
    }
  });
};

/* ======================= 헌금자 명단 ======================= */
VIEWS.donors = () => {
  const q = S.dq.trim();
  const y = S.year;
  const list = db.donors.slice().sort((a, b) => (!!a.inactive - !!b.inactive) || donorCmp(a, b));
  const tot = id => db.offerings.filter(o => o.donorId === id && yearOf(o.date) === y).reduce((s, o) => s + rowTotal(o), 0);
  const cnt = id => new Set(db.offerings.filter(o => o.donorId === id && yearOf(o.date) === y).map(o => o.date)).size;
  return `<div class="head"><div><h1>헌금자 명단</h1><p>${db.donors.filter(d => !d.anon && !d.inactive).length}명 (무명 제외) · 주민번호 ${db.donors.filter(d => rrnOk(d.rrn)).length}명 입력 · 주민번호는 기부금영수증에만 쓰이고 이 PC에만 저장됩니다</p></div>
  <div class="row"><button class="btn" id="roll">교적관리 시트에서 가져오기</button><button class="btn" id="rrnf">주민번호 엑셀 불러오기</button><button class="btn pri" id="addd">+ 헌금자</button></div></div>
  <div class="toolbar"><input type="search" id="dq" placeholder="이름 검색 (초성 가능)" value="${esc(q)}">${yearSel('dy', y)}<div class="seg"><button data-sort="name" aria-pressed="${(db.settings.sortBy || 'name') === 'name'}">가나다순</button><button data-sort="no" aria-pressed="${db.settings.sortBy === 'no'}">번호순</button></div><span class="hint">이 정렬이 주일 입력 화면·주간 집계표 순서가 됩니다.</span></div>
  <div class="tbl-wrap"><table><thead><tr><th class="num">번호</th><th>이름</th><th>직분</th><th>연락처</th><th>주소</th><th>주민번호</th><th class="num">${y} 주일수</th><th class="num">${y} 합계</th><th></th></tr></thead><tbody>
  ${list.map(d => `<tr class="click" data-id="${d.id}" data-nm="${esc(d.name)}" ${q && !nameMatch(d.name, q) ? 'hidden' : ''}><td class="num">${d.anon ? '' : d.no}</td><td><b>${esc(d.name)}</b>${d.inactive ? ' <span class="pill">숨김</span>' : ''}</td><td>${esc(d.title || '')}</td><td>${esc(d.phone || '')}</td><td style="max-width:260px;overflow:hidden;text-overflow:ellipsis">${esc(d.address || '')}</td><td>${d.rrn ? esc(String(d.rrn).slice(0, 8)) + '******' : ''}</td><td class="num">${cnt(d.id) || ''}</td><td class="num">${won(tot(d.id))}</td><td></td></tr>`).join('')}
  </tbody></table></div>`;
};
function donorForm(d) {
  const isNew = !d; d = d || { no: nextDonorNo(), name: '', title: '', phone: '', address: '', rrn: '', note: '' };
  const has = !isNew && db.offerings.some(o => o.donorId === d.id);
  const m = modal(`<h2>${isNew ? '새 헌금자' : esc(d.name)}</h2>
  <div class="fgrid"><label class="f">번호<input type="number" id="dn" value="${d.anon ? '' : d.no}" ${d.anon ? 'disabled' : ''}></label>
  <label class="f">이름<input type="text" id="dm" value="${esc(d.name)}" ${d.anon ? 'disabled' : ''} autofocus></label>
  <label class="f">직분<input type="text" id="dt" value="${esc(d.title || '')}"></label>
  <label class="f">연락처<input type="text" id="dp" value="${esc(d.phone || '')}"></label></div>
  <label class="f" style="margin-top:12px">주소 (영수증용)<input type="text" id="da" value="${esc(d.address || '')}"></label>
  <div class="fgrid" style="margin-top:12px"><label class="f">주민등록번호 (영수증용·선택)<input type="text" id="dr" value="${esc(d.rrn || '')}" placeholder="000000-0000000" autocomplete="off"></label>
  <label class="f">비고<input type="text" id="dx" value="${esc(d.note || '')}"></label></div>
  ${!isNew && !d.anon ? `<label style="display:flex;gap:8px;margin-top:12px"><input type="checkbox" id="di" ${d.inactive ? 'checked' : ''}> 전체 명단에서 숨기기 (전출·소천 등, 기록은 유지)</label>` : ''}
  <div class="acts">${!isNew && !d.anon ? `<button class="btn" data-merge style="margin-right:auto">다른 이름과 합치기</button>${has ? '' : '<button class="btn danger" data-del>삭제</button>'}` : ''}<button class="btn" data-x>취소</button><button class="btn pri" data-ok>저장</button></div>`);
  m.querySelector('[data-x]').onclick = closeModal;
  m.querySelector('[data-ok]').onclick = () => {
    const name = normName($('#dm', m).value);
    if (!name) return toast('이름을 입력하세요');
    const dup = donorByName(name); if (dup && dup !== d && !d.anon) return toast(`'${name}' 은 이미 명단에 있습니다. 같은 분이면 ‘합치기’를 쓰세요`);
    const v = { title: $('#dt', m).value.trim(), phone: $('#dp', m).value.trim(), address: $('#da', m).value.trim(), rrn: $('#dr', m).value.trim(), note: $('#dx', m).value.trim() };
    if (!d.anon) { v.name = name; v.no = +$('#dn', m).value || nextDonorNo(); }
    if ($('#di', m)) v.inactive = $('#di', m).checked;
    if (isNew) db.donors.push({ id: uid(), ...v }); else Object.assign(d, v);
    logAct(`헌금자 ${isNew ? '추가' : '수정'}: ${name}`); save(); closeModal(); render();
  };
  const del = m.querySelector('[data-del]');
  if (del) del.onclick = async () => { if (await confirmBox(`${d.name} 님을 명단에서 삭제할까요? (헌금 기록 없음)`, '삭제', true)) { db.donors = db.donors.filter(x => x !== d); save(); render(); } };
  const mg = m.querySelector('[data-merge]');
  if (mg) mg.onclick = () => {
    const m2 = modal(`<h2>${esc(d.name)} → 다른 이름으로 합치기</h2><p>오타로 두 번 등록된 경우에 씁니다. <b>${esc(d.name)}</b>의 모든 헌금 기록을 아래 사람에게 옮기고 ${esc(d.name)}은 명단에서 지웁니다.</p>
    <select id="mt" style="width:100%">${db.donors.filter(x => x !== d).sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(x => `<option value="${x.id}">${esc(x.name)}${x.title ? ' ' + esc(x.title) : ''}</option>`).join('')}</select>
    <div class="acts"><button class="btn" data-x>취소</button><button class="btn pri" data-ok>합치기</button></div>`);
    m2.querySelector('[data-x]').onclick = closeModal;
    m2.querySelector('[data-ok]').onclick = async () => {
      const to = donorById($('#mt', m2).value);
      const clash = db.offerings.filter(o => o.donorId === d.id && db.offerings.some(p => p.donorId === to.id && p.date === o.date)).length;
      if (!(await confirmBox(`${d.name} → ${to.name} 로 합칩니다.${clash ? `\n같은 주일에 둘 다 기록이 있는 ${clash}건은 금액을 더합니다.` : ''}`, '합치기'))) return;
      for (const o of db.offerings.filter(o => o.donorId === d.id)) {
        const p = db.offerings.find(p => p.donorId === to.id && p.date === o.date);
        if (p) { for (const [k, v] of Object.entries(o.a)) p.a[k] = (p.a[k] || 0) + v; p.memo = [p.memo, o.memo].filter(Boolean).join(' / '); if (o.keys && o.keys.length) { p.keys = [...(p.keys || []), ...o.keys]; p.ka = { ...(p.ka || {}), ...(o.ka || {}) }; } db.offerings = db.offerings.filter(x => x !== o); }
        else o.donorId = to.id;
      }
      for (const k of ['title', 'phone', 'address', 'rrn']) if (!to[k] && d[k]) to[k] = d[k];
      db.donors = db.donors.filter(x => x !== d);
      logAct(`헌금자 합치기: ${d.name} → ${to.name}`); save(); render(); toast('합쳤습니다');
    };
  };
}
BIND.donors = () => {
  // 화면을 다시 그리지 않고 줄만 숨김 — 한글 조합 중 입력창이 바뀌면 'ㄱㄱ'처럼 글자가 겹쳐 들어감
  const dq = $('#dq'); dq.oninput = () => { S.dq = dq.value; const q = dq.value.trim(); $$('tr[data-nm]').forEach(tr => { tr.hidden = !!q && !nameMatch(tr.dataset.nm, q); }); };
  $('#dy').onchange = e => go('donors', { year: +e.target.value });
  $$('[data-sort]').forEach(b => b.onclick = () => { db.settings.sortBy = b.dataset.sort; save(); render(); });
  $('#addd').onclick = () => donorForm();
  $$('tr[data-id]').forEach(tr => tr.onclick = () => donorForm(donorById(tr.dataset.id)));
  $('#roll').onclick = rollImport;
  $('#rrnf').onclick = async () => {
    const f = await pickFile(['xlsx', 'xls', 'csv']); if (!f) return;
    try { const P = parseWorkbook(readWorkbook(f.bytes), f.name); if (!P.donorInfo.length) return toast('이름과 주민번호 열을 찾지 못했습니다. 머리글에 "이름"(또는 성명)과 "주민번호"가 있어야 합니다', 5000); previewImport(P); }
    catch (e) { toast('파일을 읽지 못했습니다: ' + e.message, 5000); }
  };
};

/* ---------- 교적관리 시트(출석부 웹앱)에서 교인명단 가져오기 — 읽기만 ---------- */
const EXCL = /전출|소천|제명|별세|이명/;
async function fetchRoll() {
  const s = db.settings;
  if (s.rollUrl) {
    if (!API) throw new Error('설치된 프로그램에서만 됩니다');
    const u = s.rollUrl.trim() + (s.rollUrl.includes('?') ? '&' : '?') + 'action=pull&key=' + encodeURIComponent(s.rollKey || '');
    const r = await API.httpBin(u);
    let j; try { j = JSON.parse(new TextDecoder().decode(r.bytes)); } catch { throw new Error('응답을 읽지 못했습니다. 웹앱 URL(…/exec)이 맞는지 확인하세요'); }
    if (!j.ok) throw new Error(j.error === 'key' ? 'KEY가 맞지 않습니다' : (j.error || '오류'));
    return { src: '교적관리 시트', members: (j.data.members || []).filter(m => !m.deleted && m.deleted !== 'Y' && m.deleted !== true) };
  }
  if (API) { const ms = await API.rollMembers(); if (ms) return { src: '이 PC의 출석부 앱', members: ms }; }
  throw new Error('설정 → 교적관리 시트 연결에 출석부 웹앱 URL과 KEY를 넣어 주세요');
}
async function rollImport() {
  let R; try { R = await fetchRoll(); } catch (e) { return toast(e.message, 5000); }
  const ms = R.members.filter(m => normName(m.name));
  const act = ms.filter(m => !EXCL.test(m.status || '')), ex = ms.filter(m => EXCL.test(m.status || ''));
  const F = ['title', 'phone', 'address', 'district'], FL = { title: '직분', phone: '연락처', address: '주소', district: '구역' };
  const find = m => (m.id && db.donors.find(d => d.mid === m.id)) || (() => { const d = donorByName(m.name); return d && (!d.mid || d.mid === m.id) ? d : null; })();
  const add = [], upd = [];
  for (const m of act) {
    const d = find(m);
    if (!d) { add.push(m); continue; }
    const ch = F.filter(k => (m[k] || '') && String(m[k]).trim() !== (d[k] || ''));
    const rename = normName(m.name).replace(/\s/g, '') !== d.name.replace(/\s/g, '');
    if (ch.length || rename || d.mid !== m.id) upd.push({ m, d, ch, rename });
  }
  const sheetIds = new Set(ms.map(m => m.id)), sheetNames = new Set(ms.map(m => normName(m.name).replace(/\s/g, '')));
  const only = db.donors.filter(d => !d.anon && !d.inactive && !(d.mid && sheetIds.has(d.mid)) && !sheetNames.has(d.name.replace(/\s/g, '')));
  const exHere = ex.map(m => find(m)).filter(d => d && !d.inactive);
  const m = modal(`<h2>${esc(R.src)}에서 교인명단 가져오기</h2>
  <p class="muted">교인 ${ms.length}명 (전출·소천·제명 ${ex.length}명 제외). 시트는 읽기만 하고 고치지 않습니다. 헌금 기록은 바뀌지 않습니다.</p>
  <dl class="kv"><dt>새로 추가</dt><dd>${add.length}명 ${add.length ? `<span class="muted">${add.slice(0, 25).map(x => esc(x.name)).join(', ')}${add.length > 25 ? ' …' : ''}</span>` : ''}</dd>
  <dt>정보 갱신</dt><dd>${upd.length}명 ${upd.length ? `<span class="muted">${upd.slice(0, 15).map(u => esc(u.d.name) + (u.rename ? '→' + esc(normName(u.m.name)) : '') + (u.ch.length ? '(' + u.ch.map(k => FL[k]).join('·') + ')' : '')).join(', ')}${upd.length > 15 ? ' …' : ''}</span>` : ''}</dd>
  ${exHere.length ? `<dt>숨김 처리</dt><dd>${exHere.length}명 <span class="muted">${exHere.map(d => esc(d.name)).join(', ')} — 시트에서 전출·소천 등. 기록은 유지</span></dd>` : ''}
  <dt>재정 앱에만 있음</dt><dd>${only.length}명 ${only.length ? `<span class="muted">${only.slice(0, 25).map(d => esc(d.name)).join(', ')}${only.length > 25 ? ' …' : ''} — 단체명·오타·교적 미등록일 수 있습니다. 그대로 둡니다(같은 사람이면 헌금자 명단 ‘합치기’).</span>` : ''}</dd></dl>
  <label style="display:flex;gap:8px;margin-top:12px"><input type="checkbox" id="rovr" checked> 직분·연락처·주소·구역은 시트 값을 따름 (시트에 값이 있을 때만)</label>
  <label style="display:flex;gap:8px;margin-top:6px"><input type="checkbox" id="radd" checked> 시트에만 있는 교인을 헌금자 명단에 추가</label>
  <div class="acts"><button class="btn" data-x>취소</button><button class="btn pri" data-ok>가져오기</button></div>`, { wide: true });
  m.querySelector('[data-x]').onclick = closeModal;
  m.querySelector('[data-ok]').onclick = () => {
    const ovr = $('#rovr', m).checked, doAdd = $('#radd', m).checked;
    let nA = 0, nU = 0;
    if (doAdd) for (const x of add) { const d = ensureDonor(x.name); d.mid = x.id; for (const k of F) if (x[k]) d[k] = String(x[k]).trim(); nA++; }
    for (const u of upd) {
      u.d.mid = u.m.id;
      if (u.rename && !donorByName(u.m.name)) u.d.name = normName(u.m.name);
      for (const k of u.ch) if (ovr || !u.d[k]) u.d[k] = String(u.m[k]).trim();
      nU++;
    }
    for (const d of exHere) d.inactive = true;
    db.settings.rollSyncedAt = now();
    logAct(`교인명단 가져오기(${R.src}): 추가 ${nA}, 갱신 ${nU}, 숨김 ${exHere.length}`); save(true); closeModal(); render();
    toast(`추가 ${nA}명 · 갱신 ${nU}명${exHere.length ? ` · 숨김 ${exHere.length}명` : ''}`);
  };
}

/* ======================= 가져오기 ======================= */
VIEWS.import = () => {
  const sid = db.settings.sheetId;
  return `<div class="head"><div><h1>가져오기</h1><p>총입출금내역 · 수입/지출예산 파일을 그대로 올리면 됩니다</p></div></div>
  <div class="grid2">
  <div class="panel"><h2>① 엑셀 파일 올리기</h2>
    <p class="muted">아래 파일을 알아서 구분해 읽습니다. 여러 번 올려도 같은 거래는 한 번만 들어갑니다.</p>
    <ul style="margin:0 0 10px;padding-left:18px;line-height:1.8"><li><b>총입출금내역관리</b> — 거래일시·내용·출금·입금·지출계정과목·비고·헌금종류·Month·현금입금</li><li><b>수입예산</b>(관·항·목·예산액, 전년 이월) · <b>지출예산</b>(순위·항목·년간 예산)</li><li>앱 기본 양식 · 구글 헌금집계 주간 블록</li></ul>
    <div class="row"><button class="btn pri" data-file="any">파일 올리기</button><button class="btn" id="tpl">빈 양식 받기</button></div>
    <p class="hint">오프라인 헌금은 주(Month) 단위로 바꿀지 고르고, 온라인 입금·지출·현금입금은 거래일시+내용+금액이 같으면 건너뜁니다. 큰 파일(그림 포함)은 읽는 데 20초쯤 걸립니다.</p></div>
  <div class="panel"><h2>② 구글 헌금집계 시트</h2>
    <p class="muted">주간 블록(‘2026년 9월 6일 성현교회 헌금집계’ 제목 + 번호·이름·주정헌금… 머리글)을 모두 읽어 날짜별로 가져옵니다. 시트에는 쓰지 않습니다(읽기만).</p>
    <label class="f">시트 ID 또는 주소<input type="text" id="sid" value="${esc(sid)}"></label>
    <div class="row" style="margin-top:10px"><button class="btn pri" id="gs">시트에서 가져오기</button><button class="btn" data-file="blk">내려받은 엑셀 올리기</button></div>
    <p class="hint">‘시트에서 가져오기’는 시트 공유가 ‘링크가 있는 모든 사용자 – 뷰어’일 때만 됩니다. 시트를 비공개로 두려면 구글시트에서 <b>파일 → 다운로드 → Microsoft Excel(.xlsx)</b> 로 받은 뒤 ‘내려받은 엑셀 올리기’를 쓰세요. 헌금 금액이 담긴 시트이므로 비공개를 권합니다.</p></div>
  </div>
  <div class="panel"><h2>최근 작업</h2>${db.log.length ? `<table><tbody>${db.log.slice(0, 12).map(l => `<tr><td class="muted">${new Date(l.t).toLocaleString('ko-KR')}</td><td style="white-space:normal">${esc(l.text)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">기록 없음</div>'}</div>`;
};
function previewImport(P) {
  const dates = importPreview(P);
  const unk = unknownAccounts(P);
  const nd = new Set(P.offerings.map(o => o.name.replace(/\s/g, '')).filter(n => !donorByName(n) && !/^무명/.test(n)));
  P.donors.forEach(d => { if (!donorByName(d.name)) nd.add(d.name.replace(/\s/g, '')); });
  const st = { new: '<span class="pill ok">새 주일</span>', same: '<span class="pill">같음</span>', diff: '<span class="pill warn">다름</span>', fix: '<span class="pill info">정리</span>' };
  const m = modal(`<h2>가져오기 미리보기</h2><p class="muted">${esc(P.src)} — ${P.sheets.map(esc).join(' · ') || '읽은 내용 없음'}</p>
  ${P.warn.length ? `<div class="banner warn" style="display:block"><b>확인할 점</b><ul style="margin:6px 0 0;padding-left:18px">${[...new Set(P.warn)].slice(0, 12).map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
  ${nd.size ? `<p>새 헌금자 <b>${nd.size}명</b>이 명단에 추가됩니다: <span class="muted">${[...nd].slice(0, 30).map(esc).join(', ')}${nd.size > 30 ? ' …' : ''}</span></p>` : ''}
  ${P.accounts ? `<label style="display:flex;gap:8px;margin:8px 0"><input type="checkbox" id="ia"> 파일의 계정과목(${P.accounts.length}개)으로 앱 계정과목 바꾸기</label>` : ''}
  ${P.expAccounts ? `<label style="display:flex;gap:8px;margin:8px 0"><input type="checkbox" id="iea" checked> 지출 항목을 이 예산서의 ${P.expAccounts.length}개 항목·순위·비고로 맞추기</label>` : ''}
  ${unk.length ? `<p><span class="pill bad">계정과목에 없는 이름</span> ${unk.map(esc).join(', ')} — 가져온 뒤 설정에서 계정을 추가하거나 기록을 고치세요.</p>` : ''}
  ${dates.length ? `<div class="tbl-wrap" style="max-height:42vh"><table><thead><tr><th><input type="checkbox" id="iall"></th><th>주일</th><th class="num">파일 인원</th><th class="num">파일 합계</th><th class="num">앱 현재</th><th>상태</th></tr></thead><tbody>
  ${dates.map((g, i) => `<tr><td><input type="checkbox" data-i="${i}" ${g.pick ? 'checked' : ''}></td><td>${dotDate(g.date)}${isSunday(g.date) ? '' : ' <span class="pill">주일 아님</span>'}</td><td class="num">${g.n}</td><td class="num">${won0(g.sum)}</td><td class="num muted">${g.curN ? won0(g.curSum) + ` (${g.curN}명)` : '-'}</td><td>${st[g.status]}</td></tr>
  ${g.status === 'diff' ? `<tr><td></td><td colspan="5" style="white-space:normal;font-size:13px;color:var(--muted);padding-top:0">${g.changes.slice(0, 12).map(c => `${esc(c.name)} ${esc(c.kind)} <b style="color:var(--fg)">${c.from ? won0(c.from) : '없음'} → ${c.to ? won0(c.to) : '없음'}</b>`).join(' · ')}${g.changes.length > 12 ? ` 외 ${g.changes.length - 12}건` : ''}</td></tr>` : ''}`).join('')}</tbody></table></div>
  ${dates.some(g => g.status === 'diff') ? `<div class="row" style="margin-top:8px"><button class="btn sm" id="ipickdiff">‘다름’ 주일 모두 선택 (엑셀 내용으로 맞추기)</button><span class="hint">주일 헌금 입력 화면에서 직접 고친 주일이 있으면 그 주일은 빼고 고르세요.</span></div>` : ''}
  ${dates.some(g => g.status === 'fix') ? `<p class="hint"><span class="pill info">정리</span> 주차·회비·찬조 같은 현금 헌금이 ‘기타수입’에 따로 들어가 있던 주일입니다. 금액은 같고, 주일 헌금 쪽으로 옮겨 집계표·현금입금 대조에 포함합니다(기본 체크).</p>` : ''}
  <p class="hint">‘다름’은 앱에서 이미 입력·수정한 주일입니다. 기본으로 체크하지 않았습니다 — 체크하면 그 주일은 파일 내용으로 바뀝니다.</p>` : (P.donorInfo.length ? '' : '<p class="muted">헌금 내역 없음</p>')}
  ${P.donorInfo.length ? (() => { const miss = P.donorInfo.filter(d => { const x = donorByName(d.name); return !x || x.anon; }); return `<p>주민번호 <b>${P.donorInfo.length - miss.length}명</b>을 헌금자 명단에 채웁니다.${miss.length ? ` <span class="pill warn">명단에 없는 이름 ${miss.length}명</span> <span class="muted">${miss.slice(0, 20).map(d => esc(d.name)).join(', ')}${miss.length > 20 ? ' …' : ''} — 새로 추가하지 않습니다. 헌금자 명단에서 이름을 맞춘 뒤 다시 올리세요.</span>` : ''}</p>`; })() : ''}
  ${(() => { const c = importNewCounts(P); return `<p>새로 들어올 것: ${c.upd ? `<span class="pill info">엑셀에서 고친 거래 ${c.upd}건 반영</span> ` : ''}온라인 헌금 <b>${c.on}</b>건 · 기타수입 <b>${c.inc}</b>건 · 지출 <b>${c.exp}</b>건 · 현금입금 <b>${c.dep}</b>건${c.del ? ` · <span class="pill">앱에서 지운 거래 ${c.del}건은 넣지 않음</span>` : ''}${P.budgets.length ? ` · 예산 <b>${P.budgets.length}</b>항목(${[...new Set(P.budgets.map(b => b.year))].join(', ')}년)` : ''}${P.donors.length ? ` · 헌금자 정보 ${P.donors.length}명` : ''}${P.bank ? ` · 통장 잔액 ${won0(P.bank.balance)} (${esc(P.bank.time)})` : ''}</p>`; })()}
  ${(() => { const L = staleList(P); return L.length ? `<div class="banner warn" style="display:block"><label><input type="checkbox" id="istale" checked> <b>엑셀에서 없어진 거래 ${L.length}건을 앱에서도 지웁니다</b></label> <span class="muted">— 파일이 담은 기간 안에서 엑셀에서 지우거나 입금↔현금입금처럼 바꾼 줄</span>
    <div style="font-size:13px;margin-top:6px">${L.slice(0, 15).map(x => `${esc(x.time.slice(5, 16).replace('-', '.'))} ${esc(x.type)} ${esc(x.memo)}${x.who && x.who !== x.memo ? ` (${esc(x.who)})` : ''} <b>${won0(x.amount)}</b>`).join(' · ')}${L.length > 15 ? ` 외 ${L.length - 15}건` : ''}</div></div>` : ''; })()}
  <div class="acts"><button class="btn" data-x>취소</button><button class="btn pri" data-ok>가져오기</button></div>`, { wide: true });
  const all = $('#iall', m); if (all) all.onchange = () => $$('[data-i]', m).forEach(c => { c.checked = all.checked; dates[+c.dataset.i].pick = c.checked; });
  $$('[data-i]', m).forEach(c => c.onchange = () => dates[+c.dataset.i].pick = c.checked);
  const pd = $('#ipickdiff', m); if (pd) pd.onclick = () => $$('[data-i]', m).forEach(c => { if (dates[+c.dataset.i].status === 'diff') { c.checked = true; dates[+c.dataset.i].pick = true; } });
  m.querySelector('[data-x]').onclick = closeModal;
  m.querySelector('[data-ok]').onclick = () => {
    const r = applyImport(P, dates, { accounts: $('#ia', m) ? $('#ia', m).checked : false, expAccounts: $('#iea', m) ? $('#iea', m).checked : false, removeStale: $('#istale', m) ? $('#istale', m).checked : true });
    closeModal(); render();
    modal(`<h2>가져왔습니다</h2><dl class="kv">${r.rrn || r.rrnMiss.length ? `<dt>주민번호</dt><dd>${r.rrn}명 입력${r.rrnMiss.length ? ` · 명단에 없는 이름 ${r.rrnMiss.length}명: ${r.rrnMiss.map(esc).join(', ')}` : ''}</dd>` : ''}<dt>오프라인 헌금</dt><dd>${r.dates}주 (${r.rows}줄)${r.fixed ? ` · 기타수입에서 옮김 ${r.fixed}건` : ''}</dd><dt>온라인 헌금</dt><dd>${r.online}건</dd>${r.updated ? `<dt>고친 거래</dt><dd>${r.updated}건</dd>` : ''}<dt>현금입금</dt><dd>${r.deposits}건</dd><dt>새 헌금자</dt><dd>${r.newDonors}명</dd><dt>헌금자 정보</dt><dd>${r.donors}명</dd><dt>기타수입</dt><dd>${r.incomes}건</dd><dt>지출</dt><dd>${r.expenses}건</dd>${r.skippedDel ? `<dt>지운 거래</dt><dd>${r.skippedDel}건 건너뜀</dd>` : ''}${r.removed ? `<dt>엑셀에서 없어진 거래</dt><dd>${r.removed}건 앱에서도 지움</dd>` : ''}<dt>예산</dt><dd>${r.budgets}항목</dd></dl>
    <div class="acts"><button class="btn" data-x>닫기</button><button class="btn pri" data-h>현황 보기</button></div>`);
    $('[data-x]').onclick = closeModal; $('[data-h]').onclick = () => { closeModal(); go('home'); };
  };
}
const sheetIdOf = s => { const m = String(s).match(/\/d\/([\w-]{20,})/); return m ? m[1] : String(s).trim(); };
BIND.import = () => {
  $('#tpl').onclick = async () => { if (API) await API.saveTemplate(); else { const a = document.createElement('a'); a.href = 'assets/성현교회재정_기본양식.xlsx'; a.download = '성현교회재정_기본양식.xlsx'; a.click(); } };
  $$('[data-file]').forEach(b => b.onclick = async () => {
    const f = await pickFile(['xlsx', 'xls', 'csv']);
    if (!f) return;
    modal(`<h2>읽는 중…</h2><p>${esc(f.name)} (${(f.bytes.length / 1048576).toFixed(1)}MB)</p><p class="hint">그림이 들어 있는 큰 파일은 20초쯤 걸립니다.</p>`, { sticky: true });
    await new Promise(r => setTimeout(r, 60));
    try { const P = parseWorkbook(readWorkbook(f.bytes), f.name); closeModal(); previewImport(P); }
    catch (e) { closeModal(); toast('파일을 읽지 못했습니다: ' + e.message, 5000); }
  });
  $('#sid').onchange = e => { db.settings.sheetId = sheetIdOf(e.target.value); e.target.value = db.settings.sheetId; save(); };
  $('#gs').onclick = async () => {
    const id = sheetIdOf($('#sid').value); if (!id) return toast('시트 ID를 입력하세요');
    db.settings.sheetId = id; save();
    if (!API) return toast('설치된 프로그램에서만 됩니다. 브라우저에서는 ‘내려받은 엑셀 올리기’를 쓰세요');
    const b = $('#gs'); b.disabled = true; b.textContent = '받는 중…';
    try {
      const r = await API.httpBin(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
      if (!r.ok || /html/.test(r.type)) throw new Error('시트를 받을 수 없습니다. 공유가 비공개이면 파일 → 다운로드 → .xlsx 로 받아 ‘내려받은 엑셀 올리기’를 쓰세요.');
      previewImport(parseWorkbook(readWorkbook(r.bytes), '구글 헌금집계 시트'));
    } catch (e) { modal(`<h2>가져오지 못했습니다</h2><p>${esc(e.message)}</p><div class="acts"><button class="btn pri" data-x>닫기</button></div>`); $('[data-x]').onclick = closeModal; }
    finally { b.disabled = false; b.textContent = '시트에서 가져오기'; }
  };
};

/* ======================= 설정 ======================= */
VIEWS.settings = () => {
  const s = db.settings, ch = s.church, rc = s.receipt;
  const used = h => db.incomes.some(x => x.acc === h) || db.expenses.some(x => x.acc === h) || Object.values(db.budgets).some(B => B[h]);
  return `<div class="head"><div><h1>설정</h1><p>교회 정보 · 헌금 항목 · 계정과목 · 잠금 · 백업</p></div></div>
  <div class="grid2">
  <div class="panel"><h2>교회 정보 (보고서·영수증)</h2><div class="fgrid">
    <label class="f">교회 이름<input type="text" data-ch="name" value="${esc(ch.name)}"></label>
    <label class="f">짧은 이름<input type="text" data-ch="short" value="${esc(ch.short)}"></label>
    <label class="f">고유번호(사업자등록번호)<input type="text" data-ch="regNo" value="${esc(ch.regNo)}" placeholder="000-00-00000"></label>
    <label class="f">대표자<input type="text" data-ch="rep" value="${esc(ch.rep)}"></label>
    <label class="f">재정부장<input type="text" data-ch="treasurer" value="${esc(ch.treasurer)}"></label>
    <label class="f">주간 집계 담당자<input type="text" id="cnt" value="${esc(s.counters)}"></label></div>
    <label class="f" style="margin-top:12px">소재지<input type="text" data-ch="address" value="${esc(ch.address)}"></label></div>
  <div class="panel"><h2>기부금영수증</h2><div class="fgrid">
    <label class="f">기부 코드<input type="text" data-rc="code" value="${esc(rc.code)}"></label>
    <label class="f">구분<input type="text" data-rc="kind" value="${esc(rc.kind)}"></label>
    <label class="f">수령인 서명자(비우면 대표자)<input type="text" data-rc="issuer" value="${esc(rc.issuer)}"></label></div>
    <label class="f" style="margin-top:12px">기부금단체 근거법령<input type="text" data-rc="law" value="${esc(rc.law)}"></label>
    <p class="hint">기본값: 종교단체 기부금 코드 41. 근거법령 문구는 관할 세무서·노회 안내에 맞게 고치세요.</p></div>
  </div>
  <div class="panel"><h2>주일 헌금 입력 화면의 열 (헌금종류)</h2>
    <div class="row">${cols().map(c => `<span class="pill info" style="font-size:14px;padding:4px 10px">${esc(c)} <button class="btn link" data-dc="${esc(c)}" title="열에서 빼기">×</button></span>`).join('')}
    <input type="text" id="nc" placeholder="헌금종류 (예: 주차)" style="width:160px"><button class="btn sm" id="ncb">열 추가</button></div>
    <p class="hint">입력 화면과 주간 집계표에 보이는 열입니다. 빼도 기록은 지워지지 않고, 그 주에 기록이 있으면 자동으로 보입니다.</p></div>
  <div class="panel"><h2>헌금종류 연결 · 계정과목</h2>
    <p class="muted" style="margin-top:-4px">총입출금의 ‘헌금종류’ 값이 어느 목으로 들어갈지 정합니다. 쉼표로 여러 개. 영수증 = 기부금영수증에 넣는 수입.</p>
    ${(() => { const kinds = [...new Set(db.offerings.flatMap(o => Object.keys(o.a)).concat(db.incomes.map(x => x.kind)).filter(Boolean))].filter(k => !accOfKind(k)); return kinds.length ? `<p><span class="pill bad">연결 안 된 헌금종류</span> ${kinds.map(esc).join(', ')}</p>` : '<p><span class="pill ok">모든 헌금종류가 연결됨</span></p>'; })()}
    <div class="tbl-wrap" style="max-height:480px"><table><thead><tr><th>구분</th><th>관</th><th>항</th><th>목 / 항목</th><th>번호</th><th>연결된 헌금종류 · 비고</th><th>영수증</th><th></th></tr></thead><tbody>
    ${db.accounts.map(a => `<tr><td>${a.type === '수입' ? '<span class="pill ok">수입</span>' : '<span class="pill bad">지출</span>'}</td>
      <td><input type="text" data-af="gwan" data-id="${a.id}" value="${esc(a.gwan)}" style="width:100px"></td>
      <td><input type="text" data-af="mid" data-id="${a.id}" value="${esc(a.mid)}" style="width:100px"></td>
      <td>${esc(a.hang)}</td><td><input type="text" data-af="code" data-id="${a.id}" value="${esc(a.code)}" style="width:52px"></td>
      <td>${a.type === '수입' && !isCarry(a) ? `<input type="text" data-af="kinds" data-id="${a.id}" value="${esc(a.kinds.join(', '))}" style="width:240px">` : `<input type="text" data-af="note" data-id="${a.id}" value="${esc(a.note || '')}" style="width:240px">`}</td>
      <td>${a.type === '수입' ? `<input type="checkbox" data-ar="${a.id}" ${a.receipt ? 'checked' : ''}>` : ''}</td>
      <td>${used(a.hang) || (a.kinds || []).length ? '' : `<button class="btn sm danger" data-da="${a.id}">삭제</button>`}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="row" style="margin-top:10px"><select id="nat"><option>지출</option><option>수입</option></select><input type="text" id="nag" placeholder="관 (수입만)" style="width:120px"><input type="text" id="nam" placeholder="항 (수입만)" style="width:120px"><input type="text" id="nah" placeholder="목 / 항목 이름" style="width:170px"><input type="text" id="nacode" placeholder="번호" style="width:60px"><button class="btn" id="nab">계정 추가</button></div>
    <p class="hint">지출은 순위 번호 순서로, 수입은 관·항·목 순서로 예산서와 보고서에 나옵니다. 관이 ‘이월금’인 계정은 전년도 이월금으로 처리됩니다.</p></div>
  <div class="panel" style="margin-top:16px"><h2>교적관리 시트 연결 (교인명단 읽기 전용)</h2>
    <p class="muted" style="margin-top:-4px">출석부 앱 <b>설정·데이터</b> 화면의 웹앱 URL과 KEY를 그대로 붙여넣으세요. 재정 앱은 교인명단을 <b>읽기만</b> 하고, 헌금·주민번호는 시트로 보내지 않습니다.</p>
    <div class="fgrid"><label class="f">웹앱 URL (…/exec)<input type="text" id="rurl" value="${esc(s.rollUrl || '')}" placeholder="https://script.google.com/macros/s/…/exec"></label>
    <label class="f">KEY<input type="password" id="rkey" value="${esc(s.rollKey || '')}" autocomplete="off"></label></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="rtest">연결 확인</button><span class="hint" id="rmsg">${s.rollSyncedAt ? '마지막 가져오기 ' + new Date(s.rollSyncedAt).toLocaleString('ko-KR') : ''}</span></div></div>
  <div class="grid2" style="margin-top:16px">
  <div class="panel"><h2>프로그램 잠금</h2><p class="muted">${s.lockHash ? '켜져 있음 — 프로그램을 켤 때 비밀번호를 묻습니다.' : '꺼져 있음'}</p>
    <div class="row"><input type="password" id="lp" placeholder="새 비밀번호" autocomplete="new-password"><button class="btn" id="lpb">${s.lockHash ? '바꾸기' : '켜기'}</button>${s.lockHash ? '<button class="btn danger" id="lpo">끄기</button>' : ''}</div>
    <p class="hint">비밀번호를 잊으면 데이터 폴더의 data.json에서 lockHash 값을 지우면 됩니다(담당자만).</p></div>
  <div class="panel" style="grid-column:1/-1"><h2>지운 거래 <span class="muted" style="font-weight:400;font-size:14px">${(db.deleted || []).length}건</span></h2>
    <p class="muted">앱에서 삭제한 총입출금 거래입니다. 엑셀에 그 줄이 남아 있어도 다시 들어오지 않습니다. ‘되살리기’ 하면 다음에 총입출금을 올릴 때 다시 들어옵니다.</p>
    ${(db.deleted || []).length ? `<div class="tbl-wrap" style="max-height:260px"><table><thead><tr><th>구분</th><th>주(Month)</th><th>거래일시</th><th>계정</th><th class="num">금액</th><th>내용</th><th></th></tr></thead><tbody>
    ${db.deleted.map((x, i) => `<tr><td>${esc(x.what)}</td><td>${dotDate(x.date)}</td><td class="muted">${esc((x.time || '').slice(5, 16).replace('-', '.'))}</td><td>${esc(x.acc)}</td><td class="num">${won0(x.amount)}</td><td>${esc(x.memo)}</td><td><button class="btn sm" data-undel="${i}">되살리기</button></td></tr>`).join('')}</tbody></table></div>` : ''}</div>
  <div class="panel"><h2>백업 · 복원</h2><p class="muted" id="ddir">데이터는 문서\\성현교회재정\\data.json 에 저장되고, 하루 한 번 백업 폴더에 사본이 남습니다(90일).</p>
    <div class="row"><button class="btn" id="bk">백업 파일 저장</button><button class="btn" id="rs">백업에서 복원</button></div>
    <p class="hint">백업 파일에는 헌금 금액과 주민번호가 들어 있습니다. USB 등에 보관할 때 주의하세요.</p></div>
  </div>`;
};
BIND.settings = () => {
  const s = db.settings;
  $$('[data-undel]').forEach(b => b.onclick = () => { const x = db.deleted.splice(+b.dataset.undel, 1)[0]; logAct(`지운 거래 되살림: ${x.date} ${x.acc} ${won0(x.amount)}`); save(); render(); toast('다음 총입출금 올리기 때 다시 들어옵니다'); });
  $$('[data-ch]').forEach(i => i.onchange = () => { s.church[i.dataset.ch] = i.value.trim(); save(); renderNav(); });
  $$('[data-rc]').forEach(i => i.onchange = () => { s.receipt[i.dataset.rc] = i.value.trim(); save(); });
  $('#cnt').onchange = e => { s.counters = e.target.value.trim(); save(); };
  $('#ncb').onclick = () => {
    const c = normKind($('#nc').value); if (!c) return;
    if (cols().includes(c)) return toast('이미 있는 열입니다');
    cols().push(c); if (!accOfKind(c)) toast(`‘${c}’는 아직 어느 목에도 연결되지 않았습니다. 아래 표에서 연결하세요`, 4000);
    logAct(`입력 열 추가: ${c}`); save(); render();
  };
  $$('[data-dc]').forEach(b => b.onclick = () => { s.offeringCols = cols().filter(x => x !== b.dataset.dc); save(); render(); });
  $$('[data-af]').forEach(i => i.onchange = () => {
    const a = db.accounts.find(x => x.id === i.dataset.id), f = i.dataset.af;
    if (f === 'kinds') {
      const ks = [...new Set(i.value.split(',').map(normKind).filter(Boolean))];
      const clash = ks.filter(k => db.accounts.some(o => o !== a && o.kinds.includes(k)));
      if (clash.length) { toast(`‘${clash.join(', ')}’는 이미 다른 목에 연결되어 있어 그쪽에서 뺐습니다`, 4000); for (const o of db.accounts) if (o !== a) o.kinds = o.kinds.filter(k => !clash.includes(k)); }
      a.kinds = ks;
    } else a[f] = i.value.trim();
    logAct(`계정과목 수정: ${a.hang} ${f}`); save(); render();
  });
  $$('[data-ar]').forEach(i => i.onchange = () => { db.accounts.find(x => x.id === i.dataset.ar).receipt = i.checked; save(); });
  $$('[data-da]').forEach(b => b.onclick = async () => { const a = db.accounts.find(x => x.id === b.dataset.da); if (await confirmBox(`${a.hang} 계정을 삭제할까요?`, '삭제', true)) { db.accounts = db.accounts.filter(x => x !== a); save(); render(); } });
  $('#nab').onclick = () => {
    const type = $('#nat').value, gwan = type === '지출' ? '' : $('#nag').value.trim(), mid = type === '지출' ? '' : $('#nam').value.trim(), hang = $('#nah').value.trim(), code = $('#nacode').value.trim();
    if (!hang || (type === '수입' && !gwan)) return toast(type === '수입' ? '관과 목 이름을 입력하세요' : '항목 이름을 입력하세요');
    if (accByHang(hang)) return toast('같은 이름의 계정이 있습니다');
    let at = -1; db.accounts.forEach((a, i) => { if (a.type === type && (type === '지출' || a.gwan === gwan)) at = i; });
    if (at < 0) db.accounts.forEach((a, i) => { if (a.type === type && !isCarry(a)) at = i; });
    const nc = type === '지출' && !code ? String(db.accounts.filter(a => a.type === '지출').length + 1) : code;
    db.accounts.splice(at + 1, 0, { id: uid(), type, gwan, mid, code: nc, hang, kinds: [], receipt: type === '수입' && /^[123]\./.test(gwan), note: '' });
    save(); render();
  };
  $('#rurl').onchange = e => { s.rollUrl = e.target.value.trim(); save(); };
  $('#rkey').onchange = e => { s.rollKey = e.target.value.trim(); save(); };
  $('#rtest').onclick = async () => {
    s.rollUrl = $('#rurl').value.trim(); s.rollKey = $('#rkey').value.trim(); save();
    const el = $('#rmsg'); el.textContent = '확인 중…';
    try { const R = await fetchRoll(); el.textContent = `연결됨 — 교인 ${R.members.length}명. 헌금자 명단에서 ‘교적관리 시트에서 가져오기’를 누르세요.`; }
    catch (e) { el.textContent = '연결 실패: ' + e.message; }
  };
  $('#lpb').onclick = async () => { const p = $('#lp').value; if (p.length < 4) return toast('4자 이상 입력하세요'); s.lockHash = await sha256(p); save(true); toast('잠금 비밀번호를 설정했습니다'); render(); };
  const lpo = $('#lpo'); if (lpo) lpo.onclick = async () => { if (await confirmBox('프로그램 잠금을 끌까요?', '끄기')) { s.lockHash = ''; save(true); render(); } };
  $('#bk').onclick = () => saveBytes(`성현교회재정_백업_${today()}.json`, new TextEncoder().encode(JSON.stringify(db, null, 1)));
  $('#rs').onclick = async () => {
    const f = await pickFile(['json']); if (!f) return;
    let d; try { d = JSON.parse(new TextDecoder().decode(f.bytes)); } catch { return toast('백업 파일이 아닙니다'); }
    if (!d || !Array.isArray(d.offerings)) return toast('백업 파일이 아닙니다');
    if (!(await confirmBox(`${f.name}\n헌금 ${d.offerings.length}줄 · 지출 ${(d.expenses || []).length}건\n\n지금 데이터를 이 백업으로 바꿀까요? (지금 데이터는 오늘 백업에 남아 있습니다)`, '복원', true))) return;
    db = migrate(d); logAct(`백업 복원: ${f.name}`); save(true); render(); toast('복원했습니다');
  };
  if (API) API.appInfo().then(i => { const el = $('#ddir'); if (el) el.textContent = `데이터 위치: ${i.dataDir}\\data.json — 하루 한 번 백업 폴더에 사본이 남습니다(90일). 버전 v${i.version}`; });
};

/* ======================= 잠금 · 시작 ======================= */
function showLock() {
  const L = document.createElement('div'); L.className = 'lock';
  L.innerHTML = `<div class="panel"><h1>${esc(db.settings.church.short)} 재정</h1><p class="muted">비밀번호를 입력하세요</p>
  <form class="row" style="justify-content:center"><input type="password" id="lkp" autocomplete="current-password" style="flex:1"><button class="btn pri">열기</button></form><p class="hint" id="lkm"></p></div>`;
  document.body.appendChild(L);
  $('#lkp', L).focus();
  $('form', L).onsubmit = async e => {
    e.preventDefault();
    if (await sha256($('#lkp', L).value) === db.settings.lockHash) L.remove();
    else { $('#lkm', L).textContent = '비밀번호가 맞지 않습니다'; $('#lkp', L).select(); }
  };
}
(async function start() {
  await loadDB();
  render();
  if (db.settings.lockHash) showLock();
  if (API) API.onUpdate(s => {
    S.upd = s.state === 'downloading' ? `업데이트 받는 중${s.percent ? ' ' + s.percent + '%' : ''}` : s.state === 'ready' ? `v${s.version} 준비됨` : '';
    const f = $('#nav .foot span:last-child'); if (f) f.textContent = S.upd;
  });
})();
