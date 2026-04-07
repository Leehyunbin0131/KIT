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
  
  // Disable inputs while logging in
  loginId.disabled = true;
  loginPw.disabled = true;
  if (univIdEl) univIdEl.disabled = true;

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
  
  // Re-enable inputs
  loginId.disabled = false;
  loginPw.disabled = false;
  const univIdEl = document.getElementById('login-univ');
  if (univIdEl) univIdEl.disabled = false;
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
      <div class="course-card-header"></div>
      <div class="course-card-body">
        <h4 class="course-name">${escapeHtml(c.name || '과목 ' + (i + 1))}</h4>
        <p class="course-prof">${escapeHtml(c.code || '')}${c.schedule ? ' · ' + escapeHtml(c.schedule) : ''}${c.term ? ' · ' + escapeHtml(c.term) : ''}</p>
        <div class="course-stats">
          <span class="course-stat">데이터 동기화 대기 중...</span>
        </div>
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
  if (tabName === 'ai') {
    modalBody.innerHTML = `
      <div style="display:flex; flex-direction:column; height:100%; min-height:400px; max-height:500px;">
        <div id="modal-ai-chat" style="flex:1; overflow-y:auto; padding-bottom:16px; display:flex; flex-direction:column; gap:16px;">
          <div class="chat-msg ai">이 과목에 대해 무엇이든 도와드릴게요! 궁금한 점이 있으신가요?</div>
        </div>
        <form id="modal-ai-form" style="display:flex; gap:8px; border-top:1px solid var(--border); padding-top:16px;" autocomplete="off">
          <input type="text" id="modal-ai-input" placeholder="이 과목에 대해 질문하세요..." style="flex:1; padding:12px 16px; border-radius:8px; border:1px solid var(--border); background:#f8fafc; font-size:14px; outline:none;">
          <button type="submit" class="btn-primary" style="margin-top:0; padding:12px 24px; border-radius:8px;">전송</button>
        </form>
      </div>
    `;
    const form = $('#modal-ai-form');
    const input = $('#modal-ai-input');
    const chat = $('#modal-ai-chat');
    form.onsubmit = (e) => {
      e.preventDefault();
      const txt = input.value.trim();
      if (!txt) return;
      chat.insertAdjacentHTML('beforeend', `<div class="chat-msg user">${escapeHtml(txt)}</div>`);
      input.value = '';
      chat.scrollTop = chat.scrollHeight;
      setTimeout(() => {
        chat.insertAdjacentHTML('beforeend', `<div class="chat-msg ai">아직 실제 AI 백엔드와 연결되지 않았습니다. (질문: ${escapeHtml(txt)})</div>`);
        chat.scrollTop = chat.scrollHeight;
      }, 600);
    };
    return;
  }

  const data = detail[tabName] || [];

  if (!data.length) {
    modalBody.innerHTML = '<div class="empty-state">데이터가 없습니다.</div>';
    return;
  }

  modalBody.innerHTML = buildTable([], data);
  modalBody.querySelectorAll('.clickable-row').forEach((el) => {
    el.addEventListener('click', () => {
      const title = el.getAttribute('data-title') || '상세 보기';
      const enc = el.getAttribute('data-link') || '';
      let link = '';
      try {
        link = enc ? decodeURIComponent(enc) : '';
      } catch (_) {
        link = enc;
      }
      if (link) openDetailModal(title, link, window.currentCourseKey);
    });
  });
}

/* ── 유틸리티 ──────────────────────────────────────────── */
function buildTable(headers, rows) {
  if (!rows || rows.length === 0) return '';
  const cards = rows.map((row) => {
    let cells = Array.isArray(row) ? row : (row.cells || []);
    let content = cells.map((cell, i) => {
      // Create a row for each cell. If headers are provided, use them as labels.
      if (typeof cell === 'string' && row.title && cell.trim() === row.title.trim()) {
        return ''; // Skip printing the identical cell value if it's already the card title
      }
      let labelHtml = '';
      if (headers && headers[i]) {
        labelHtml = `<span class="card-label">${escapeHtml(headers[i])}</span>`;
      }
      return `<div class="card-row">${labelHtml}<span class="card-value">${cell || '-'}</span></div>`;
    }).join('');

    if (!Array.isArray(row) && row.link) {
      const t = escapeHtml(row.title || '상세 정보');
      const enc = encodeURIComponent(row.link);
      return `<div class="data-card clickable-row" data-title="${t}" data-link="${enc}">
                <div class="card-title">${t}</div>
                ${content}
              </div>`;
    }
    
    // Attempt to pull out title if it exists loosely
    let titleHtml = '';
    if (!Array.isArray(row) && row.title) {
        titleHtml = `<div class="card-title">${escapeHtml(row.title)}</div>`;
    }
    return `<div class="data-card">${titleHtml}${content}</div>`;
  }).join('');
  
  return `<div class="data-card-grid">${cards}</div>`;
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

  const res = await window.api.invoke('fetch-detail', { url, courseKey });
  const contentHtml =
    res && typeof res.html === 'string'
      ? res.html
      : '<p style="padding:20px;text-align:center;">불러오지 못했습니다.</p>';
  const attachments = res && Array.isArray(res.attachments) ? res.attachments : [];

  detailLoading.style.display = 'none';
  detailContent.style.display = 'block';

  // 첨부파일 영역(기존 파싱 오류로 메뉴탭이 들어오던 영역) 제거 요청 처리
  detailContent.innerHTML = `<div class="detail-body" style="line-height: 1.6; font-size: 14px;">${contentHtml}</div>`;
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
        `<span class="course-stat" style="font-size:12px;"><span class="stat-dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#4f46e5;"></span>${it.label} ${(detail[it.key] || []).length}</span>`
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

/* ── AI 사이드바 로직 ────────────────────────────────────── */
const aiSidebar = $('#ai-sidebar');
const toggleSidebarBtn = $('#toggle-sidebar-btn');
const closeSidebarBtn = $('#close-sidebar-btn');
const dashView = $('#dashboard-view');

if (toggleSidebarBtn) {
  toggleSidebarBtn.onclick = () => {
    if (aiSidebar.style.display === 'flex') {
      aiSidebar.classList.remove('active');
      setTimeout(() => aiSidebar.style.display = 'none', 300);
    } else {
      aiSidebar.style.display = 'flex';
      setTimeout(() => aiSidebar.classList.add('active'), 10);
    }
  };
}

if (closeSidebarBtn) {
  closeSidebarBtn.onclick = () => {
    aiSidebar.classList.remove('active');
    setTimeout(() => aiSidebar.style.display = 'none', 300);
  };
}

const mainAiForm = $('#main-ai-form');
const mainAiInput = $('#main-ai-input');
const mainAiChat = $('#main-ai-chat');

if (mainAiForm) {
  mainAiForm.onsubmit = (e) => {
    e.preventDefault();
    const txt = mainAiInput.value.trim();
    if (!txt) return;
    
    mainAiChat.insertAdjacentHTML('beforeend', `<div class="chat-msg user">${escapeHtml(txt)}</div>`);
    mainAiInput.value = '';
    mainAiChat.scrollTop = mainAiChat.scrollHeight;

    setTimeout(() => {
      mainAiChat.insertAdjacentHTML('beforeend', `<div class="chat-msg ai">실제 학습 데이터 기반 AI 응답이 이곳에 출력됩니다. 감사합니다! (질문: ${escapeHtml(txt)})</div>`);
      mainAiChat.scrollTop = mainAiChat.scrollHeight;
    }, 600);
  };
}

/* ── 별도 시간표 팝업 로직 ────────────────────────────────────── */
const toggleScheduleBtn = $('#toggle-schedule-btn');
const scheduleModal = $('#schedule-modal');
const scheduleCloseBtn = $('#schedule-close');
const dailyTimeline = $('#daily-timeline');

if (toggleScheduleBtn) {
  toggleScheduleBtn.onclick = () => {
    scheduleModal.style.display = 'flex';
    renderDailyTimeline();
  };
}

if (scheduleCloseBtn) {
  scheduleCloseBtn.onclick = () => {
    scheduleModal.style.display = 'none';
  };
}
scheduleModal.addEventListener('click', (e) => {
  if (e.target === scheduleModal) scheduleModal.style.display = 'none';
});

function renderDailyTimeline() {
  if (dailyTimeline.children.length > 0) return; // 이미 렌더링 된 경우
  const schedule = [
    { time: '09:00 - 10:15', title: '소프트웨어분석및설계', loc: '공과대학 2호관 201호' },
    { time: '13:30 - 14:45', title: '컴파일러', loc: '공과대학 1호관 405호' },
    { time: '15:00 - 16:15', title: '이산수학', loc: '공과대학 2호관 103호' },
    { time: '17:00 - 18:00', title: '모의해킹 실무 특강', 유정: '온라인 (Zoom)' }
  ];
  
  dailyTimeline.innerHTML = schedule.map(item => `
    <div class="timeline-item">
      <span class="timeline-time">${item.time}</span>
      <h5 class="timeline-title">${item.title}</h5>
      <div class="timeline-loc">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        ${item.loc || '온라인 (Zoom)'}
      </div>
    </div>
  `).join('');
}
