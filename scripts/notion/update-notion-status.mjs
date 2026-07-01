#!/usr/bin/env node
// PR 본문의 "Notion: <url>" 링크를 파싱해 해당 Notion 페이지를
// Status=Done + 완료일=머지일자로 갱신한다.
// 사용처: .github/workflows/notion-sync.yml (PR merged → develop)
//
// 환경변수:
//   NOTION_TOKEN  (필수) Notion internal integration secret
//   PR_BODY       (필수) PR 설명 본문
//   MERGED_AT     (필수) PR 머지 시각 ISO-8601 (예: 2026-06-30T05:12:00Z)
//   STATUS_PROP   (선택) Status 속성명, 기본 "Status"
//   STATUS_DONE   (선택) Done 옵션명, 기본 "Done"
//   DATE_PROP     (선택) 완료일 속성명, 기본 "완료일"
//   DRY_RUN       (선택) "1"이면 API 호출 없이 로그만

const NOTION_VERSION = '2022-06-28';

// 32hex 또는 대시 포함 UUID를 표준 UUID(8-4-4-4-12)로 정규화
export function toUuid(raw) {
  const h = raw.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// PR 본문에서 Notion URL(notion.so / app.notion.com / notion.site)의 페이지 ID를 모두 추출(중복 제거).
// dash 유무 모두 허용. 링크가 없으면 빈 배열 → no-op(안전).
export function parseNotionRefs(body) {
  if (!body) return [];
  const ids = new Set();
  const re = /notion\.(?:so|com|site)\/[^\s)"']*?([0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12})/gi;
  let m;
  while ((m = re.exec(body)) !== null) ids.add(toUuid(m[1]));
  return [...ids];
}

async function updatePage(pageId, opt) {
  const { token, statusProp, statusDone, dateProp, dateStart, dryRun } = opt;
  const payload = {
    properties: {
      [statusProp]: { select: { name: statusDone } },
      [dateProp]: { date: { start: dateStart } },
    },
  };
  if (dryRun) {
    console.log(`[dry-run] PATCH page ${pageId} ${JSON.stringify(payload)}`);
    return true;
  }
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`✗ Notion 갱신 실패 ${pageId}: ${res.status} ${await res.text()}`);
    return false;
  }
  console.log(`✓ Notion 갱신: ${pageId} → ${statusProp}=${statusDone}, ${dateProp}=${dateStart}`);
  return true;
}

async function main() {
  const token = process.env.NOTION_TOKEN;
  const body = process.env.PR_BODY || '';
  const mergedAt = process.env.MERGED_AT || new Date().toISOString();
  const opt = {
    token,
    statusProp: process.env.STATUS_PROP || 'Status',
    statusDone: process.env.STATUS_DONE || 'Done',
    dateProp: process.env.DATE_PROP || '완료일',
    dateStart: mergedAt.slice(0, 10), // YYYY-MM-DD
    dryRun: process.env.DRY_RUN === '1',
  };

  const refs = parseNotionRefs(body);
  if (refs.length === 0) {
    console.log('ℹ PR 본문에 Notion 링크 없음 — 건너뜀(no-op). 본문에 "Notion: <url>" 한 줄을 넣으면 자동 Done 처리됩니다.');
    return;
  }
  if (!token && !opt.dryRun) {
    console.error('✗ NOTION_TOKEN 미설정');
    process.exit(1);
  }
  console.log(`대상 페이지 ${refs.length}개: ${refs.join(', ')}`);
  let allOk = true;
  for (const id of refs) allOk = (await updatePage(id, opt)) && allOk;
  if (!allOk) process.exit(1);
}

// 직접 실행될 때만 main() 호출 (테스트 import 시 실행 안 됨)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
