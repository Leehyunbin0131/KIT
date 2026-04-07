const LmsAdapter = require('../LmsAdapter');
const { BrowserWindow } = require('electron');

class KmoocLms extends LmsAdapter {
  constructor() {
    super('https://www.kmooc.kr');
  }

  async executeInBrowser(code) {
    if (!this.crawlWin || this.crawlWin.isDestroyed()) {
      throw new Error('Crawler window goes offline');
    }
    return await this.crawlWin.webContents.executeJavaScript(code);
  }

  async login(credentials) {
    this.logProgress('K-MOOC 로그인 시도 중...');

    return new Promise((resolve) => {
      let resolved = false;

      const loginWin = new BrowserWindow({
        width: 1000,
        height: 800,
        show: true,
        title: 'K-MOOC - 로그인 및 인증 진행 중',
        autoHideMenuBar: true,
      });

      const done = (success) => {
        if (resolved) return;
        resolved = true;
        try { loginWin.close(); } catch (_) {}
        resolve(success);
      };

      // K-MOOC login page
      loginWin.loadURL('https://www.kmooc.kr/login');

      loginWin.webContents.on('did-finish-load', async () => {
        const url = loginWin.webContents.getURL();

        // If redirected to dashboard or main page after login
        if (url.includes('/dashboard') || url.includes('lms.kmooc.kr') || (url.startsWith('https://www.kmooc.kr/') && url.length < 30 && !url.includes('login'))) {
          done(true);
        }

        // Try auto-fill for standard login if not SNS
        try {
          await loginWin.webContents.executeJavaScript(`
            (function() {
              var idEl = document.querySelector('#userid') || document.querySelector('#login-email') || document.querySelector('input[name="email"]');
              var pwEl = document.querySelector('#password') || document.querySelector('#login-password') || document.querySelector('input[name="password"]');
              if (idEl && pwEl && !idEl.value) {
                idEl.value = ${JSON.stringify(credentials.id)};
                pwEl.value = ${JSON.stringify(credentials.pw)};
                // We don't auto-click submit here to let user handle CAPTCHA or SNS if they prefer
              }
            })();
          `);
        } catch (e) {}
      });

      loginWin.on('closed', () => { done(false); });

      // Timeout 5 minutes for manual login
      setTimeout(() => { if (!resolved) { this.logProgress('⏰ 로그인 시간 초과'); done(false); } }, 300000);
    });
  }

  async fetchKmoocApi(apiPath, method = 'GET', body = null) {
    const script = `
      new Promise(function(resolve) {
        var options = {
          method: '${method}',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        };
        if ('${method}' === 'POST' && ${JSON.stringify(body)}) {
          options.headers['Content-Type'] = 'application/json';
          options.body = JSON.stringify(${JSON.stringify(body)});
        }
        fetch('${apiPath}', options)
        .then(r => r.json())
        .then(data => resolve({ success: true, data: data }))
        .catch(err => resolve({ success: false, error: err.toString() }));
      });
    `;
    try {
      const res = await this.executeInBrowser(script);
      if (res && res.success) return res.data;
      return null;
    } catch (e) {
      return null;
    }
  }

  async crawlMainPage() {
    this.logProgress('K-MOOC 수강 과목 정보를 가져오는 중...');
    const data = { userInfo: {}, courses: [], timetable: [] };

    try {
       // K-MOOC uses lms.kmooc.kr for the actual LMS dashboard (Coursemos-based)
       await this.crawlWin.loadURL('https://lms.kmooc.kr/');
       
       // Override confirm/alert to prevent background window from hanging
       await this.executeInBrowser(`window.confirm = function() { return true; }; window.alert = function() { return true; };`);
    } catch (e) {
       console.log('Error navigating to lms.kmooc.kr:', e);
    }

    // Moodle/Coursemos usually doesn't have an open API for enrollments that works via fetch for users.
    // Instead we scrape the links pointing to courses: /course/view.php?id=XXXX
    const scrapedCourses = await this.executeInBrowser(`
      new Promise((resolve) => {
        let attempts = 0;
        
        function tryScrape() {
          attempts++;
          var items = [];
          var links = document.querySelectorAll('a[href*="/course/view.php?id="]');
          for (var i = 0; i < links.length; i++) {
            var a = links[i];
            var href = a.getAttribute('href');
            var match = href.match(/id=(\\d+)/);
            if (!match) continue;
            
            var courseId = match[1];
            var titleAttr = a.getAttribute('title');
            var title = titleAttr ? titleAttr.trim() : a.innerText.trim().replace(/\\n/g, ' ');
            
            // If the link text is empty, try to find a title element nearby
            if (!title || title.length < 2) {
               var titleEl = a.querySelector('.course-name, .coursefullname, h3, h4');
               if (titleEl) {
                 title = titleEl.innerText.trim().replace(/\\n/g, ' ');
               }
            }
            
            // Clean up appended date formats like "2026-03-03 09:00:00 ~ 2026-06-15 23:59:00"
            title = title.replace(/\\d{4}-\\d{2}-\\d{2}\\s*\\d{2}:\\d{2}:\\d{2}\\s*~\\s*\\d{4}-\\d{2}-\\d{2}\\s*\\d{2}:\\d{2}:\\d{2}/g, '').trim();

            if (courseId && title && title.length > 1 && !items.find(item => item.kjKey === courseId)) {
              items.push({
                name: title, // Provide clean title for UI display
                title: title, // Maintained for detailed backend
                kjKey: courseId,
                code: 'KMOOC-' + courseId, // Unify external format
                term: '',
                schedule: ''
              });
            }
          }
          
          if (items.length > 0 || attempts >= 10) { // Try for 10 seconds max
            resolve(items);
          } else {
            setTimeout(tryScrape, 1000);
          }
        }
        
        tryScrape();
      });
    `);

    if (scrapedCourses && scrapedCourses.length > 0) {
      data.courses = scrapedCourses;
    }

    return data;
  }

  async crawlCourseDetail(course, index, total) {
    this.logProgress(`과목 상세 (${index + 1}/${total}): ${course.title}`);
    const detail = {
      name: course.title, code: course.code, kjKey: course.kjKey,
      plan: [], notices: [], qna: [], materials: [], projects: [], tests: [], discuss: [], clicker: [], survey: []
    };

    // For Open edX, notices are often in /api/announcements/v1/
    // But K-MOOC might have a custom board.
    // Standard Open edX notices:
    // Standard Moodle notices logic.
    // Course announcements often live in /mod/forum/view.php?id=XX where forum relates to news
    // For now we try to fetch K-MOOC's standard edX API just in case for older courses, otherwise we might need Moodle scraping.
    const announcements = await this.fetchKmoocApi(`/api/announcements/v1/announcements/?course_id=${course.kjKey}`);
    if (announcements && Array.isArray(announcements)) {
      detail.notices = announcements.map(a => ({
        title: a.title || '공지사항',
        link: '', // Detail content might be in the 'content' field
        cells: [a.title || '공지사항', '관리자', new Date(a.date || Date.now()).toLocaleDateString()],
        content: a.content
      }));
    } else {
       // K-MOOC Coursemos dashboard typically stores notices in a specific board.
       detail.notices.push({
         title: '공지사항 확인',
         link: `https://lms.kmooc.kr/course/view.php?id=${course.kjKey}`,
         cells: ['공지사항 바로가기', 'LMS', new Date().toLocaleDateString()]
       });
    }

    return detail;
  }

  async fetchDetailContent(url, courseKey) {
    // If we already have the content (like in notices), we can return it.
    // Or if it's a URL, fetch it.
    return '<p style="padding:20px;text-align:center;">상세를 보려면 원본 사이트를 방문해 주세요.</p>';
  }
}

module.exports = KmoocLms;
