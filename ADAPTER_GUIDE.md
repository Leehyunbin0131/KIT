# 다중 LMS 크롤러 연동 가이드 (Adapter Guide)

이 프로젝트는 현재 **다중 학교/다중 플랫폼 LMS** 아키텍처를 지원합니다.
특정 학교(대구대학교 등)에 종속되었던 코드를 `src/adapters` 폴더를 통해 모듈화했습니다. 새로운 대학교 혹은 새로운 구조의 LMS를 연동하고자 하는 기여자는 아래 문서를 바탕으로 작업할 수 있습니다.

## 📁 구조

\`\`\`
src/
└── adapters/
    ├── LmsAdapter.js                // [공통규격] 모든 크롤러 어댑터가 상속받아야 하는 최상위 클래스
    ├── HelloLmsAdapter.js           // [공통기능] 'Hello LMS' 솔루션을 사용하는 대학들의 공통 파싱 로직
    └── universities/
        ├── DaeguLms.js              // 대구대학교 (HelloLmsAdapter 상속 및 SSO 로그인 재구현)
        └── YourUniversity.js        // 새 학교 (생성 예정)
\`\`\`

## 🚀 새로운 대학교 연동 방법

새로운 학교를 추가할 때, 해당 학교가 어떤 LMS 시스템을 사용하는지에 따라 2가지 방법이 있습니다.

### 방법 A. 해당 학교가 'Hello LMS'를 사용할 때 (가장 쉬움)

국내 많은 대학(대구대, 한양대, 등등)은 유비온(Ubion)의 'Hello LMS' 솔루션을 기반으로 사이트를 운영합니다. 이 경우 대부분의 HTML 구조와 내부 URL 체계(`.acl`)가 동일합니다.

1. \`src/adapters/universities/새학교이름Lms.js\`를 생성합니다.
2. \`HelloLmsAdapter\`를 상속받은 후, 학교 시스템에 맞는 Base URL을 넘깁니다.
3. 해당 학교가 단순 로그인이라면 추가 작업 없이 사용 가능하며, 만약 **자체 SSO(통합 로그인)**를 쓴다면 대구대(\`DaeguLms.js\`)처럼 \`login\` 메서드만 오버라이딩(Overriding) 해주세요.

**작성 예시 (`KnuLms.js`):**
\`\`\`javascript
const HelloLmsAdapter = require('../HelloLmsAdapter');

class KnuLms extends HelloLmsAdapter {
  constructor() {
    // 해당 학교의 LMS 기본 도메인 입력
    super('https://lms.knu.ac.kr'); 
  }

  // SSO 등 특수 로그인이 필요한 경우만 overriding (Hello LMS 자체 로그인 폼을 쓴다면 기본 메서드 사용 가능)
  async login(credentials) {
    // ... 학교 특화 로직 작성
  }
}

module.exports = KnuLms;
\`\`\`

### 방법 B. 아예 다른 시스템 사용 시 (Moodle, Canvas, 자체 개발 등)

이 사이트가 'Hello LMS' 기반이 아니라면 처음부터 태그 파싱 규칙을 작성해야 합니다.

1. \`src/adapters/universities/새해외대학Lms.js\` 생성
2. \`LmsAdapter\`를 상속받습니다.
3. 다음 4가지 핵심 메서드를 모두 직접 구현해야 합니다.
   * \`login(credentials)\`
   * \`crawlMainPage()\`
   * \`crawlCourseDetail(course, index, total)\`
   * \`fetchDetailContent(url, courseKey)\`

## 🔗 메인 프로세스(`main.js`)에 연동하기

새로운 학교 어댑터를 만들었다면 프론트엔드의 화면과 연결시켜야 합니다.

1. **\`renderer/index.html\`**: 
   로그인 뷰의 \`#login-univ\` 셀렉트 박스에 옵션을 추가합니다.
   \`<option value="knu">ㅇㅇ대학교 (KNU)</option>\`

2. **\`main.js\`**: 
   상단에 클래스를 require 하고 분기 처리(If문)를 추가합니다.
   \`\`\`javascript
   const DaeguLms = require('./src/adapters/universities/DaeguLms');
   const KnuLms = require('./src/adapters/universities/KnuLms');

   // ipcMain.on('login') 부분에서...
   if (univId === 'daegu') currentAdapter = new DaeguLms();
   else if (univId === 'knu') currentAdapter = new KnuLms();
   \`\`\`

---
👍 이상입니다! Pull Request(PR)를 통해 국내 다양한 대학들을 추가해 주세요!
