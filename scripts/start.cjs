/**
 * Windows 콘솔 기본 코드 페이지(CP949 등)에서 UTF-8 로그가 깨지는 문제를 피하기 위해
 * 실행 전 chcp 65001 로 맞춘 뒤 Electron을 띄웁니다.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const electronExe = require('electron');

let result;
if (process.platform === 'win32') {
  const cmd = process.env.ComSpec || 'cmd.exe';
  // /s 는 따옴표 제거 규칙 때문에 \"...\electron.exe\" 같은 잘못된 명령이 될 수 있음.
  // 경로에 공백이 있을 때만 따옴표로 감쌉니다.
  const exeArg = /\s/.test(electronExe) ? `"${electronExe}"` : electronExe;
  const inner = `chcp 65001>nul & ${exeArg} .`;
  result = spawnSync(cmd, ['/c', inner], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    windowsHide: false,
  });
} else {
  result = spawnSync(electronExe, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
}

process.exit(result.status === null ? 1 : result.status);
