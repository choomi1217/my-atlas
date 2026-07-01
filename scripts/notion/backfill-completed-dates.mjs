#!/usr/bin/env node
// 기존 Done 항목의 완료일을 1회 백필한다.
// 완료일이 비어 있는 Done 항목에 한해, Notion 마지막 편집일(last_edited_time)을
// 완료일로 채운다. 이미 값이 있으면 건드리지 않는다(idempotent).
// 무료 플랜에서도 동작(REST query endpoint는 플랜 무관).
//
// 환경변수:
//   NOTION_TOKEN (필수)
//   DATABASE_ID  (선택) 기본: PRD & History DB
//   DATE_PROP    (선택) 기본 "완료일"
//   STATUS_PROP  (선택) 기본 "Status"
//   STATUS_DONE  (선택) 기본 "Done"
//   TITLE_PROP   (선택) 기본 "항목"
//   DRY_RUN      (선택) "1"이면 미리보기만(반영 안 함)

const NOTION_VERSION = '2022-06-28';
const TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID || '7ad107b270e8820e90c401aac14ec805';
const DATE_PROP = process.env.DATE_PROP || '완료일';
const STATUS_PROP = process.env.STATUS_PROP || 'Status';
const STATUS_DONE = process.env.STATUS_DONE || 'Done';
const TITLE_PROP = process.env.TITLE_PROP || '항목';
const DRY_RUN = process.env.DRY_RUN === '1';

if (!TOKEN) {
  console.error('✗ NOTION_TOKEN 미설정');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Notion-Version': NOTION_VERSION,
  'Content-Type': 'application/json',
};

async function queryAllDone() {
  const pages = [];
  let cursor;
  do {
    const body = { filter: { property: STATUS_PROP, select: { equals: STATUS_DONE } }, page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`✗ query 실패: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    const data = await res.json();
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return pages;
}

const titleOf = (p) => p.properties?.[TITLE_PROP]?.title?.map((t) => t.plain_text).join('') || '(무제)';
const existingDate = (p) => p.properties?.[DATE_PROP]?.date?.start || null;

async function setDate(pageId, dateStr) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ properties: { [DATE_PROP]: { date: { start: dateStr } } } }),
  });
  if (!res.ok) {
    console.error(`  ✗ 실패 ${pageId}: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

const pages = await queryAllDone();
console.log(`Done 항목 ${pages.length}개 조회`);
let filled = 0;
let skipped = 0;
let failed = 0;
for (const page of pages) {
  const title = titleOf(page);
  if (existingDate(page)) {
    skipped++;
    continue; // 이미 완료일 있음 → 보존
  }
  const date = page.last_edited_time.slice(0, 10); // YYYY-MM-DD
  if (DRY_RUN) {
    console.log(`[dry-run] ${title} → 완료일 ${date}`);
    filled++;
    continue;
  }
  if (await setDate(page.id, date)) {
    console.log(`✓ ${title} → 완료일 ${date}`);
    filled++;
  } else {
    failed++;
  }
}
console.log(`\n결과: 채움 ${filled}, 건너뜀(이미 값 있음) ${skipped}, 실패 ${failed}`);
if (DRY_RUN) console.log('(DRY_RUN — 실제 반영 안 됨. 반영하려면 DRY_RUN 없이 다시 실행)');
