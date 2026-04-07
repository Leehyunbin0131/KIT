const HelloLmsAdapter = require('../HelloLmsAdapter');
const { BrowserWindow } = require('electron');

class KnuLms extends HelloLmsAdapter {
  constructor() {
    super('https://lms1.knu.ac.kr');
  }

  async login(credentials) {
    this.logProgress('경북대 로그인 시도 중...');

    return new Promise((resolve) => {
      let resolved = false;

      const loginWin = new BrowserWindow({
        width: 1100,
        height: 800,
        show: true,
        title: '경북대학교 LMS 로그인 – 인증을 완료해 주세요',
        autoHideMenuBar: true,
      });

      const done = (success) => {
        if (resolved) return;
        resolved = true;
        try { loginWin.close(); } catch (_) {}
        resolve(success);
      };

      // 경북대 자체 SSO → agentId=311이 LMS 연동용
      const ssoUrl = 'https://appfn.knu.ac.kr/login.knu?agentId=311';
      loginWin.loadURL(ssoUrl);

      loginWin.webContents.on('did-finish-load', async () => {
        const url = loginWin.webContents.getURL();

        // SSO 로그인 페이지에서 자동 입력
        if (url.includes('appfn.knu.ac.kr') && url.includes('login')) {
          this.logProgress('아이디/비밀번호 입력 중...');
          try {
            // 경북대 SSO 폼의 input 셀렉터 — 실제 폼 구조에 맞게 조정 필요
            await loginWin.webContents.executeJavaScript(`
                var idEl = document.querySelector('#idpw_id');
                var pwEl = document.querySelector('#idpw_pw');
                if (idEl) { idEl.value = ${JSON.stringify(credentials.id)}; idEl.dispatchEvent(new Event('input', {bubbles:true})); }
                if (pwEl) { pwEl.value = ${JSON.stringify(credentials.pw)}; pwEl.dispatchEvent(new Event('input', {bubbles:true})); }
            `);

            await new Promise(r => setTimeout(r, 500));

            await loginWin.webContents.executeJavaScript(`
            var btn = document.querySelector('#btn-login');
            if (btn) btn.click();
            `);
            
            this.logProgress('🔐 2차 인증이 필요하면 완료해 주세요...');
          } catch (e) {
            console.error('KNU login auto-fill error:', e);
          }
        }

        // LMS 메인 페이지 도달 = 로그인 성공
        if (url.includes('lms1.knu.ac.kr') && !url.includes('login')) {
          done(true);
        }
      });

      loginWin.webContents.on('did-navigate', (_e, url) => {
        if (url.includes('lms1.knu.ac.kr') && !url.includes('login')) {
          done(true);
        }
      });

      loginWin.on('closed', () => { done(false); });

      // 3분 타임아웃
      setTimeout(() => {
        if (!resolved) {
          this.logProgress('⏰ 로그인 시간 초과');
          done(false);
        }
      }, 180000);
    });
  }
}

module.exports = KnuLms;