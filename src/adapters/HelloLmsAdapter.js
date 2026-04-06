const LmsAdapter = require('./LmsAdapter');

class HelloLmsAdapter extends LmsAdapter {
  constructor(baseUrl) {
    super(baseUrl);
  }

  // --- Helpers for execution within crawlWin ---
  async executeInBrowser(code) {
    if (!this.crawlWin || this.crawlWin.isDestroyed()) {
      throw new Error('Crawler window goes offline');
    }
    return await this.crawlWin.webContents.executeJavaScript(code);
  }

  async navigateAndExtract(url, scriptFnText) {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (data) => {
        if (!resolved) { resolved = true; resolve(data); }
      };

      const handler = async () => {
        try {
          const result = await this.executeInBrowser(scriptFnText);
          done(result);
        } catch (e) {
          console.error('[navigateAndExtract] Error:', e);
          done(null);
        }
      };

      this.crawlWin.webContents.once('did-finish-load', handler);
      this.crawlWin.loadURL(url);
      setTimeout(() => done(null), 15000); // 15s timeout
    });
  }

  async fetchAndExtract(urlPath, postData, scriptFnText) {
    const postBody = Object.keys(postData).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(postData[k])).join('&');
    const script = `
      new Promise(function(resolve) {
        fetch('${urlPath}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: '${postBody}'
        })
        .then(r => r.text())
        .then(html => {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          var result = (${scriptFnText})(doc);
          resolve({ success: true, data: result });
        })
        .catch(err => resolve({ success: false, error: err.toString() }));
      });
    `;
    try {
      const res = await this.executeInBrowser(script);
      if (!res.success) throw new Error(res.error);
      return res.data;
    } catch (e) {
      console.error(`[${urlPath}] Error:`, e.message);
      return [];
    }
  }
  // ---------------------------------------------

  async crawlMainPage() {
    this.logProgress('메인 페이지에서 과목을 가져오는 중...');
    const mainUrl = this.baseUrl + '/ilos/main/main_form.acl';
    
    return await this.navigateAndExtract(mainUrl, `
      (function() {
        var doc = document;
        var data = { userInfo: {}, courses: [], timetable: [] };

        var userEl = doc.getElementById('user');
        if (userEl) data.userInfo.name = userEl.innerText.trim();

        var subOpens = doc.querySelectorAll('em.sub_open[kj]');
        var currentTerm = '';
        subOpens.forEach(function(em) {
          var li = em.closest('li');
          if (li) {
            var prev = li.previousElementSibling;
            while (prev) {
              if (prev.classList && prev.classList.contains('term_info')) {
                currentTerm = prev.innerText.trim();
                break;
              }
              prev = prev.previousElementSibling;
            }
          }

          var kjKey = em.getAttribute('kj') || '';
          var title = em.getAttribute('title') || '';
          var nameText = em.innerText.trim();
          var parts = nameText.split('\\n');
          var courseName = parts[0] ? parts[0].trim() : nameText;
          var courseCode = parts[1] ? parts[1].trim().replace(/[()]/g, '') : '';
          var schedSpan = em.nextElementSibling;
          var schedule = schedSpan ? schedSpan.innerText.trim() : '';

          data.courses.push({
            name: courseName,
            code: courseCode,
            kjKey: kjKey,
            title: title,
            schedule: schedule,
            term: currentTerm,
          });
        });

        var ttRows = doc.querySelectorAll('.m-box2 table tbody tr, .timetable-area table tbody tr');
        ttRows.forEach(function(tr) {
          var tds = tr.querySelectorAll('td');
          if (tds.length >= 4) {
            data.timetable.push({
              time: tds[0].innerText.trim(),
              subject: tds[1].innerText.trim(),
              professor: tds[2].innerText.trim(),
              room: tds[3].innerText.trim(),
            });
          }
        });
        return data;
      })();
    `);
  }

  async enterCourse(kjKey) {
    const result = await this.executeInBrowser(`
      new Promise(function(resolve) {
        fetch('/ilos/st/course/eclass_room2.acl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: 'KJKEY=' + encodeURIComponent('${kjKey}') + '&returnData=json&returnURI=%2Filos%2Fst%2Fcourse%2Fsubmain_form.acl&encoding=utf-8'
        })
        .then(r => r.json())
        .then(data => resolve({ success: true, data: data }))
        .catch(err => resolve({ success: false, error: err.toString() }));
      });
    `);
    return result && result.success;
  }

  async crawlCourseDetail(course, index, total) {
    const label = course.name || `과목 ${index + 1}`;
    this.logProgress(`과목 상세 (${index + 1}/${total}): ${label}`);
    
    const detail = {
      name: course.name, code: course.code, kjKey: course.kjKey, schedule: course.schedule, term: course.term,
      plan: [], notices: [], qna: [], materials: [], projects: [], tests: [], discuss: [], clicker: [], survey: []
    };

    const entered = await this.enterCourse(course.kjKey);
    if (!entered) return detail;

    const menus = [
      { key: 'plan', url: '/ilos/st/course/plan_form.acl' },
      { key: 'notices', url: '/ilos/st/course/notice_list.acl' },
      { key: 'qna', url: '/ilos/st/course/qna2_faq_list.acl' },
      { key: 'materials', url: '/ilos/st/course/lecture_material_list.acl' },
      { key: 'projects', url: '/ilos/st/course/project_list.acl' },
      { key: 'tests', url: '/ilos/st/course/test_list.acl' },
      { key: 'discuss', url: '/ilos/st/course/discuss_list.acl' },
      { key: 'clicker', url: '/ilos/st/course/clicker_list.acl' },
      { key: 'survey', url: '/ilos/st/course/survey2_list.acl' },
    ];

    for (const m of menus) {
      detail[m.key] = await this.fetchAndExtract(
        this.baseUrl + m.url, // absolute or relative based on fetch behavior in browser. Browser is on lms domain so relative is fine! But we'll use relative.
        { start: '', display: '1', SCH_VALUE: '', ud: process.env.LMS_ID || '', ky: course.kjKey, KJKEY: course.kjKey },
        `function(doc) {
          var items = [];
          doc.querySelectorAll('table tbody tr').forEach(function(row) {
            var tds = row.querySelectorAll('td, th');
            if (tds.length === 0 || (tds.length === 1 && tds[0].colSpan > 1 && tds[0].innerText.includes('없습니다'))) return;
            var link = '';
            var titleMatch = false;
            var title = '';
            var cells = Array.from(tds).map((td) => {
               var clickAttr = td.getAttribute('onclick') || row.getAttribute('onclick') || '';
               var match = clickAttr.match(/pageMove\\('([^']+)'/);
               if (!match) match = clickAttr.match(/pageGo\\('([^']+)'/);
               if (match) link = match[1];
               if (td.querySelector('.subjt_top, div:first-child')) {
                 var titleEl = td.querySelector('.subjt_top') || td.querySelector('div:first-child');
                 var txt = titleEl.innerText.split('\\n')[0].trim();
                 if (txt && !titleMatch) { title = txt; titleMatch = true; }
                 return txt;
               }
               return td.innerText.trim().replace(/\\n/g, ' ');
            });
            if (!title) title = cells[1] || cells[0] || '상세 정보';
            items.push({ cells: cells, link: link, title: title });
          });
          return items;
        }`
      );
    }
    return detail;
  }

  async fetchDetailContent(url, courseKey) {
    if (!url.startsWith('/')) url = '/' + url;
    const bodyHtml = await this.fetchAndExtract(
      this.baseUrl + url,
      { ky: courseKey, encoding: 'utf-8' },
      `function(doc) {
        var top = doc.querySelector('.subjt_top') || '';
        var mid = doc.querySelector('.subjt_middle') || '';
        var view = doc.querySelector('#content_text');
        if (!view) return '<p style="padding:20px;text-align:center;">내용을 찾을 수 없습니다.</p>';
        var topHtml = top ? '<div style="margin-bottom:10px;">' + top.outerHTML + '</div>' : '';
        var midHtml = mid ? '<div style="margin-bottom:20px;border-bottom:1px solid #333;padding-bottom:10px;">' + mid.outerHTML + '</div>' : '';
        view.querySelectorAll('script, form, .progShowHideBtn, .header_logout, #gnb, #header, #footerWrap02').forEach(e => e.remove());
        return topHtml + midHtml + view.innerHTML;
      }`
    );
    return typeof bodyHtml === 'string' ? bodyHtml : '<p style="padding:20px;text-align:center;">데이터를 불러오지 못했습니다.</p>';
  }
}

module.exports = HelloLmsAdapter;
