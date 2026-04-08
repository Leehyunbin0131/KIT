/* =========================================================
 *  EduPlatform – Renderer Logic
 * ========================================================= */

const PLATFORM_META = {
  daegu: {
    id: 'daegu',
    name: '대구대학교',
    shortName: 'DU',
    connectorLabel: 'Hello LMS',
    typeLabel: '일반 LMS',
    region: '대구',
    description: 'Hello LMS 기반 강의, 공지, 자료를 빠르게 정리합니다.',
    loginTitle: '대구대학교 학습 계정을 연결합니다',
    loginHint: 'Hello LMS 기반 강의, 공지, 자료를 우선순위에 맞게 정리합니다.',
    accentClass: 'daegu-color',
    keywords: ['대구대학교', '대구', 'daegu', 'du', 'hello lms'],
    capabilities: ['과목 상세 탭', '공지/자료 정리', '시간표 요약'],
  },
  kmooc: {
    id: 'kmooc',
    name: 'K-MOOC',
    shortName: 'K',
    connectorLabel: 'Open Course',
    typeLabel: 'MOOC',
    region: '전국',
    description: '공개 강좌 중심의 학습 현황과 콘텐츠를 한 화면에서 정리합니다.',
    loginTitle: 'K-MOOC 학습 계정을 연결합니다',
    loginHint: '공개 강좌 진행 상황과 콘텐츠를 한 화면에서 관리할 수 있습니다.',
    accentClass: 'kmooc-color',
    keywords: ['kmooc', 'k-mooc', 'mooc', '공개강좌'],
    capabilities: ['공개 강좌 목록', '콘텐츠 상태 요약', '빠른 재진입'],
  },
  knu: {
    id: 'knu',
    name: '경북대학교',
    shortName: 'KNU',
    connectorLabel: 'Canvas',
    typeLabel: 'Canvas',
    region: '대구',
    description: 'Canvas 강의 구조를 과목 중심 워크스페이스로 다시 정리해 보여줍니다.',
    loginTitle: '경북대학교 학습 계정을 연결합니다',
    loginHint: 'Canvas 구조의 수업 정보를 과목 중심 화면으로 다시 정리합니다.',
    accentClass: 'knu-color',
    keywords: ['경북대학교', '경북대', 'knu', 'canvas'],
    capabilities: ['Canvas 과목 정리', '세부 탭 탐색', '워크스페이스 전환'],
  },
};

const SCHOOL_DIRECTORY = Object.values(PLATFORM_META).map((school) => ({
  ...school,
  available: true,
}));

const SCHOOL_DIRECTORY_MAP = Object.fromEntries(SCHOOL_DIRECTORY.map((school) => [school.id, school]));

const DETAIL_TABS = [
  { key: 'plan', label: '강의계획서' },
  { key: 'notices', label: '공지사항' },
  { key: 'qna', label: '질의응답' },
  { key: 'materials', label: '강의자료' },
  { key: 'projects', label: '과제/프로젝트' },
  { key: 'tests', label: '시험/퀴즈' },
  { key: 'discuss', label: '토론' },
  { key: 'clicker', label: '투표' },
  { key: 'survey', label: '설문' },
];

const DIRECTORY_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'favorites', label: '즐겨찾기' },
  { id: 'recent', label: '최근 사용' },
  { id: 'connected', label: '연결됨' },
  { id: 'available', label: '연결 가능' },
];

const STORAGE_KEYS = {
  favorites: 'eduplatform.favoriteSchoolIds',
  recents: 'eduplatform.recentSchoolIds',
  selection: 'eduplatform.directorySelectionId',
};

function createEmptyPlatformState() {
  return {
    userInfo: null,
    courses: null,
    courseDataMap: {},
    statusMsg: '',
    progress: 0,
    isLoggedIn: false,
    isCrawling: false,
    timetable: [],
    lastSyncedAt: null,
    searchQuery: '',
    assistantMessages: [],
    assistantCollapsed: true,
    loginStatus: '',
    loginStatusType: '',
  };
}

function loadStoredArray(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveStoredArray(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

function loadStoredValue(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function saveStoredValue(key, value) {
  try {
    if (value) window.localStorage.setItem(key, value);
  } catch (_) {}
}

function isKnownSchool(univId) {
  return Boolean(SCHOOL_DIRECTORY_MAP[univId]);
}

const platformState = Object.fromEntries(SCHOOL_DIRECTORY.map((school) => [school.id, createEmptyPlatformState()]));

let currentPlatform = null;
let currentViewId = 'home-view';
let activeCourseContext = null;
let schoolDirectoryQuery = '';
let schoolDirectoryFilter = 'all';
let recentSchoolIds = loadStoredArray(STORAGE_KEYS.recents).filter(isKnownSchool);
let favoriteSchoolIds = loadStoredArray(STORAGE_KEYS.favorites).filter(isKnownSchool);
let directorySelectionId = isKnownSchool(loadStoredValue(STORAGE_KEYS.selection))
  ? loadStoredValue(STORAGE_KEYS.selection)
  : SCHOOL_DIRECTORY[0].id;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const loginForm = $('#login-form');
const loginBtn = $('#login-btn');
const loginId = $('#login-id');
const loginPw = $('#login-pw');
const loginStatus = $('#login-status');

const schoolNavBar = $('#school-nav-bar');
const schoolSwitcherTrigger = $('#school-switcher-trigger');
const schoolDirectoryHomeBtn = $('#school-directory-home-btn');
const schoolDirectorySearch = $('#school-directory-search');
const navActiveSchoolLabel = $('#nav-active-school-label');
const navActiveSchoolMeta = $('#nav-active-school-meta');
const navQuickSchools = $('#nav-quick-schools');

const schoolDirectoryFilters = $$('#school-directory-filters .directory-filter-btn');
const schoolDirectorySections = $('#school-directory-sections');
const directoryResultCount = $('#directory-result-count');
const directorySelectedStatus = $('#directory-selected-status');
const directorySelectedLogo = $('#directory-selected-logo');
const directorySelectedName = $('#directory-selected-name');
const directorySelectedSubtitle = $('#directory-selected-subtitle');
const directorySelectedTags = $('#directory-selected-tags');
const directorySelectedHighlights = $('#directory-selected-highlights');
const directoryPrimaryAction = $('#directory-primary-action');
const directoryFavoriteBtn = $('#directory-favorite-btn');
const directoryPreviewNote = $('#directory-preview-note');

const selectedPlatformBadge = $('#selected-platform-badge');
const loginPlatformName = $('#login-platform-name');
const loginPlatformHint = $('#login-platform-hint');
const loginUniv = $('#login-univ');

const dashboardPlatformBadge = $('#dashboard-platform-badge');
const dashboardSyncState = $('#dashboard-sync-state');
const dashboardGreeting = $('#dashboard-greeting');
const dashboardSummaryText = $('#dashboard-summary-text');

const profileName = $('#profile-name');
const profileDept = $('#profile-dept');
const profileMetaList = $('#profile-meta-list');

const overviewCourseCount = $('#overview-course-count');
const overviewCourseCaption = $('#overview-course-caption');
const overviewSyncCount = $('#overview-sync-count');
const overviewSyncCaption = $('#overview-sync-caption');
const overviewTimetableCount = $('#overview-timetable-count');
const overviewTimetableCaption = $('#overview-timetable-caption');
const overviewLastSync = $('#overview-last-sync');
const overviewLastSyncCaption = $('#overview-last-sync-caption');

const progressHeading = $('#progress-heading');
const crawlStatus = $('#crawl-status');
const progressBar = $('#progress-bar');
const progressText = $('#progress-text');

const userInfoGrid = $('#user-info-grid');
const courseGrid = $('#course-grid');
const courseCount = $('#course-count');
const courseSearch = $('#course-search');
const courseSummary = $('#course-summary');

const schedulePreview = $('#schedule-preview');
const scheduleModalTitle = $('#schedule-modal-title');
const dailyTimeline = $('#daily-timeline');

const aiSidebar = $('#ai-sidebar');
const assistantStatusText = $('#assistant-status-text');
const mainAiForm = $('#main-ai-form');
const mainAiInput = $('#main-ai-input');
const mainAiChat = $('#main-ai-chat');

const modalOverlay = $('#course-modal');
const modalTitle = $('#modal-title');
const modalBody = $('#modal-body');
const modalClose = $('#modal-close');

const detailModal = $('#detail-modal');
const detailTitle = $('#detail-title');
const detailClose = $('#detail-close');
const detailLoading = $('#detail-loading');
const detailContent = $('#detail-content');

const scheduleModal = $('#schedule-modal');
const scheduleCloseBtn = $('#schedule-close');

const btnLogout = $('#btn-logout');
const toggleSidebarBtn = $('#toggle-sidebar-btn');
const closeSidebarBtn = $('#close-sidebar-btn');
const toggleScheduleBtn = $('#toggle-schedule-btn');
const openScheduleInlineBtn = $('#open-schedule-inline');
const backToHomeBtn = $('#back-to-home-btn');

$('#btn-minimize').onclick = () => window.api.send('minimize-window');
$('#btn-maximize').onclick = () => window.api.send('maximize-window');
$('#btn-close').onclick = () => window.api.send('close-window');

function getPlatformMeta(univId) {
  return SCHOOL_DIRECTORY_MAP[univId] || SCHOOL_DIRECTORY[0];
}

function getState(univId) {
  if (!platformState[univId]) {
    platformState[univId] = createEmptyPlatformState();
  }
  return platformState[univId];
}

function syncChromeHeight() {
  const fallbackHeight = 108;
  if (!schoolNavBar) {
    document.documentElement.style.setProperty('--chrome-height', `${fallbackHeight}px`);
    return;
  }

  const navBottom = Math.ceil(schoolNavBar.getBoundingClientRect().bottom);
  document.documentElement.style.setProperty('--chrome-height', `${Math.max(fallbackHeight, navBottom)}px`);
}

function switchView(viewId) {
  currentViewId = viewId;
  $$('.view').forEach((view) => view.classList.remove('active'));
  const nextView = $(`#${viewId}`);
  if (nextView) nextView.classList.add('active');
  renderSchoolNavigation();
}

function setDirectorySelection(univId, options = {}) {
  if (!isKnownSchool(univId)) return;
  directorySelectionId = univId;
  if (options.persist !== false) {
    saveStoredValue(STORAGE_KEYS.selection, univId);
  }
  updatePlatformContext(univId);
}

function recordRecentSchool(univId) {
  if (!isKnownSchool(univId)) return;
  recentSchoolIds = [univId, ...recentSchoolIds.filter((id) => id !== univId)].slice(0, 5);
  saveStoredArray(STORAGE_KEYS.recents, recentSchoolIds);
}

function toggleFavoriteSchool(univId) {
  if (!isKnownSchool(univId)) return;
  if (favoriteSchoolIds.includes(univId)) {
    favoriteSchoolIds = favoriteSchoolIds.filter((id) => id !== univId);
  } else {
    favoriteSchoolIds = [univId, ...favoriteSchoolIds.filter((id) => id !== univId)].slice(0, 8);
  }
  saveStoredArray(STORAGE_KEYS.favorites, favoriteSchoolIds);
  renderSchoolNavigation();
  renderSchoolDirectory();
}

function showSchoolDirectory(options = {}) {
  if (options.alignSelection !== false && currentPlatform && isKnownSchool(currentPlatform)) {
    setDirectorySelection(currentPlatform);
  }
  switchView('home-view');
  renderSchoolDirectory();
  if (options.focusSearch) {
    requestAnimationFrame(() => schoolDirectorySearch.focus());
  }
}

function openPlatform(univId) {
  if (!isKnownSchool(univId)) return;
  currentPlatform = univId;
  setDirectorySelection(univId);
  recordRecentSchool(univId);
  renderPlatformState(univId);
}

function getNavigationSchoolId() {
  if (currentViewId === 'home-view') return directorySelectionId || currentPlatform || SCHOOL_DIRECTORY[0].id;
  return currentPlatform || directorySelectionId || SCHOOL_DIRECTORY[0].id;
}

function buildNavigationMeta(univId) {
  const state = isKnownSchool(univId) ? getState(univId) : null;

  if (currentViewId === 'home-view') {
    if (schoolDirectoryQuery.trim()) {
      return `검색 결과 ${getFilteredSchools().length}개`;
    }
    if (schoolDirectoryFilter !== 'all') {
      const filter = DIRECTORY_FILTERS.find((item) => item.id === schoolDirectoryFilter);
      return `${filter ? filter.label : '선택된'} 학교 보기`;
    }
    return '최근 사용, 즐겨찾기, 전체 디렉터리로 빠르게 전환';
  }

  if (!state || !state.isLoggedIn) {
    return '학교 계정 연결 후 워크스페이스를 시작합니다';
  }

  if (state.isCrawling) return '활성 워크스페이스 · 동기화 중';
  return '활성 워크스페이스 · 바로 작업 가능';
}

function renderQuickSchoolChips() {
  const quickIds = [];
  [...favoriteSchoolIds, ...recentSchoolIds].forEach((univId) => {
    if (!quickIds.includes(univId)) quickIds.push(univId);
  });

  if (!quickIds.length) {
    navQuickSchools.innerHTML = '<span class="nav-quick-placeholder">최근 또는 즐겨찾기 학교가 여기에 표시됩니다.</span>';
    return;
  }

  navQuickSchools.innerHTML = quickIds
    .slice(0, 4)
    .map((univId) => {
      const meta = getPlatformMeta(univId);
      const active = currentPlatform === univId || (currentViewId === 'home-view' && directorySelectionId === univId);
      return `
        <button type="button" class="quick-school-btn ${active ? 'active' : ''}" data-school-id="${univId}">
          ${escapeHtml(meta.name)}
        </button>
      `;
    })
    .join('');
}

function renderSchoolNavigation() {
  const univId = getNavigationSchoolId();
  const meta = getPlatformMeta(univId);
  navActiveSchoolLabel.textContent = meta ? meta.name : '학교 디렉터리';
  navActiveSchoolMeta.textContent = buildNavigationMeta(univId);
  schoolDirectorySearch.value = schoolDirectoryQuery;
  renderQuickSchoolChips();
  requestAnimationFrame(syncChromeHeight);
}

function applyDirectoryFilter(school) {
  const state = getState(school.id);
  if (schoolDirectoryFilter === 'favorites') return favoriteSchoolIds.includes(school.id);
  if (schoolDirectoryFilter === 'recent') return recentSchoolIds.includes(school.id);
  if (schoolDirectoryFilter === 'connected') return state.isLoggedIn;
  if (schoolDirectoryFilter === 'available') return school.available;
  return true;
}

function matchesSchoolQuery(school, query) {
  if (!query) return true;
  const haystack = [
    school.name,
    school.shortName,
    school.connectorLabel,
    school.typeLabel,
    school.region,
    school.description,
    ...(school.keywords || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function getDirectoryScore(school) {
  const state = getState(school.id);
  let score = 0;

  if (currentPlatform === school.id) score += 120;
  if (favoriteSchoolIds.includes(school.id)) score += 60;
  if (state.isLoggedIn) score += 40;
  if (recentSchoolIds.includes(school.id)) score += Math.max(25 - recentSchoolIds.indexOf(school.id), 10);
  if (school.available) score += 8;

  return score;
}

function sortSchools(left, right) {
  const diff = getDirectoryScore(right) - getDirectoryScore(left);
  if (diff !== 0) return diff;
  return left.name.localeCompare(right.name, 'ko');
}

function getFilteredSchools() {
  const query = schoolDirectoryQuery.trim().toLowerCase();
  return SCHOOL_DIRECTORY.filter((school) => applyDirectoryFilter(school) && matchesSchoolQuery(school, query)).sort(sortSchools);
}

function ensureDirectorySelection(filteredSchools) {
  if (!filteredSchools.length) return;
  const hasSelected = filteredSchools.some((school) => school.id === directorySelectionId);
  if (hasSelected) return;

  const preferred = filteredSchools.find((school) => school.id === currentPlatform) || filteredSchools[0];
  setDirectorySelection(preferred.id, { persist: false });
}

function getSchoolsByIds(ids) {
  return ids
    .map((univId) => SCHOOL_DIRECTORY_MAP[univId])
    .filter(Boolean)
    .sort(sortSchools);
}

function buildDirectorySections(filteredSchools) {
  if (!filteredSchools.length) {
    return [];
  }

  if (schoolDirectoryQuery.trim() || schoolDirectoryFilter !== 'all') {
    return [
      {
        id: 'results',
        title: schoolDirectoryQuery.trim() ? '검색 결과' : '선택한 조건의 학교',
        subtitle: schoolDirectoryQuery.trim()
          ? `검색어 "${schoolDirectoryQuery.trim()}" 에 맞는 학교입니다.`
          : '선택한 조건에 맞는 학교만 모아 보여줍니다.',
        items: filteredSchools,
      },
    ];
  }

  const favorites = getSchoolsByIds(favoriteSchoolIds);
  const recent = getSchoolsByIds(recentSchoolIds).filter((school) => !favoriteSchoolIds.includes(school.id));
  const connected = filteredSchools.filter(
    (school) => getState(school.id).isLoggedIn && !favoriteSchoolIds.includes(school.id) && !recentSchoolIds.includes(school.id)
  );

  const sections = [];
  if (favorites.length) {
    sections.push({
      id: 'favorites',
      title: '즐겨찾기 학교',
      subtitle: '자주 쓰는 학교를 고정해 빠르게 재진입합니다.',
      items: favorites,
    });
  }
  if (recent.length) {
    sections.push({
      id: 'recent',
      title: '최근 사용 학교',
      subtitle: '최근 열었던 학교를 한 번 더 빠르게 찾을 수 있습니다.',
      items: recent,
    });
  }
  if (connected.length) {
    sections.push({
      id: 'connected',
      title: '현재 준비된 학교',
      subtitle: '로그인과 동기화가 완료된 학교 워크스페이스입니다.',
      items: connected,
    });
  }
  sections.push({
    id: 'all',
    title: '전체 학교 디렉터리',
    subtitle: '학교 수가 늘어나도 검색과 필터 기준은 동일하게 유지됩니다.',
    items: filteredSchools,
  });

  return sections;
}

function getSchoolStatusMeta(univId) {
  const school = getPlatformMeta(univId);
  const state = getState(univId);

  if (!school.available) {
    return { label: '준비 중', className: 'pending', hint: '아직 연동되지 않았습니다.' };
  }
  if (state.isCrawling) {
    return { label: '동기화 중', className: 'loading', hint: '데이터를 순차적으로 정리하고 있습니다.' };
  }
  if (state.isLoggedIn) {
    return { label: '워크스페이스 준비', className: 'connected', hint: '바로 과목과 일정을 확인할 수 있습니다.' };
  }
  return { label: '연결 가능', className: 'available', hint: '지금 바로 로그인할 수 있습니다.' };
}

function getDirectoryActionLabel(univId) {
  const school = getPlatformMeta(univId);
  const state = getState(univId);
  if (!school.available) return '준비 중';
  if (state.isLoggedIn && currentPlatform === univId) return '워크스페이스';
  if (state.isLoggedIn) return '열기';
  return '연결';
}

function buildDirectoryItemHtml(school) {
  const status = getSchoolStatusMeta(school.id);
  const selected = directorySelectionId === school.id;
  const current = currentPlatform === school.id;
  const favorite = favoriteSchoolIds.includes(school.id);
  const metaText = [school.connectorLabel, school.typeLabel, school.region].filter(Boolean).join(' · ');

  return `
    <article class="directory-item ${selected ? 'selected' : ''} ${current ? 'current' : ''}">
      <button type="button" class="directory-item-main" data-school-action="select" data-school-id="${school.id}">
        <span class="directory-logo ${escapeHtml(school.accentClass)}">${escapeHtml(school.shortName)}</span>
        <span class="directory-item-copy">
          <span class="directory-item-heading">
            <strong>${escapeHtml(school.name)}</strong>
            <span class="directory-mini-status ${status.className}">${escapeHtml(status.label)}</span>
          </span>
          <span class="directory-item-desc">${escapeHtml(school.description)}</span>
          <span class="directory-item-meta">${escapeHtml(metaText)}</span>
        </span>
      </button>
      <div class="directory-item-actions">
        <button
          type="button"
          class="favorite-toggle-btn ${favorite ? 'active' : ''}"
          data-school-action="favorite"
          data-school-id="${school.id}"
          aria-label="${favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}"
        >${favorite ? '★' : '☆'}</button>
        <button
          type="button"
          class="directory-open-btn"
          data-school-action="open"
          data-school-id="${school.id}"
          ${school.available ? '' : 'disabled'}
        >${escapeHtml(getDirectoryActionLabel(school.id))}</button>
      </div>
    </article>
  `;
}

function buildDirectorySectionHtml(section) {
  return `
    <section class="directory-section">
      <div class="directory-section-head">
        <div>
          <h3 class="directory-section-title">${escapeHtml(section.title)}</h3>
          <p class="directory-section-subtitle">${escapeHtml(section.subtitle)}</p>
        </div>
        <span class="directory-section-count">${section.items.length}</span>
      </div>
      <div class="directory-list">
        ${section.items.map((school) => buildDirectoryItemHtml(school)).join('')}
      </div>
    </section>
  `;
}

function buildPreviewHighlights(school) {
  const status = getSchoolStatusMeta(school.id);
  const recent = recentSchoolIds.includes(school.id);
  const favorite = favoriteSchoolIds.includes(school.id);

  const items = [
    {
      label: '현재 상태',
      value: status.label,
      description: status.hint,
    },
    {
      label: '연결 방식',
      value: school.connectorLabel,
      description: `${school.typeLabel} 기반 워크스페이스`,
    },
    {
      label: '최근 사용',
      value: recent ? '있음' : '없음',
      description: recent ? '최근 진입한 학교 목록에 포함됩니다.' : '열면 최근 사용 목록에 자동으로 기록됩니다.',
    },
    {
      label: '즐겨찾기',
      value: favorite ? '고정됨' : '선택 가능',
      description: favorite ? '상단 빠른 전환 영역에서 우선 노출됩니다.' : '자주 쓰는 학교면 즐겨찾기로 고정할 수 있습니다.',
    },
  ];

  return items
    .map(
      (item) => `
        <div class="preview-stat-card">
          <span class="preview-stat-label">${escapeHtml(item.label)}</span>
          <strong class="preview-stat-value">${escapeHtml(item.value)}</strong>
          <p class="preview-stat-desc">${escapeHtml(item.description)}</p>
        </div>
      `
    )
    .join('');
}

function buildPreviewNote(school) {
  const state = getState(school.id);
  if (state.isLoggedIn && currentPlatform === school.id) {
    return '현재 작업 중인 학교입니다. 상단 전환 바나 디렉터리에서 언제든 다시 들어올 수 있습니다.';
  }
  if (state.isLoggedIn) {
    return '이미 준비된 학교입니다. 검색 결과나 빠른 전환 버튼에서 바로 다시 열 수 있습니다.';
  }
  return '학교 수가 많아져도 검색, 최근 사용, 즐겨찾기 기준으로 진입하므로 목록이 길어져도 탐색 방식은 바뀌지 않습니다.';
}

function renderDirectoryPreview(filteredSchools) {
  if (!filteredSchools.length) {
    directorySelectedStatus.className = 'directory-status-chip pending';
    directorySelectedStatus.textContent = '검색 결과 없음';
    directorySelectedLogo.className = 'directory-preview-logo';
    directorySelectedLogo.textContent = '?';
    directorySelectedName.textContent = '일치하는 학교가 없습니다';
    directorySelectedSubtitle.textContent = '검색어를 바꾸거나 필터를 다시 선택해 보세요.';
    directorySelectedTags.innerHTML = '';
    directorySelectedHighlights.innerHTML = buildEmptyStateCard('학교를 다시 찾아보세요', '검색어 또는 필터 조건에 맞는 학교가 보이면 여기서 바로 연결할 수 있습니다.');
    directoryPrimaryAction.disabled = true;
    directoryPrimaryAction.textContent = '학교 선택 필요';
    directoryFavoriteBtn.disabled = true;
    directoryFavoriteBtn.textContent = '즐겨찾기 추가';
    directoryPreviewNote.textContent = '검색 결과가 없을 때는 전체 또는 최근 사용 필터로 다시 탐색하는 것이 가장 빠릅니다.';
    return;
  }

  const school = getPlatformMeta(directorySelectionId);
  const status = getSchoolStatusMeta(school.id);
  const favorite = favoriteSchoolIds.includes(school.id);

  directorySelectedStatus.className = `directory-status-chip ${status.className}`;
  directorySelectedStatus.textContent = status.label;
  directorySelectedLogo.className = `directory-preview-logo ${school.accentClass}`;
  directorySelectedLogo.textContent = school.shortName;
  directorySelectedName.textContent = school.name;
  directorySelectedSubtitle.textContent = school.description;
  directorySelectedTags.innerHTML = (school.capabilities || [])
    .map((item) => `<span class="preview-tag">${escapeHtml(item)}</span>`)
    .join('');
  directorySelectedHighlights.innerHTML = buildPreviewHighlights(school);
  directoryPrimaryAction.disabled = !school.available;
  directoryPrimaryAction.textContent = school.available
    ? getState(school.id).isLoggedIn
      ? currentPlatform === school.id
        ? '워크스페이스 열기'
        : '이 학교 열기'
      : '이 학교 연결하기'
    : '연동 준비 중';
  directoryFavoriteBtn.disabled = false;
  directoryFavoriteBtn.textContent = favorite ? '즐겨찾기 해제' : '즐겨찾기 추가';
  directoryFavoriteBtn.classList.toggle('active', favorite);
  directoryPreviewNote.textContent = buildPreviewNote(school);
}

function renderSchoolDirectory() {
  const filteredSchools = getFilteredSchools();
  ensureDirectorySelection(filteredSchools);

  directoryResultCount.textContent = schoolDirectoryQuery.trim()
    ? `검색 결과 ${filteredSchools.length}개`
    : `${filteredSchools.length}개 학교`;

  schoolDirectoryFilters.forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === schoolDirectoryFilter);
  });

  if (!filteredSchools.length) {
    schoolDirectorySections.innerHTML = buildEmptyStateCard(
      '일치하는 학교가 없습니다',
      '검색어를 조정하거나 필터를 전체로 변경해 다시 찾아보세요.'
    );
    renderDirectoryPreview([]);
    renderSchoolNavigation();
    return;
  }

  schoolDirectorySections.innerHTML = buildDirectorySections(filteredSchools)
    .map((section) => buildDirectorySectionHtml(section))
    .join('');

  renderDirectoryPreview(filteredSchools);
  renderSchoolNavigation();
}

function updatePlatformContext(univId) {
  const meta = getPlatformMeta(univId);

  if (selectedPlatformBadge) selectedPlatformBadge.textContent = meta.name;
  if (loginPlatformName) loginPlatformName.textContent = meta.loginTitle;
  if (loginPlatformHint) loginPlatformHint.textContent = meta.loginHint;
  if (loginUniv) loginUniv.value = univId;

  if (dashboardPlatformBadge) dashboardPlatformBadge.textContent = meta.name;
  if (scheduleModalTitle) scheduleModalTitle.textContent = `${meta.name} 시간표 요약`;
}

function setLoginLoading(isLoading) {
  loginBtn.disabled = isLoading;
  loginId.disabled = isLoading;
  loginPw.disabled = isLoading;
  loginBtn.querySelector('.btn-text').style.display = isLoading ? 'none' : '';
  loginBtn.querySelector('.btn-loader').style.display = isLoading ? 'flex' : 'none';
}

function setLoginStatus(message, type = '') {
  loginStatus.textContent = message || '';
  loginStatus.className = `status-msg ${type}`.trim();
}

function renderPlatformState(univId) {
  if (!isKnownSchool(univId)) {
    showSchoolDirectory();
    return;
  }

  currentPlatform = univId;
  setDirectorySelection(univId);
  renderSchoolNavigation();

  const state = getState(univId);
  if (!state.isLoggedIn) {
    setLoginLoading(false);
    setLoginStatus(state.loginStatus, state.loginStatusType);
    switchView('login-view');
    return;
  }

  switchView('dashboard-view');
  courseSearch.value = state.searchQuery || '';

  renderProgressState(univId);
  renderProfileSummary(univId);
  renderOverview(univId);
  renderCourseList(univId);
  renderUserInfo(state.userInfo);
  renderSchedulePreview(state.timetable || []);
  renderAssistantPanel(univId);
}

function renderProfileSummary(univId) {
  const state = getState(univId);
  const meta = getPlatformMeta(univId);
  const info = state.userInfo || {};
  const entries = getInfoEntries(info).filter(([key]) => !['name', 'studentId'].includes(key)).slice(0, 3);

  profileName.textContent = info.name || meta.name;
  profileDept.textContent = info.studentId || info.department || info.college || meta.loginHint;

  if (!entries.length) {
    profileMetaList.innerHTML = `
      <span class="profile-meta-chip">
        <strong>${state.isCrawling ? '동기화 중' : '연결됨'}</strong>
      </span>
    `;
    return;
  }

  profileMetaList.innerHTML = entries
    .map(
      ([key, value]) => `
        <span class="profile-meta-chip">
          ${escapeHtml(prettifyKey(key))}
          <strong>${escapeHtml(String(value).slice(0, 28))}</strong>
        </span>
      `
    )
    .join('');
}

function renderOverview(univId) {
  const state = getState(univId);
  const meta = getPlatformMeta(univId);
  const courses = state.courses || [];
  const syncedCourses = Object.keys(state.courseDataMap).length;
  const totalDetailItems = getTotalDetailItemCount(state.courseDataMap);
  const timetableCount = (state.timetable || []).length;

  overviewCourseCount.textContent = String(courses.length);
  overviewCourseCaption.textContent = courses.length
    ? `${courses.length}개 과목을 과목 카드로 바로 탐색할 수 있습니다.`
    : '과목 정보가 준비되면 가장 먼저 이 영역에 반영됩니다.';

  overviewSyncCount.textContent = `${syncedCourses} / ${courses.length}`;
  overviewSyncCaption.textContent = courses.length
    ? totalDetailItems
      ? `${totalDetailItems}개 세부 항목을 정리했습니다.`
      : state.isCrawling
        ? '과목별 세부 정보를 순차적으로 채우는 중입니다.'
        : '과목별 세부 정보가 아직 없습니다.'
    : '과목 상세 준비 전입니다.';

  overviewTimetableCount.textContent = String(timetableCount);
  overviewTimetableCaption.textContent = timetableCount
    ? `${timetableCount}개 시간표 항목을 일정 요약으로 제공합니다.`
    : '시간표 정보가 아직 수집되지 않았습니다.';

  if (state.lastSyncedAt) {
    overviewLastSync.textContent = formatRelativeTime(state.lastSyncedAt);
    overviewLastSyncCaption.textContent = `${formatAbsoluteTime(state.lastSyncedAt)} 기준으로 정리되었습니다.`;
  } else {
    overviewLastSync.textContent = state.isCrawling ? '진행 중' : '대기 중';
    overviewLastSyncCaption.textContent = state.isCrawling
      ? '첫 동기화를 진행하고 있습니다.'
      : '아직 동기화가 완료되지 않았습니다.';
  }

  dashboardGreeting.textContent = infoName(state.userInfo)
    ? `${infoName(state.userInfo)}님, 지금 필요한 학습 정보를 정리해드릴게요.`
    : `${meta.name} 학습 정보를 준비하고 있습니다.`;

  dashboardSummaryText.textContent = state.isCrawling
    ? '로그인 이후 과목, 공지, 자료, 일정 데이터를 단계적으로 수집하는 중입니다.'
    : courses.length
      ? `${courses.length}개 과목${timetableCount ? `과 ${timetableCount}개의 시간표 항목` : ''}이 정리되어 바로 탐색할 수 있습니다.`
      : meta.loginHint;
}

function renderProgressState(univId) {
  const state = getState(univId);
  let chipClass = 'neutral';
  let chipText = '연결 준비';

  if (state.isCrawling) {
    chipClass = 'in-progress';
    chipText = '동기화 진행';
  } else if (state.statusMsg.startsWith('❌')) {
    chipClass = 'error';
    chipText = '확인 필요';
  } else if (state.isLoggedIn) {
    chipClass = 'success';
    chipText = '준비 완료';
  }

  dashboardSyncState.className = `status-chip ${chipClass}`;
  dashboardSyncState.textContent = chipText;
}

function renderUserInfo(info) {
  const entries = getInfoEntries(info || {});

  if (!entries.length) {
    userInfoGrid.innerHTML = buildEmptyStateCard(
      '학생 정보가 아직 준비되지 않았습니다',
      '로그인 후 사용자 정보가 수집되면 이 영역에 정리됩니다.'
    );
    return;
  }

  userInfoGrid.innerHTML = entries
    .map(
      ([key, value]) => `
        <div class="info-item">
          <span class="info-label">${escapeHtml(prettifyKey(key))}</span>
          <span class="info-value">${escapeHtml(String(value).slice(0, 220))}</span>
        </div>
      `
    )
    .join('');
}

function renderCourseList(univId) {
  const state = getState(univId);
  const courses = state.courses || [];
  const query = (state.searchQuery || '').trim().toLowerCase();
  const filtered = courses
    .map((course, index) => ({ course, index, detail: state.courseDataMap[index] }))
    .filter(({ course }) => matchesCourseQuery(course, query));

  courseCount.textContent = String(courses.length);

  if (!courses.length) {
    courseSummary.textContent = state.isCrawling
      ? '과목 목록을 읽어오는 중입니다.'
      : '과목 데이터가 준비되면 이 영역이 가장 먼저 채워집니다.';
    courseGrid.innerHTML = buildEmptyStateCard(
      '아직 표시할 과목이 없습니다',
      '동기화가 진행되면 과목 카드와 세부 상태가 여기에 나타납니다.'
    );
    return;
  }

  courseSummary.textContent = query
    ? `${filtered.length} / ${courses.length}개 과목 표시 중`
    : state.isCrawling
      ? `${courses.length}개 과목을 찾았고 세부 정보를 이어서 채우는 중입니다.`
      : `${courses.length}개 과목을 바로 탐색할 수 있습니다.`;

  if (!filtered.length) {
    courseGrid.innerHTML = buildEmptyStateCard(
      '검색 결과가 없습니다',
      '과목명, 코드, 일정 키워드를 바꿔 다시 찾아보세요.'
    );
    return;
  }

  courseGrid.innerHTML = filtered
    .map(({ course, index, detail }) => {
      const metaPills = [course.code, course.schedule].filter(Boolean).slice(0, 3);
      const statsHtml = detail
        ? buildStatBadges(detail)
        : '<span class="course-stat"><span class="stat-dot"></span>세부 정보 동기화 중</span>';

      return `
        <button type="button" class="course-card" data-index="${index}">
          <div class="course-card-header">
            <div class="course-card-header-top">
              <span class="course-chip">${escapeHtml(course.term || getPlatformMeta(univId).name)}</span>
              <span class="course-sync ${detail ? 'ready' : 'pending'}">${detail ? '세부정보 준비됨' : '동기화 중'}</span>
            </div>
            <h4 class="course-name">${escapeHtml(course.name || `과목 ${index + 1}`)}</h4>
          </div>
          <div class="course-card-body">
            <p class="course-prof">${escapeHtml(buildCourseCaption(course))}</p>
            <div class="course-meta-row">
              ${metaPills
                .map((pill) => `<span class="course-meta-pill">${escapeHtml(String(pill))}</span>`)
                .join('')}
            </div>
            <div class="course-stats">${statsHtml}</div>
          </div>
        </button>
      `;
    })
    .join('');

  $$('.course-card').forEach((card) => {
    card.addEventListener('click', () => {
      const idx = Number(card.dataset.index);
      openCourseModal(idx, courses[idx]);
    });
  });
}

function renderSchedulePreview(timetable) {
  const items = normalizeTimetableEntries(timetable);

  if (!items.length) {
    schedulePreview.innerHTML = `
      <div class="schedule-preview-empty">
        시간표 정보가 아직 없습니다. 동기화가 끝나면 수업 일정 요약이 여기에 정리됩니다.
      </div>
    `;
    dailyTimeline.innerHTML = '<div class="empty-state">시간표 정보가 아직 준비되지 않았습니다.</div>';
    return;
  }

  schedulePreview.innerHTML = items
    .slice(0, 4)
    .map(
      (item) => `
        <div class="schedule-preview-item">
          <span class="schedule-preview-time">${escapeHtml(item.time)}</span>
          <span class="schedule-preview-title">${escapeHtml(item.subject)}</span>
          <span class="schedule-preview-meta">${escapeHtml(buildScheduleMeta(item))}</span>
        </div>
      `
    )
    .join('');

  renderDailyTimeline();
}

function renderDailyTimeline() {
  const state = currentPlatform ? getState(currentPlatform) : null;
  const items = normalizeTimetableEntries(state ? state.timetable : []);

  if (!items.length) {
    dailyTimeline.innerHTML = '<div class="empty-state">표시할 시간표 항목이 없습니다.</div>';
    return;
  }

  dailyTimeline.innerHTML = items
    .map(
      (item) => `
        <div class="timeline-item">
          <span class="timeline-time">${escapeHtml(item.time)}</span>
          <div class="timeline-title">${escapeHtml(item.subject)}</div>
          <div class="timeline-loc">${escapeHtml(buildScheduleMeta(item))}</div>
        </div>
      `
    )
    .join('');
}

function renderAssistantPanel(univId) {
  const state = getState(univId);
  ensureAssistantMessages(univId);

  aiSidebar.classList.toggle('collapsed', state.assistantCollapsed);
  assistantStatusText.textContent = state.isCrawling
    ? '동기화 중인 데이터를 바탕으로 요약을 준비합니다.'
    : '과목과 일정 기반으로 빠르게 답을 찾을 수 있습니다.';

  mainAiChat.innerHTML = state.assistantMessages
    .map(
      (message) => `
        <div class="chat-msg ${message.role === 'user' ? 'user' : 'ai'}">
          ${escapeHtml(message.text)}
        </div>
      `
    )
    .join('');

  requestAnimationFrame(() => {
    mainAiChat.scrollTop = mainAiChat.scrollHeight;
  });
}

function ensureAssistantMessages(univId) {
  const state = getState(univId);
  if (state.assistantMessages.length) return;

  state.assistantMessages.push({
    role: 'ai',
    text: `${getPlatformMeta(univId).name} 연결이 완료되면 GPT 기반으로 과목, 일정, 공지 요약을 도와드릴 수 있어요.`,
  });
}

function openCourseModal(index, course) {
  const detail = currentPlatform ? getState(currentPlatform).courseDataMap[index] : null;
  const defaultTab = getDefaultCourseTab(detail);

  activeCourseContext = { course, detail, chatMessages: [] };
  modalTitle.textContent = course && course.name ? course.name : '과목 상세';
  window.currentCourseKey = course ? course.kjKey : '';

  renderModalTabs(detail, defaultTab);
  renderTab(defaultTab, detail || {}, course || {});
  modalOverlay.classList.add('open');
}

function renderModalTabs(detail, activeTab) {
  $$('.modal-tabs .tab').forEach((tab) => {
    const tabName = tab.dataset.tab;
    const available = tabName === 'ai' || Boolean(detail && Array.isArray(detail[tabName]) && detail[tabName].length);
    tab.classList.toggle('active', tabName === activeTab);
    tab.classList.toggle('disabled', !available);
    tab.onclick = () => {
      renderModalTabs(detail, tabName);
      renderTab(tabName, detail || {}, activeCourseContext ? activeCourseContext.course : {});
    };
  });
}

function getDefaultCourseTab(detail) {
  if (!detail) return 'ai';
  if (Array.isArray(detail.plan) && detail.plan.length) return 'plan';
  const fallback = DETAIL_TABS.find((item) => Array.isArray(detail[item.key]) && detail[item.key].length);
  return fallback ? fallback.key : 'ai';
}

function renderTab(tabName, detail, course) {
  if (tabName === 'ai') {
    const chatMessages = activeCourseContext && Array.isArray(activeCourseContext.chatMessages)
      ? activeCourseContext.chatMessages
      : [];
    const chatHtml = chatMessages.length
      ? chatMessages
          .map(
            (message) => `<div class="chat-msg ${message.role === 'user' ? 'user' : 'ai'}">${escapeHtml(message.text)}</div>`
          )
          .join('')
      : `<div class="chat-msg ai">${escapeHtml(buildInitialCourseAssistantGreeting(course, detail))}</div>`;

    modalBody.innerHTML = `
      <div class="modal-body">
        <div id="modal-ai-chat" class="ai-chat-body">
          ${chatHtml}
        </div>
        <form id="modal-ai-form" autocomplete="off">
          <input type="text" id="modal-ai-input" placeholder="예: 이 과목에서 공지가 얼마나 있어?">
          <button type="submit" class="icon-submit-btn" aria-label="과목 질문 전송">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    `;

    const form = $('#modal-ai-form');
    const input = $('#modal-ai-input');
    const chat = $('#modal-ai-chat');
    input.dataset.defaultPlaceholder = '예: 이 과목에서 공지가 얼마나 있어?';

    form.onsubmit = async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      const history = buildConversationHistory(chatMessages);
      const courseContext = activeCourseContext || { course, detail, chatMessages };

      courseContext.chatMessages.push({ role: 'user', text });
      chat.insertAdjacentHTML('beforeend', `<div class="chat-msg user">${escapeHtml(text)}</div>`);
      input.value = '';
      chat.scrollTop = chat.scrollHeight;

      setInlineAiFormPending(form, input, true);

      try {
        const result = await requestAiReply(buildCourseAiPayload(course, detail, text, history));
        const reply = result && result.ok
          ? result.text
          : buildAiErrorMessage(result && result.error, buildCourseAssistantReply(text, course, detail));
        courseContext.chatMessages.push({ role: 'ai', text: reply });
        chat.insertAdjacentHTML('beforeend', `<div class="chat-msg ai">${escapeHtml(reply)}</div>`);
        chat.scrollTop = chat.scrollHeight;
      } catch (error) {
        const reply = buildAiErrorMessage(error && error.message, buildCourseAssistantReply(text, course, detail));
        courseContext.chatMessages.push({ role: 'ai', text: reply });
        chat.insertAdjacentHTML('beforeend', `<div class="chat-msg ai">${escapeHtml(reply)}</div>`);
        chat.scrollTop = chat.scrollHeight;
      } finally {
        setInlineAiFormPending(form, input, false);
      }
    };
    return;
  }

  const data = Array.isArray(detail[tabName]) ? detail[tabName] : [];
  if (!data.length) {
    modalBody.innerHTML = '<div class="empty-state">이 탭에 표시할 데이터가 아직 없습니다.</div>';
    return;
  }

  modalBody.innerHTML = buildTable([], data);
  modalBody.querySelectorAll('.clickable-row').forEach((row) => {
    row.addEventListener('click', () => {
      const title = row.getAttribute('data-title') || '상세 보기';
      const encodedLink = row.getAttribute('data-link') || '';
      let link = '';
      try {
        link = encodedLink ? decodeURIComponent(encodedLink) : '';
      } catch (_) {
        link = encodedLink;
      }
      if (link) openDetailModal(title, link, window.currentCourseKey);
    });
  });
}

function buildTable(headers, rows) {
  if (!rows || !rows.length) return '';

  const cards = rows
    .map((row) => {
      const cells = Array.isArray(row) ? row : row.cells || [];
      const title = !Array.isArray(row) && row.title ? escapeHtml(row.title) : '';
      const content = cells
        .map((cell, index) => {
          if (cell === null || cell === undefined) return '';
          const trimmed = String(cell).trim();
          if (trimmed === '' || trimmed === '-') return '';
          if (row.title && trimmed === String(row.title).trim()) return '';
          const label = headers && headers[index] ? headers[index] : '';
          return `
            <div class="card-row">
              ${label ? `<span class="card-label">${escapeHtml(label)}</span>` : ''}
              <span class="card-value">${formatCellValue(cell, label)}</span>
            </div>
          `;
        })
        .filter(Boolean)
        .join('');

      if (!Array.isArray(row) && row.link) {
        const encodedLink = encodeURIComponent(row.link);
        return `
          <div class="data-card clickable-row" data-title="${title}" data-link="${encodedLink}">
            ${title ? `<div class="card-title">${title}</div>` : ''}
            ${content}
          </div>
        `;
      }

      return `
        <div class="data-card">
          ${title ? `<div class="card-title">${title}</div>` : ''}
          ${content}
        </div>
      `;
    })
    .join('');

  return `<div class="data-card-grid">${cards}</div>`;
}

function formatCellValue(cell, label) {
  if (cell === null || cell === undefined || String(cell).trim() === '' || String(cell).trim() === '-') return '';

  const value = String(cell).trim();
  const normalizedLabel = String(label || '').toLowerCase();

  if (normalizedLabel.includes('출석')) return formatAttendance(value);
  if (normalizedLabel.includes('상태') || normalizedLabel.includes('제출') || looksLikeStatusValue(value)) {
    return formatStatus(value);
  }

  return escapeHtml(value).replace(/\n/g, '<br>');
}

function looksLikeStatusValue(value) {
  return ['제출', '완료', '미제출', '미완', '지각', '결석', '출석'].some((token) => value.includes(token));
}

async function openDetailModal(title, url, courseKey) {
  detailTitle.textContent = title || '상세 내용';
  detailContent.style.display = 'none';
  detailLoading.style.display = 'block';
  detailModal.classList.add('open');

  const res = await window.api.invoke('fetch-detail', { univId: currentPlatform, url, courseKey });
  const contentHtml =
    res && typeof res.html === 'string'
      ? res.html
      : '<p style="padding:20px;text-align:center;">불러오지 못했습니다.</p>';

  detailLoading.style.display = 'none';
  detailContent.style.display = 'block';
  detailContent.innerHTML = `<div class="detail-body">${contentHtml}</div>`;
}

function closeDetailModal() {
  detailModal.classList.remove('open');
}

function openScheduleModal() {
  renderDailyTimeline();
  scheduleModal.classList.add('open');
}

function closeScheduleModal() {
  scheduleModal.classList.remove('open');
}

function buildStatBadges(detail) {
  const badges = DETAIL_TABS
    .map((item) => ({ ...item, count: Array.isArray(detail[item.key]) ? detail[item.key].length : 0 }))
    .filter((item) => item.count > 0)
    .slice(0, 5);

  if (!badges.length) {
    return '<span class="course-stat"><span class="stat-dot"></span>세부 항목 준비 전</span>';
  }

  return badges
    .map(
      (item) => `
        <span class="course-stat">
          <span class="stat-dot"></span>
          ${escapeHtml(item.label)} ${item.count}
        </span>
      `
    )
    .join('');
}

function buildDashboardAssistantReply(prompt, state) {
  const question = prompt.toLowerCase();
  const courses = state.courses || [];
  const timetable = normalizeTimetableEntries(state.timetable || []);

  if (!state.isLoggedIn) {
    return '먼저 로그인하면 현재 학습 데이터 기준으로 더 정확하게 안내해드릴 수 있어요.';
  }

  if (state.isCrawling) {
    return '아직 동기화 중입니다. 조금만 기다리면 과목과 일정 기준으로 더 정확한 요약을 드릴게요.';
  }

  if (question.includes('시간표') || question.includes('일정')) {
    return timetable.length
      ? `현재 시간표에는 ${timetable.length}개 항목이 있습니다. ${summarizeSchedule(timetable, 3)}`
      : '수집된 시간표 항목이 아직 없습니다.';
  }

  if (question.includes('과목') || question.includes('수업')) {
    return courses.length
      ? `현재 연결된 과목은 ${courses.length}개입니다. ${courses.slice(0, 5).map((course) => course.name).filter(Boolean).join(', ')}${courses.length > 5 ? ' 등으로 구성되어 있어요.' : '입니다.'}`
      : '아직 과목 목록이 준비되지 않았습니다.';
  }

  if (question.includes('공지')) {
    const totalNotices = sumDetailCounts(state.courseDataMap, 'notices');
    return totalNotices
      ? `현재 집계된 공지사항은 총 ${totalNotices}개입니다. 과목 카드를 열면 과목별 공지를 더 자세히 볼 수 있어요.`
      : '공지사항 데이터가 아직 준비되지 않았습니다.';
  }

  if (question.includes('자료') || question.includes('강의자료')) {
    const totalMaterials = sumDetailCounts(state.courseDataMap, 'materials');
    return totalMaterials
      ? `강의자료는 현재 ${totalMaterials}개 항목이 정리되어 있습니다.`
      : '강의자료 항목은 아직 준비되지 않았습니다.';
  }

  if (question.includes('상태') || question.includes('동기화')) {
    const syncedCourses = Object.keys(state.courseDataMap).length;
    return `현재 ${courses.length}개 과목 중 ${syncedCourses}개 과목의 세부 정보가 준비되어 있습니다.`;
  }

  return courses.length
    ? `${courses.length}개 과목과 ${timetable.length}개의 시간표 항목이 연결되어 있습니다. 과목, 일정, 공지, 자료 중 궁금한 주제를 바로 물어보세요.`
    : '과목이나 일정이 준비되면 더 구체적으로 도와드릴 수 있어요. 지금은 연결 상태를 먼저 확인해보세요.';
}

function buildInitialCourseAssistantGreeting(course, detail) {
  const name = course && course.name ? course.name : '이 과목';
  if (!detail || !getTotalDetailCount(detail)) {
    return `${name} 기준으로 먼저 답해볼게요. 세부 탭이 적어도 현재 과목 정보와 동기화된 항목으로 최대한 안내합니다.`;
  }
  return `${name}의 공지, 자료, 과제 현황을 바탕으로 요약해드릴 수 있어요.`;
}

function buildCourseTabFallbackReply(detail, key, label, courseName) {
  const count = countTabItems(detail, key);
  const samples = summarizeCourseRows(detail && detail[key], 2);
  return `${courseName} ${label}은 ${count}개입니다${samples.length ? `. 예: ${samples.join(' / ')}` : '.'}`;
}

function buildCourseAssistantReply(prompt, course, detail) {
  const question = prompt.toLowerCase();
  const courseName = course && course.name ? course.name : '이 과목';
  const courseMeta = [course && course.code, course && course.schedule, course && course.term].filter(Boolean).join(' · ');
  const tabSummary = buildCourseTabSummary(detail);

  if (!detail || !getTotalDetailCount(detail)) {
    if (question.includes('일정') || question.includes('시간')) {
      return course && course.schedule
        ? `${courseName}의 현재 표시 일정은 ${course.schedule}입니다.`
        : `${courseName}는 ${courseMeta || '기본 과목 정보'} 기준으로 확인할 수 있습니다.`;
    }

    return courseMeta
      ? `${courseName}는 ${courseMeta} 과목입니다. 세부 탭이 적어도 현재 보이는 정보 기준으로 계속 답할 수 있어요.`
      : `${courseName}의 세부 탭은 적지만 현재 보이는 과목 정보 기준으로는 계속 답할 수 있어요.`;
  }

  if (question.includes('공지')) {
    return buildCourseTabFallbackReply(detail, 'notices', '공지사항', courseName);
  }
  if (question.includes('자료')) {
    return buildCourseTabFallbackReply(detail, 'materials', '강의자료', courseName);
  }
  if (question.includes('과제') || question.includes('프로젝트')) {
    return buildCourseTabFallbackReply(detail, 'projects', '과제/프로젝트', courseName);
  }
  if (question.includes('시험') || question.includes('퀴즈')) {
    return buildCourseTabFallbackReply(detail, 'tests', '시험/퀴즈', courseName);
  }
  if (question.includes('질문') || question.includes('qna')) {
    return buildCourseTabFallbackReply(detail, 'qna', '질의응답', courseName);
  }

  return tabSummary.length
    ? `${courseName}에서는 ${tabSummary.slice(0, 4).map((item) => `${item.label} ${item.count}개`).join(', ')}를 확인할 수 있습니다.`
    : `${courseName}에서는 ${getTotalDetailCount(detail)}개의 세부 항목이 정리되어 있습니다.`;
}

function buildConversationHistory(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message && message.text)
    .slice(-6)
    .map((message) => ({
      role: message.role === 'assistant' || message.role === 'ai' ? 'assistant' : 'user',
      text: String(message.text),
    }));
}

function buildAiErrorMessage(errorMessage, fallbackText) {
  const base = errorMessage
    ? `GPT API를 호출하지 못했습니다. ${String(errorMessage)}`
    : 'GPT API를 호출하지 못했습니다.';
  return fallbackText ? `${base}\n\n대체 요약:\n${fallbackText}` : base;
}

function requestAiReply(payload) {
  return window.api.invoke('generate-ai-response', payload);
}

function setInlineAiFormPending(form, input, isPending) {
  if (!form || !input) return;
  const submitButton = form.querySelector('button[type="submit"]');
  input.disabled = isPending;
  if (submitButton) submitButton.disabled = isPending;
  input.placeholder = isPending ? '답변 생성 중...' : input.dataset.defaultPlaceholder || input.placeholder;
}

function buildDashboardAiPayload(univId, prompt, history) {
  const state = getState(univId);
  const meta = getPlatformMeta(univId);

  return {
    scope: 'dashboard',
    prompt,
    history,
    school: {
      id: meta.id,
      name: meta.name,
      connectorLabel: meta.connectorLabel,
      typeLabel: meta.typeLabel,
    },
    context: {
      user: summarizeUserInfo(state.userInfo),
      sync: {
        isLoggedIn: state.isLoggedIn,
        isCrawling: state.isCrawling,
        progress: state.progress,
        statusMessage: state.statusMsg,
        lastSyncedAt: state.lastSyncedAt,
      },
      counts: {
        courses: (state.courses || []).length,
        syncedCourses: Object.keys(state.courseDataMap || {}).length,
        timetable: (state.timetable || []).length,
        notices: sumDetailCounts(state.courseDataMap, 'notices'),
        materials: sumDetailCounts(state.courseDataMap, 'materials'),
        projects: sumDetailCounts(state.courseDataMap, 'projects'),
        tests: sumDetailCounts(state.courseDataMap, 'tests'),
      },
      courses: (state.courses || []).slice(0, 10).map((course) => ({
        name: course.name,
        code: course.code,
        schedule: course.schedule,
        term: course.term,
      })),
      timetable: normalizeTimetableEntries(state.timetable || []).slice(0, 8),
    },
  };
}

function buildCourseAiPayload(course, detail, prompt, history) {
  const meta = getPlatformMeta(currentPlatform || directorySelectionId);
  const tabSummary = buildCourseTabSummary(detail);

  return {
    scope: 'course',
    prompt,
    history,
    school: {
      id: meta.id,
      name: meta.name,
      connectorLabel: meta.connectorLabel,
      typeLabel: meta.typeLabel,
    },
    context: {
      course: buildCourseMetaSnapshot(course),
      detailStatus: {
        totalItems: getTotalDetailCount(detail),
        availableTabCount: tabSummary.length,
        availableTabs: tabSummary.map((item) => item.label),
      },
      tabSummary,
    },
  };
}

function summarizeUserInfo(info) {
  const entries = getInfoEntries(info || {}).slice(0, 8);
  return Object.fromEntries(entries.map(([key, value]) => [key, truncateText(value, 80)]));
}

function buildCourseMetaSnapshot(course) {
  const entries = Object.entries(course || {}).filter(([, value]) => value && typeof value !== 'object');
  return Object.fromEntries(entries.slice(0, 10).map(([key, value]) => [key, truncateText(value, 120)]));
}

function extractTextFragments(value, depth = 0) {
  if (value === null || value === undefined || depth > 2) return [];

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).replace(/\s+/g, ' ').trim();
    return text ? [text] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractTextFragments(item, depth + 1)).slice(0, 12);
  }

  if (typeof value === 'object') {
    const preferredKeys = ['title', 'name', 'subject', 'text', 'label', 'status', 'author', 'date', 'time'];
    const preferred = preferredKeys.flatMap((key) => extractTextFragments(value[key], depth + 1));
    if (preferred.length) return preferred.slice(0, 12);
    return Object.values(value).flatMap((item) => extractTextFragments(item, depth + 1)).slice(0, 12);
  }

  return [];
}

function summarizeCourseRows(rows, rowLimit = 4) {
  if (!Array.isArray(rows)) return [];

  return rows
    .slice(0, rowLimit)
    .map((row) => {
      const fragments = [...new Set(extractTextFragments(row))].slice(0, 4);
      return fragments.length ? truncateText(fragments.join(' · '), 180) : '';
    })
    .filter(Boolean)
    .slice(0, rowLimit);
}

function buildCourseTabSummary(detail) {
  return DETAIL_TABS.map((item) => ({
    key: item.key,
    label: item.label,
    count: countTabItems(detail, item.key),
    samples: summarizeCourseRows(detail && detail[item.key], item.key === 'plan' ? 2 : 4),
  })).filter((item) => item.count > 0 || item.samples.length > 0);
}

function normalizeTimetableEntries(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => ({
      time: item && item.time ? String(item.time).trim() : `시간표 ${index + 1}`,
      subject: item && (item.subject || item.title || item.name) ? String(item.subject || item.title || item.name).trim() : `과목 ${index + 1}`,
      professor: item && item.professor ? String(item.professor).trim() : '',
      room: item && (item.room || item.location || item.place) ? String(item.room || item.location || item.place).trim() : '',
    }))
    .filter((item) => item.time || item.subject || item.professor || item.room);
}

function buildScheduleMeta(item) {
  return [item.professor, item.room].filter(Boolean).join(' · ') || '장소 정보 없음';
}

function summarizeSchedule(items, limit) {
  return items
    .slice(0, limit)
    .map((item) => `${item.time} ${item.subject}`)
    .join(', ');
}

function matchesCourseQuery(course, query) {
  if (!query) return true;
  return [course.name, course.code, course.schedule, course.term]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function buildCourseCaption(course) {
  return [course.code, course.schedule, course.term].filter(Boolean).join(' · ') || '세부 일정 정보가 없습니다.';
}

function truncateText(value, maxLen = 80) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

function getInfoEntries(info) {
  const skipKeys = ['_pageTitle', '_bodyText', '_mainText', 'rawHeaderText', 'error'];
  return Object.entries(info || {}).filter(
    ([key, value]) => !skipKeys.includes(key) && !key.startsWith('_') && value && String(value).trim()
  );
}

function buildEmptyStateCard(title, description) {
  return `
    <div class="empty-state-card">
      <div class="empty-title">${escapeHtml(title)}</div>
      <div class="empty-desc">${escapeHtml(description)}</div>
    </div>
  `;
}

function getTotalDetailItemCount(detailsMap) {
  return Object.values(detailsMap || {}).reduce((total, detail) => total + getTotalDetailCount(detail), 0);
}

function getTotalDetailCount(detail) {
  if (!detail) return 0;
  return DETAIL_TABS.reduce((total, item) => total + countTabItems(detail, item.key), 0);
}

function countTabItems(detail, key) {
  return Array.isArray(detail && detail[key]) ? detail[key].length : 0;
}

function sumDetailCounts(detailsMap, key) {
  return Object.values(detailsMap || {}).reduce((total, detail) => total + countTabItems(detail, key), 0);
}

function inferProgress(message) {
  if (!message) return 0;
  if (message.includes('로그인')) return 8;
  if (message.includes('입력') || message.includes('인증')) return 15;
  if (message.includes('메인 페이지') || message.includes('사용자 및 수강 과목')) return 28;
  if (message.includes('수강 과목') || message.includes('과목을 가져오는 중')) return 35;
  if (message.includes('발견')) return 42;
  if (message.includes('과목 상세')) {
    const match = message.match(/\((\d+)\/(\d+)\)/);
    if (match) {
      const current = Number(match[1]);
      const total = Number(match[2]) || 1;
      return 42 + Math.round((current / total) * 50);
    }
    return 70;
  }
  if (message.includes('완료')) return 100;
  return 18;
}

function formatStatus(status) {
  if (!status) return '-';
  const value = String(status).trim();
  if (value.includes('미제출') || value.includes('미완')) {
    return `<span class="status-badge pending">○ ${escapeHtml(value)}</span>`;
  }
  if (value.includes('지각') || value.includes('초과') || value.includes('결석')) {
    return `<span class="status-badge late">! ${escapeHtml(value)}</span>`;
  }
  if (value.includes('제출') || value.includes('완료') || value.includes('출석')) {
    return `<span class="status-badge done">✓ ${escapeHtml(value)}</span>`;
  }
  return escapeHtml(value);
}

function formatAttendance(status) {
  if (!status) return '-';
  const value = String(status).trim();
  if (value.includes('결석')) return '<span class="status-badge late">✕ 결석</span>';
  if (value.includes('지각')) return '<span class="status-badge pending">△ 지각</span>';
  if (value.includes('출석')) return '<span class="status-badge done">✓ 출석</span>';
  return escapeHtml(value);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, (char) => map[char]);
}

function prettifyKey(key) {
  const dictionary = {
    name: '이름',
    studentId: '학번',
    department: '소속',
    college: '단과대',
    major: '전공',
    profileImage: '프로필 이미지',
  };

  if (dictionary[key]) return dictionary[key];
  return key
    .replace(/^field_/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}

function formatRelativeTime(value) {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return '기록 없음';

  const diffMs = Date.now() - target.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  const diffDay = Math.round(diffHour / 24);
  return `${diffDay}일 전`;
}

function formatAbsoluteTime(value) {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return '시간 정보 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(target);
}

function infoName(info) {
  return info && info.name ? String(info.name).trim() : '';
}

schoolSwitcherTrigger.addEventListener('click', () => {
  showSchoolDirectory({ focusSearch: true });
});

schoolDirectoryHomeBtn.addEventListener('click', () => {
  showSchoolDirectory({ focusSearch: currentViewId !== 'home-view' });
});

backToHomeBtn.addEventListener('click', () => {
  showSchoolDirectory({ alignSelection: false });
});

schoolDirectorySearch.addEventListener('input', () => {
  schoolDirectoryQuery = schoolDirectorySearch.value;
  if (currentViewId !== 'home-view') {
    switchView('home-view');
  }
  renderSchoolDirectory();
});

schoolDirectoryFilters.forEach((button) => {
  button.addEventListener('click', () => {
    schoolDirectoryFilter = button.dataset.filter || 'all';
    renderSchoolDirectory();
  });
});

navQuickSchools.addEventListener('click', (event) => {
  const target = event.target.closest('[data-school-id]');
  if (!target) return;
  openPlatform(target.dataset.schoolId);
});

schoolDirectorySections.addEventListener('click', (event) => {
  const target = event.target.closest('[data-school-action]');
  if (!target) return;

  const schoolId = target.dataset.schoolId;
  const action = target.dataset.schoolAction;
  if (!isKnownSchool(schoolId)) return;

  if (action === 'select') {
    setDirectorySelection(schoolId);
    renderSchoolDirectory();
    return;
  }

  if (action === 'favorite') {
    toggleFavoriteSchool(schoolId);
    return;
  }

  if (action === 'open') {
    openPlatform(schoolId);
  }
});

directoryPrimaryAction.addEventListener('click', () => {
  if (directorySelectionId) {
    openPlatform(directorySelectionId);
  }
});

directoryFavoriteBtn.addEventListener('click', () => {
  if (directorySelectionId) {
    toggleFavoriteSchool(directorySelectionId);
  }
});

btnLogout.addEventListener('click', () => {
  const targetPlatform = currentPlatform || directorySelectionId;
  if (!targetPlatform) return;
  if (!confirm('현재 플랫폼 연결을 해제하시겠습니까? 로컬 세션만 종료됩니다.')) return;

  window.api.send('logout', targetPlatform);
  platformState[targetPlatform] = createEmptyPlatformState();
  renderPlatformState(targetPlatform);
});

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const univId = currentPlatform || directorySelectionId;
  const id = loginId.value.trim();
  const pw = loginPw.value.trim();
  if (!isKnownSchool(univId) || !id || !pw) return;

  currentPlatform = univId;
  setDirectorySelection(univId);
  recordRecentSchool(univId);

  const state = getState(univId);
  state.loginStatus = '로그인 시도 중입니다...';
  state.loginStatusType = 'info';
  state.statusMsg = '로그인 시도 중...';
  state.progress = 8;

  setLoginLoading(true);
  setLoginStatus(state.loginStatus, state.loginStatusType);
  renderSchoolNavigation();
  window.api.send('login', { univId, id, pw });
});

courseSearch.addEventListener('input', () => {
  if (!currentPlatform) return;
  const state = getState(currentPlatform);
  state.searchQuery = courseSearch.value;
  renderCourseList(currentPlatform);
});

toggleSidebarBtn.addEventListener('click', () => {
  if (!currentPlatform) return;
  const state = getState(currentPlatform);
  state.assistantCollapsed = !state.assistantCollapsed;
  renderAssistantPanel(currentPlatform);
  if (!state.assistantCollapsed) {
    setTimeout(() => mainAiInput.focus(), 50);
  }
});

closeSidebarBtn.addEventListener('click', () => {
  if (!currentPlatform) return;
  getState(currentPlatform).assistantCollapsed = true;
  renderAssistantPanel(currentPlatform);
});

mainAiForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const univId = currentPlatform;
  if (!univId) return;

  const text = mainAiInput.value.trim();
  if (!text) return;

  const state = getState(univId);
  ensureAssistantMessages(univId);
  const history = buildConversationHistory(state.assistantMessages);
  state.assistantCollapsed = false;
  state.assistantMessages.push({ role: 'user', text });
  mainAiInput.value = '';
  renderAssistantPanel(univId);

  mainAiInput.dataset.defaultPlaceholder = '예: 오늘 일정 요약해줘';
  setInlineAiFormPending(mainAiForm, mainAiInput, true);

  try {
    const result = await requestAiReply(buildDashboardAiPayload(univId, text, history));
    const reply = result && result.ok
      ? result.text
      : buildAiErrorMessage(result && result.error, buildDashboardAssistantReply(text, state));
    state.assistantMessages.push({ role: 'ai', text: reply });
  } catch (error) {
    state.assistantMessages.push({
      role: 'ai',
      text: buildAiErrorMessage(error && error.message, buildDashboardAssistantReply(text, state)),
    });
  } finally {
    setInlineAiFormPending(mainAiForm, mainAiInput, false);
    if (currentPlatform === univId) {
      renderAssistantPanel(univId);
    }
  }
});

modalClose.onclick = () => modalOverlay.classList.remove('open');
modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) modalOverlay.classList.remove('open');
});

detailClose.onclick = closeDetailModal;
detailModal.addEventListener('click', (event) => {
  if (event.target === detailModal) closeDetailModal();
});

toggleScheduleBtn.addEventListener('click', openScheduleModal);
openScheduleInlineBtn.addEventListener('click', openScheduleModal);
scheduleCloseBtn.addEventListener('click', closeScheduleModal);
scheduleModal.addEventListener('click', (event) => {
  if (event.target === scheduleModal) closeScheduleModal();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (detailModal.classList.contains('open')) closeDetailModal();
  else if (scheduleModal.classList.contains('open')) closeScheduleModal();
  else if (modalOverlay.classList.contains('open')) modalOverlay.classList.remove('open');
});

window.api.receive('saved-login-info', (info) => {
  if (info.id) loginId.value = info.id;
  if (info.pw) loginPw.value = info.pw;
});

window.api.receive('login-success', (payload) => {
  const univId = payload ? payload.univId : currentPlatform || directorySelectionId;
  if (!isKnownSchool(univId)) return;

  const state = getState(univId);
  currentPlatform = univId;
  setDirectorySelection(univId);
  recordRecentSchool(univId);
  state.isLoggedIn = true;
  state.isCrawling = true;
  state.progress = 10;
  state.statusMsg = '로그인 성공! 동기화를 시작합니다.';
  state.loginStatus = '연결 성공. 데이터를 가져오는 중입니다.';
  state.loginStatusType = 'success';

  setLoginLoading(false);
  renderPlatformState(univId);
});

window.api.receive('login-fail', (payload) => {
  const univId = payload ? payload.univId : currentPlatform || directorySelectionId;
  if (!isKnownSchool(univId)) return;

  const state = getState(univId);
  state.isLoggedIn = false;
  state.isCrawling = false;
  state.progress = 0;
  state.statusMsg = '';
  state.loginStatus = '로그인에 실패했습니다. 아이디와 비밀번호를 다시 확인해 주세요.';
  state.loginStatusType = 'error';

  if (univId === currentPlatform || univId === directorySelectionId) {
    setLoginLoading(false);
    setLoginStatus(state.loginStatus, state.loginStatusType);
    renderSchoolNavigation();
  }
});

window.api.receive('logout-success', (payload) => {
  const univId = payload && payload.univId;
  if (!isKnownSchool(univId)) return;

  platformState[univId] = createEmptyPlatformState();
  currentPlatform = univId;
  setDirectorySelection(univId);
  renderPlatformState(univId);
  renderSchoolDirectory();
});

window.api.receive('crawl-progress', (payload) => {
  let univId = currentPlatform;
  let message = payload;

  if (payload && typeof payload === 'object') {
    univId = payload.univId || currentPlatform;
    message = payload.message || '';
  }

  if (!isKnownSchool(univId) || !message) return;

  const state = getState(univId);
  state.isLoggedIn = true;
  state.isCrawling = !message.includes('완료');
  state.statusMsg = message;
  state.progress = inferProgress(message);

  if (univId === currentPlatform) {
    renderProgressState(univId);
    renderOverview(univId);
    renderProfileSummary(univId);
    renderSchoolNavigation();
  }

  if (currentViewId === 'home-view' || directorySelectionId === univId) {
    renderSchoolDirectory();
  }
});

window.api.receive('user-info', (payload) => {
  const { univId, info } = payload || {};
  if (!isKnownSchool(univId) || !info) return;

  getState(univId).userInfo = info;
  if (univId === currentPlatform) {
    renderProfileSummary(univId);
    renderUserInfo(info);
    renderOverview(univId);
  }
});

window.api.receive('course-list', (payload) => {
  const { univId, courses } = payload || {};
  if (!isKnownSchool(univId)) return;

  getState(univId).courses = Array.isArray(courses) ? courses : [];
  if (univId === currentPlatform) {
    renderCourseList(univId);
    renderOverview(univId);
  }
});

window.api.receive('course-detail', (payload) => {
  const { univId, index, detail } = payload || {};
  if (!isKnownSchool(univId) || index === undefined || !detail) return;

  getState(univId).courseDataMap[index] = detail;
  if (univId === currentPlatform) {
    renderCourseList(univId);
    renderOverview(univId);
  }
});

window.api.receive('crawl-complete', (payload) => {
  const { univId, data } = payload || {};
  if (!isKnownSchool(univId)) return;

  const state = getState(univId);
  state.isCrawling = false;
  state.progress = 100;
  state.statusMsg = '모든 데이터를 불러왔습니다.';
  state.lastSyncedAt = data && data.crawledAt ? data.crawledAt : new Date().toISOString();
  state.timetable = Array.isArray(data && data.timetable) ? data.timetable : state.timetable;
  state.userInfo = data && data.userInfo ? data.userInfo : state.userInfo;
  state.courses = Array.isArray(data && data.courses) ? data.courses : state.courses;

  if (univId === currentPlatform) {
    renderPlatformState(univId);
  }

  if (currentViewId === 'home-view' || directorySelectionId === univId) {
    renderSchoolDirectory();
  }
});

window.api.receive('crawl-error', (payload) => {
  const { univId, error } = payload || {};
  if (!isKnownSchool(univId)) return;

  const state = getState(univId);
  state.isCrawling = false;
  state.statusMsg = `❌ ${error || '알 수 없는 오류가 발생했습니다.'}`;

  if (univId === currentPlatform) {
    renderProgressState(univId);
    renderOverview(univId);
    renderSchoolNavigation();
  }

  if (currentViewId === 'home-view' || directorySelectionId === univId) {
    renderSchoolDirectory();
  }
});

window.addEventListener('resize', syncChromeHeight);

if (typeof ResizeObserver !== 'undefined' && schoolNavBar) {
  const navResizeObserver = new ResizeObserver(() => syncChromeHeight());
  navResizeObserver.observe(schoolNavBar);
}

setDirectorySelection(directorySelectionId, { persist: false });
switchView('home-view');
renderSchoolDirectory();
