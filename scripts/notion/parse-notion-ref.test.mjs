// 실행: node --test scripts/notion/parse-notion-ref.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotionRefs, toUuid } from './update-notion-status.mjs';

test('toUuid: 32hex → dashed UUID', () => {
  assert.equal(toUuid('7ad107b270e8820e90c401aac14ec805'), '7ad107b2-70e8-820e-90c4-01aac14ec805');
});

test('toUuid: 이미 dash 있는 UUID도 정규화', () => {
  assert.equal(toUuid('3d4107b2-70e8-8220-b237-81a50e6eae8a'), '3d4107b2-70e8-8220-b237-81a50e6eae8a');
});

test('단일 Notion 링크 추출 (copy_link 쿼리 포함)', () => {
  const body = '작업 설명\nNotion: https://www.notion.so/MyAtlas-3d4107b270e88220b23781a50e6eae8a?source=copy_link';
  assert.deepEqual(parseNotionRefs(body), ['3d4107b2-70e8-8220-b237-81a50e6eae8a']);
});

test('app.notion.com/p 링크도 추출 (create-pages/앱 복사 형식)', () => {
  const body = 'Notion: https://app.notion.com/p/390107b270e881d4a794c45d5df83d69';
  assert.deepEqual(parseNotionRefs(body), ['390107b2-70e8-81d4-a794-c45d5df83d69']);
});

test('여러 링크 + 중복 제거', () => {
  const body =
    'Notion: https://notion.so/a1b2c3d4e5f60718293a4b5c6d7e8f90\n' +
    '같은 항목 또 언급: https://www.notion.so/x-a1b2c3d4e5f60718293a4b5c6d7e8f90\n' +
    'Notion: https://notion.so/Other-0011223344556677889900aabbccddee';
  const refs = parseNotionRefs(body);
  assert.equal(refs.length, 2);
  assert.ok(refs.includes('a1b2c3d4-e5f6-0718-293a-4b5c6d7e8f90'));
  assert.ok(refs.includes('00112233-4455-6677-8899-00aabbccddee'));
});

test('링크 없으면 빈 배열 (no-op 보장)', () => {
  assert.deepEqual(parseNotionRefs('Notion 링크 없는 본문'), []);
  assert.deepEqual(parseNotionRefs(''), []);
  assert.deepEqual(parseNotionRefs(null), []);
});
