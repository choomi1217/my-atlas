#!/usr/bin/env node
// 마지막 release 태그 이후의 [type] 커밋을 수집해 changelog 마크다운을 생성한다.
// 사용처: .github/workflows/changelog.yml (push → main)
//
// 환경변수:
//   PREV_TAG    (선택) 비교 기준 태그. 미지정 시 git describe 탐색, 없으면 전체 히스토리.
//   NEW_VERSION (선택) 새 버전 라벨. 미지정 시 vYYYY.MM.DD.
//   NO_WRITE    (선택) "1"이면 CHANGELOG.md 미수정(미리보기용). stdout만 출력.
// 출력:
//   - stdout: 릴리스 노트 마크다운 (release body로 사용)
//   - CHANGELOG.md 맨 위에 같은 섹션 prepend (NO_WRITE!=1)

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const TYPE_ORDER = [
  ['feat', '✨ Features'],
  ['fix', '🐛 Fixes'],
  ['refactor', '♻️ Refactor'],
  ['test', '✅ Tests'],
  ['docs', '📝 Docs'],
  ['chore', '🔧 Chore'],
];

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

function resolvePrevTag() {
  if (process.env.PREV_TAG) return process.env.PREV_TAG;
  try {
    return sh('git describe --tags --abbrev=0');
  } catch {
    return ''; // 태그 없음 → 전체 히스토리
  }
}

function collectCommits(range) {
  const fmt = '%H\x1f%s'; // hash <US> subject
  const cmd = range
    ? `git log ${range} --no-merges --pretty=format:'${fmt}'`
    : `git log --no-merges --pretty=format:'${fmt}'`;
  const out = sh(cmd);
  if (!out) return [];
  return out.split('\n').map((line) => {
    const [hash, subject] = line.split('\x1f');
    return { hash, subject };
  });
}

function groupByType(commits) {
  const groups = {};
  for (const { subject } of commits) {
    const m = subject.match(/^\[(\w+)\]\s+(.*)$/);
    if (!m) continue; // 컨벤션 외 커밋 무시
    (groups[m[1].toLowerCase()] ||= []).push(m[2]);
  }
  return groups;
}

function render(version, date, groups) {
  let out = `## ${version} — ${date}\n`;
  let any = false;
  for (const [type, heading] of TYPE_ORDER) {
    const items = groups[type];
    if (!items?.length) continue;
    any = true;
    out += `\n### ${heading}\n`;
    for (const it of items) out += `- ${it}\n`;
  }
  if (!any) out += '\n_변경 사항 없음 ([type] 커밋 기준)_\n';
  return out;
}

function main() {
  const prevTag = resolvePrevTag();
  const range = prevTag ? `${prevTag}..HEAD` : '';
  const version =
    process.env.NEW_VERSION || `v${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}`;
  const date = new Date().toISOString().slice(0, 10);

  const section = render(version, date, groupByType(collectCommits(range)));
  process.stdout.write(section); // release body

  if (process.env.NO_WRITE === '1') return;

  const header = '# Changelog\n\n';
  let existing = existsSync('CHANGELOG.md') ? readFileSync('CHANGELOG.md', 'utf8') : header;
  if (!existing.startsWith('# Changelog')) existing = header + existing;
  const afterHeader = existing.replace(/^# Changelog\n\n?/, '');
  writeFileSync('CHANGELOG.md', `${header}${section}\n${afterHeader}`);
}

main();
