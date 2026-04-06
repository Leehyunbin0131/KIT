/* =========================================================
 *  대구대학교 및 타 기종 LMS 호환 크롤러 – Electron Main
 * ========================================================= */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

/* ── URL 상수 및 어댑터 ──────────────────────────────── */
const DaeguLms = require('./src/adapters/universities/DaeguLms');

let currentAdapter = null;
let mainWin = null;
let crawlWin = null;
let allCrawledData = null;

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1000, minHeight: 700,
    show: false, frame: false, backgroundColor: '#0b0e14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  return win;
}

function getOrCreateCrawlWindow() {
  if (crawlWin && !crawlWin.isDestroyed()) return crawlWin;
  crawlWin = new BrowserWindow({
    show: false, width: 1280, height: 900,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  return crawlWin;
}

function sendProgress(message) {
  console.log('[PROGRESS]', message);
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('crawl-progress', message);
  }
}

/* ──────────────────────────────────────────────────────────
 *  전체 크롤링 오케스트레이션
 * ────────────────────────────────────────────────────────── */
async function crawlAllData() {
  const data = { crawledAt: new Date().toISOString(), userInfo: {}, courses: [], timetable: [] };

  try {
    /* 1. 메인 페이지에서 사용자 정보 + 과목 리스트 + 시간표 */
    const mainData = await currentAdapter.crawlMainPage();
    data.userInfo = mainData.userInfo || {};
    data.timetable = mainData.timetable || [];
    const courseList = mainData.courses || [];

    mainWin.webContents.send('user-info', data.userInfo);
    mainWin.webContents.send('course-list', courseList);
    sendProgress(`${courseList.length}개 과목 발견, 상세 정보 크롤링 시작...`);

    /* 2. 각 과목 상세 */
    for (let i = 0; i < courseList.length; i++) {
      const detail = await currentAdapter.crawlCourseDetail(courseList[i], i, courseList.length);
      data.courses.push(detail);
      mainWin.webContents.send('course-detail', { index: i, detail });
    }

    sendProgress('✅ 모든 데이터 크롤링 완료!');
    mainWin.webContents.send('crawl-complete', data);
  } catch (e) {
    console.error('Crawl error:', e);
    mainWin.webContents.send('crawl-error', e.message);
  }
  return data;
}

app.whenReady().then(() => {
  mainWin = createMainWindow();

  mainWin.webContents.on('did-finish-load', () => {
    const savedId = process.env.LMS_ID || '';
    const savedPw = process.env.LMS_PW || '';
    if (savedId) mainWin.webContents.send('saved-login-info', { id: savedId, pw: savedPw });
  });

  ipcMain.on('login', async (_event, credentials) => {
    // Determine which adapter to use (we can retrieve univId from credentials if UI supplies it)
    const univId = credentials.univId || 'daegu';
    if (univId === 'daegu') {
      currentAdapter = new DaeguLms();
    } else {
      // For future Hello LMS universities, we will add more branches here
      currentAdapter = new DaeguLms(); 
    }

    currentAdapter.setCrawlWindow(getOrCreateCrawlWindow());
    currentAdapter.setProgressCallback(sendProgress);

    sendProgress('로그인 시도 중...');
    const success = await currentAdapter.login(credentials);
    
    if (success) {
      mainWin.webContents.send('login-success');
      sendProgress('로그인 성공! 크롤링을 시작합니다...');
      allCrawledData = await crawlAllData();
    } else {
      mainWin.webContents.send('login-fail');
    }
  });

  ipcMain.on('minimize-window', () => mainWin.minimize());
  ipcMain.on('maximize-window', () => { mainWin.isMaximized() ? mainWin.unmaximize() : mainWin.maximize(); });
  ipcMain.on('close-window', () => mainWin.close());
});

app.on('window-all-closed', () => app.quit());

ipcMain.handle('fetch-detail', async (event, { url, courseKey }) => {
  if (!currentAdapter) return '<p>어댑터가 초기화되지 않았습니다.</p>';
  try {
    return await currentAdapter.fetchDetailContent(url, courseKey);
  } catch (err) {
    console.error('Fetch detail error:', err);
    return '<p style="padding:20px;text-align:center;">불러오기 에러가 발생했습니다.</p>';
  }
});
