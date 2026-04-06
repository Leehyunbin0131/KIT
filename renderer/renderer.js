/* =========================================================
 *  대구대학교 LMS 크롤러 – Renderer (Front-end Logic)
 * ========================================================= */

/* ── 상태 ──────────────────────────────────────────────── */
let courseDataMap = {};   // index → detail

/* ── DOM 참조 ──────────────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const loginView     = $('#login-view');
const dashboardView = $('#dashboard-view');
const loginForm     = $('#login-form');
const loginBtn      = $('#login-btn');
const loginId       = $('#login-id');
const loginPw       = $('#login-pw');
const loginStatus   = $('#login-status');

const profileName   = $('#profile-name');
const profileDept   = $('#profile-dept');
const crawlStatus   = $('#crawl-status');
const progressBar   = $('#progress-bar');
const progressText  = $('#progress-text');
const userInfoGrid  = $('#user-info-grid');
const courseGrid     = $('#course-grid');
const courseCount    = $('#course-count');

const modalOverlay  = $('#course-modal');
const modalTitle    = $('#modal-title');
const modalBody     = $('#modal-body');
const modalClose    = $('#modal-close');

/* ── 타이틀바 컨트롤 ──────────────────────────────────── */
$('#btn-minimize').onclick = () => window.api.send('minimize-window');
$('#btn-maximize').onclick = () => window.api.send('maximize-window');
$('#btn-close').onclick    = () => window.api.send('close-window');

/* ── 뷰 전환 ──────────────────────────────────────────── */
function switchView(viewId) {
  $$('.view').forEach((v) => v.classList.remove('active'));
  $(`#${viewId}`).classList.add('active');
}

/* ── 로그인 ────────────────────────────────────────────── */
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const univIdEl = document.getElementById('login-univ');
  const univId = univIdEl ? univIdEl.value : 'daegu';
  const id = loginId.value.trim();
  const pw = loginPw.value.trim();
  if (!id || !pw) return;

  loginBtn.disabled = true;
  loginBtn.querySelector('.btn-text').style.display = 'none';
  loginBtn.querySelector('.btn-loader').style.display = 'flex';
  setLoginStatus('로그인 시도 중...', 'info');

  window.api.send('login', { univId, id, pw });
});

function setLoginStatus(msg, type = '') {
  loginStatus.textContent = msg;
  loginStatus.className = 'status-msg ' + type;
}

/* ── IPC 수신 핸들러 ──────────────────────────────────── */

/* 저장된 로그인 정보 자동 입력 */
window.api.receive('saved-login-info', (info) => {
  if (info.id) loginId.value = info.id;
  if (info.pw) loginPw.value = info.pw;
});

/* 로그인 성공 */
window.api.receive('login-success', () => {
  setLoginStatus('✅ 로그인 성공!', 'success');
  setTimeout(() => switchView('dashboard-view'), 600);
  progressBar.classList.add('indeterminate');
  crawlStatus.querySelector('span').textContent = '크롤링 중...';
});

/* 로그인 실패 */
window.api.receive('login-fail', () => {
  setLoginStatus('❌ 로그인 실패. 학번과 비밀번호를 확인해주세요.', 'error');
  loginBtn.disabled = false;
  loginBtn.querySelector('.btn-text').style.display = '';
  loginBtn.querySelector('.btn-loader').style.display = 'none';
});

/* 진행 상황 */
window.api.receive('crawl-progress', (msg) => {
  progressText.textContent = msg;
  /* 간단한 진행률 추정 */
  if (msg.includes('사용자 정보')) setProgress(10);
  else if (msg.includes('과목 목록')) setProgress(20);
  else if (msg.includes('과목 상세')) {
    const match = msg.match(/\((\d+)\/(\d+)\)/);
    if (match) {
      const pct = 20 + (parseInt(match[1]) / parseInt(match[2])) * 70;
      setProgress(pct);
    }
  } else if (msg.includes('완료')) setProgress(100);
});

function setProgress(pct) {
  progressBar.classList.remove('indeterminate');
  progressBar.style.width = pct + '%';
}

/* 사용자 정보 도착 */
window.api.receive('user-info', (info) => {
  if (!info) return;

  /* 프로필 헤더 업데이트 */
  if (info.name) profileName.textContent = info.name;
  if (info.studentId) profileDept.textContent = info.studentId;

  /* 정보 그리드 표시 */
  const section = $('#user-info-section');
  section.style.display = '';

  /* 필터링: 내부용(_prefix)이나 빈 값 제외 */
  const skipKeys = ['_pageTitle', '_bodyText', '_mainText', 'rawHeaderText', 'error'];
  const entries = Object.entries(info).filter(
    ([k, v]) => !skipKeys.includes(k) && !k.startsWith('_') && v && String(v).trim()
  );

  userInfoGrid.innerHTML = entries
    .map(
      ([k, v]) => `
    <div class="info-item">
      <span class="info-label">${escapeHtml(prettifyKey(k))}</span>
      <span class="info-value">${escapeHtml(String(v).substring(0, 200))}</span>
    </div>`
    )
    .join('');
});

/* 과목 리스트 도착 */
window.api.receive('course-list', (courses) => {
  if (!courses || !courses.length) return;

  const section = $('#courses-section');
  section.style.display = '';
  courseCount.textContent = courses.length;

  courseGrid.innerHTML = courses
    .map(
      (c, i) => `
    <div class="course-card" data-index="${i}">
      <h4 class="course-name">${escapeHtml(c.name || '과목 ' + (i + 1))}</h4>
      <p class="course-prof">${escapeHtml(c.code || '')}${c.schedule ? ' · ' + escapeHtml(c.schedule) : ''}${c.term ? ' · ' + escapeHtml(c.term) : ''}</p>
      <div class="course-stats">
        <span class="course-stat">데이터 동기화 대기 중...</span>
      </div>
    </div>`
    )
    .join('');

  /* 카드 클릭 이벤트 */
  $$('.course-card').forEach((card) => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.index);
      openCourseModal(idx, courses[idx]);
    });
  });
});

/* 단일 과목 상세 도착 */
window.api.receive('course-detail', ({ index, detail }) => {
  courseDataMap[index] = detail;

  /* 카드의 스탯 업데이트 */
  const card = $(`.course-card[data-index="${index}"]`);
  if (card) {
    const stats = card.querySelector('.course-stats');
    stats.innerHTML = buildStatBadges(detail);
  }
});

/* 크롤링 완료 */
window.api.receive('crawl-complete', () => {
  crawlStatus.querySelector('span').textContent = '크롤링 완료';
  crawlStatus.querySelector('.pulse-dot').style.animation = 'none';
  crawlStatus.querySelector('.pulse-dot').style.background = 'var(--success)';
  setProgress(100);
  progressText.textContent = '✅ 모든 데이터를 불러왔습니다.';
});

/* 크롤링 에러 */
window.api.receive('crawl-error', (errMsg) => {
  crawlStatus.querySelector('span').textContent = '오류 발생';
  crawlStatus.style.background = 'rgba(255,107,107,0.12)';
  crawlStatus.style.color = 'var(--danger)';
  progressText.textContent = '❌ ' + errMsg;
});

/* ── 과목 상세 모달 ────────────────────────────────────── */
function openCourseModal(index, course) {
  modalTitle.textContent = course.name || '과목 상세';
  window.currentCourseKey = course.kjKey;
  const detail = courseDataMap[index];

  if (!detail) {
    modalBody.innerHTML = '<div class="empty-state">데이터를 아직 불러오지 못했습니다.</div>';
  } else {
    renderTab('plan', detail);
  }

  /* 탭 초기화 */
  $$('.modal-tabs .tab').forEach((t) => {
    t.classList.remove('active');
    if (t.dataset.tab === 'plan') t.classList.add('active');

    /* 탭 클릭 */
    t.onclick = () => {
      $$('.modal-tabs .tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      if (detail) renderTab(t.dataset.tab, detail);
    };
  });

  modalOverlay.classList.add('open');
}

modalClose.onclick = () => modalOverlay.classList.remove('open');
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.remove('open');
});

/* ── 탭 렌더링 ─────────────────────────────────────────── */
function renderTab(tabName, detail) {
  const data = detail[tabName] || [];

  if (!data.length) {
    modalBody.innerHTML = '<div class="empty-state">데이터가 없습니다.</div>';
    return;
  }

  modalBody.innerHTML = buildTable([], data);
}

/* ── 유틸리티 ──────────────────────────────────────────── */
function buildTable(headers, rows) {
  let thead = '';
  if (headers && headers.length > 0) {
    const ths = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
    thead = `<thead><tr>${ths}</tr></thead>`;
  }

  const trs = rows
    .map((row) => {
      // If row is an array, map it quickly
      if (Array.isArray(row)) {
        return '<tr>' + row.map((cell) => `<td>${cell || '-'}</td>`).join('') + '</tr>';
      }
      // If row is an object with link and cells array
      if (row.cells && Array.isArray(row.cells)) {
        const columns = row.cells.map((cell) => `<td>${cell || '-'}</td>`).join('');
        if (row.link) {
          return `<tr class="clickable-row" onclick="openDetailModal('${escapeHtml(row.title || '상세 보기')}', '${row.link}', window.currentCourseKey)">${columns}</tr>`;
        }
        return `<tr>${columns}</tr>`;
      }
      return '';
    })
    .join('');
  return `<table class="data-table">${thead}<tbody>${trs}</tbody></table>`;
}

/* ── 상세 모달 로직 ────────────────────────────────────── */
const detailModal = $('#detail-modal');
const detailTitle = $('#detail-title');
const detailClose = $('#detail-close');
const detailLoading = $('#detail-loading');
const detailContent = $('#detail-content');

detailClose.onclick = () => detailModal.style.display = 'none';
detailModal.addEventListener('click', (e) => {
  if (e.target === detailModal) detailModal.style.display = 'none';
});

async function openDetailModal(title, url, courseKey) {
  detailTitle.textContent = title || '상세 내용';
  detailContent.style.display = 'none';
  detailLoading.style.display = 'block';
  detailModal.style.display = 'flex';
  
  const contentHtml = await window.api.invoke('fetch-detail', { url, courseKey });
  
  detailLoading.style.display = 'none';
  detailContent.style.display = 'block';
  detailContent.innerHTML = contentHtml;
}

function buildStatBadges(detail) {
  const items = [
    { key: 'plan',      label: '강계' },
    { key: 'notices',   label: '공지' },
    { key: 'qna',       label: 'QnA' },
    { key: 'materials', label: '자료' },
    { key: 'projects',  label: '프로젝트' },
    { key: 'tests',     label: '시험' },
    { key: 'discuss',   label: '토론' },
    { key: 'clicker',   label: '투표' },
    { key: 'survey',    label: '설문' },
  ];
  return items
    .filter(it => (detail[it.key] || []).length > 0)
    .slice(0, 5) // 너무 길어지지 않게 상위 5개만 뱃지로 표현
    .map(
      (it) =>
        `<span class="course-stat" style="font-size:12px;"><span class="stat-dot" style="background:#5ac8fa;"></span>${it.label} ${(detail[it.key] || []).length}</span>`
    )
    .join('');
}

function formatStatus(status) {
  if (!status) return '-';
  const s = status.trim();
  if (s.includes('제출') || s.includes('완료'))
    return `<span class="status-badge done">✓ ${escapeHtml(s)}</span>`;
  if (s.includes('미제출') || s.includes('미완'))
    return `<span class="status-badge pending">○ ${escapeHtml(s)}</span>`;
  if (s.includes('지각') || s.includes('초과'))
    return `<span class="status-badge late">! ${escapeHtml(s)}</span>`;
  return escapeHtml(s);
}

function formatAttendance(status) {
  if (!status) return '-';
  const s = status.trim();
  if (s.includes('출석'))
    return `<span class="status-badge done">✓ 출석</span>`;
  if (s.includes('결석'))
    return `<span class="status-badge late">✕ 결석</span>`;
  if (s.includes('지각'))
    return `<span class="status-badge pending">△ 지각</span>`;
  return escapeHtml(s);
}

function escapeHtml(str) {
  if (!str) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

function prettifyKey(key) {
  const dict = {
    name: '이름',
    studentId: '학번',
    profileImage: '프로필 이미지',
  };
  if (dict[key]) return dict[key];
  /* field_ 접두사 제거 */
  return key.replace(/^field_/, '').replace(/_/g, ' ');
}
