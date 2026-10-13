// 성현교회 재정 — Electron 메인 프로세스
// 헌금·재정 데이터는 이 PC(문서\성현교회재정)에만 저장합니다. 외부로 보내는 기능은 없습니다.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch { /* 개발 실행 시 없어도 됨 */ }

let win;
const dataDir = () => path.join(app.getPath('documents'), '성현교회재정');
const dataFile = () => path.join(dataDir(), 'data.json');
const backupDir = () => path.join(dataDir(), '백업');
const ensure = () => fs.mkdirSync(backupDir(), { recursive: true });
const rollFile = () => path.join(app.getPath('documents'), '성현교회출석부', 'data.json');
const TEMPLATE = () => path.join(__dirname, 'renderer', 'assets', '성현교회재정_기본양식.xlsx');

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 920, minWidth: 960, minHeight: 620,
    title: '성현교회 재정',
    backgroundColor: '#f3f2ee',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '파일', submenu: [
      { label: '데이터 폴더 열기', click: () => { ensure(); shell.openPath(dataDir()); } },
      { label: '업데이트 확인', click: () => checkUpdate(true) },
      { label: `버전 정보 (v${app.getVersion()})`, click: () => dialog.showMessageBox(win, { message: `성현교회 재정 v${app.getVersion()}`, detail: `데이터 위치: ${dataDir()}` }) },
      { type: 'separator' }, { role: 'quit', label: '종료' } ] },
    { label: '보기', submenu: [
      { role: 'reload', label: '새로고침' }, { role: 'togglefullscreen', label: '전체 화면 (F11)' },
      { role: 'zoomIn', label: '크게' }, { role: 'zoomOut', label: '작게' }, { role: 'resetZoom', label: '원래 크기' },
      { type: 'separator' }, { role: 'toggleDevTools', label: '개발자 도구' } ] }
  ]));
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

ipcMain.handle('data:load', () => {
  ensure();
  try { return JSON.parse(fs.readFileSync(dataFile(), 'utf8')); } catch { return null; }
});

ipcMain.handle('data:save', (e, db) => {
  ensure();
  const tmp = dataFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, dataFile());
  // 하루 한 번 자동 백업, 최근 90개 보관
  const day = new Date().toISOString().slice(0, 10);
  const b = path.join(backupDir(), `data_${day}.json`);
  if (!fs.existsSync(b)) {
    fs.copyFileSync(dataFile(), b);
    const old = fs.readdirSync(backupDir()).filter(f => /^data_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    old.slice(0, Math.max(0, old.length - 90)).forEach(f => fs.unlinkSync(path.join(backupDir(), f)));
  }
  return true;
});

async function askPath(name) {
  const ext = path.extname(name).slice(1) || 'dat';
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), name),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  });
  return r.canceled ? null : r.filePath;
}

ipcMain.handle('file:save', async (e, name, bytes) => {
  const p = await askPath(name);
  if (!p) return false;
  fs.writeFileSync(p, Buffer.from(bytes));
  shell.showItemInFolder(p);
  return true;
});

ipcMain.handle('file:open', async (e, exts) => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: '파일', extensions: exts || ['xlsx', 'xls', 'csv', 'json'] }]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  return { name: path.basename(p), bytes: new Uint8Array(fs.readFileSync(p)) };
});

ipcMain.handle('template:save', async () => {
  const p = await askPath('성현교회재정_기본양식.xlsx');
  if (!p) return false;
  fs.copyFileSync(TEMPLATE(), p);
  shell.openPath(p);
  return true;
});

ipcMain.handle('pdf:save', async (e, name, html, opt) => {
  const p = await askPath(name);
  if (!p) return false;
  const tmp = path.join(os.tmpdir(), `seonghyeon_fin_${Date.now()}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  const w = new BrowserWindow({ show: false });
  try {
    await w.loadFile(tmp);
    const pdf = await w.webContents.printToPDF({ pageSize: 'A4', landscape: !!(opt && opt.landscape), printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(p, pdf);
  } finally { w.destroy(); fs.unlink(tmp, () => {}); }
  shell.openPath(p);
  return true;
});

// 구글 헌금집계 시트를 xlsx로 받아오기 (읽기만)
ipcMain.handle('http:bin', async (e, url) => {
  const r = await fetch(url, { redirect: 'follow' });
  const type = r.headers.get('content-type') || '';
  const buf = new Uint8Array(await r.arrayBuffer());
  return { ok: r.ok, status: r.status, type, bytes: buf };
});

// 같은 PC의 출석부 앱 교인명단 (이름·직분·연락처·주소만)
ipcMain.handle('roll:members', () => {
  try {
    const d = JSON.parse(fs.readFileSync(rollFile(), 'utf8'));
    return (d.members || []).filter(m => !m.deleted && m.updatedAt !== 1)
      .map(m => ({ name: m.name, title: m.title || '', phone: m.phone || '', address: m.address || '', status: m.status || '' }));
  } catch { return null; }
});

/* ---------- 자동 업데이트 (GitHub Releases) ---------- */
let manualCheck = false;
const sendUpdate = (state, info) => { if (win && !win.isDestroyed()) win.webContents.send('update', { state, ...(info || {}) }); };
function checkUpdate(manual) {
  if (!autoUpdater || !app.isPackaged) {
    if (manual) dialog.showMessageBox(win, { message: '설치된 프로그램에서만 업데이트를 확인할 수 있습니다.' });
    return;
  }
  manualCheck = !!manual;
  autoUpdater.checkForUpdates().catch(err => {
    sendUpdate('error', { message: String(err && err.message || err) });
    if (manualCheck) dialog.showMessageBox(win, { type: 'warning', message: '업데이트를 확인하지 못했습니다.', detail: '인터넷 연결을 확인하세요.\n' + String(err && err.message || err) });
  });
}
function setupUpdater() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate('checking'));
  autoUpdater.on('update-not-available', () => {
    sendUpdate('latest');
    if (manualCheck) dialog.showMessageBox(win, { message: `최신 버전입니다 (v${app.getVersion()}).` });
  });
  autoUpdater.on('update-available', info => sendUpdate('downloading', { version: info.version }));
  autoUpdater.on('download-progress', p => sendUpdate('downloading', { percent: Math.round(p.percent) }));
  autoUpdater.on('error', err => sendUpdate('error', { message: String(err && err.message || err) }));
  autoUpdater.on('update-downloaded', async info => {
    sendUpdate('ready', { version: info.version });
    const notes = typeof info.releaseNotes === 'string' ? info.releaseNotes.replace(/<[^>]+>/g, '').trim() : '';
    const r = await dialog.showMessageBox(win, {
      type: 'info', buttons: ['지금 다시 시작', '나중에 (종료할 때 설치)'], defaultId: 0, cancelId: 1,
      message: `새 버전 v${info.version}을 받았습니다.`,
      detail: (notes ? notes.slice(0, 600) + '\n\n' : '') + '헌금·재정 데이터는 그대로 유지됩니다.'
    });
    if (r.response === 0) setImmediate(() => autoUpdater.quitAndInstall());
  });
}
ipcMain.handle('app:info', () => ({ version: app.getVersion(), packaged: app.isPackaged, dataDir: dataDir() }));
ipcMain.handle('app:checkUpdate', () => { checkUpdate(true); return true; });

app.whenReady().then(() => {
  createWindow();
  setupUpdater();
  setTimeout(() => checkUpdate(false), 5000);
  setInterval(() => checkUpdate(false), 6 * 60 * 60 * 1000);
});
app.on('window-all-closed', () => app.quit());
