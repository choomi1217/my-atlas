# QA E2E 테스트 개선 v7

> 변경 유형: 버그 수정  
> 작성일: 2026-04-01  
> 버전: v7  
> 상태: 완료

---

## 문제

E2E 테스트(`npm run e2e:api`, `npx playwright test`) 실행 시마다 Flyway V7 seed 데이터(`my-atlas` company → `Product Test Suite` → Segments → 22 TestCases)가 영구 삭제되는 문제 발생.

테스트 후 재시작할 때마다 DB가 비워지는 현상으로, 개발자의 수동 테스트 데이터도 함께 손실.

### 원인

**File:** `qa/api/company.spec.ts`, lines 20–26 (수정 전)

```ts
test('GET /api/companies - empty state returns empty array', async () => {
  const allCompanies = await request.get('/api/companies');
  const list = (await allCompanies.json() as any).data || [];
  for (const company of list) {
    await request.delete(`/api/companies/${company.id}`);  // ← 이름 필터 없이 전부 삭제
  }
  expect(body.data.length).toBe(0);
});
```

테스트가 **모든 company를 무조건 삭제**하며, `ON DELETE CASCADE`로 인해 하위 product → segment → test_case까지 연쇄 삭제됨.

---

## 수정 사항

### 변경 1: `beforeAll`에 E2E 전용 cleanup 추가

```ts
test.beforeAll(async ({ playwright }) => {
  request = await playwright.request.newContext({
    baseURL: API_URL,
  });

  // Clean up only E2E test companies from previous test runs
  // Preserve seed data (my-atlas, etc.)
  const allCompanies = await request.get('/api/companies');
  const list = (await allCompanies.json() as any).data || [];
  for (const company of list) {
    if (company.name.includes('E2E') || company.name.includes('Test')) {
      await request.delete(`/api/companies/${company.id}`);
    }
  }
});
```

- 이전 실패 런에서 남은 "E2E"/"Test" 이름 company만 선별 삭제
- Seed 데이터(`my-atlas` 등)는 보존

### 변경 2: 첫 번째 테스트 목적 재설정

**Before:**
```ts
test('GET /api/companies - empty state returns empty array', async () => {
  // 모든 company 삭제 → empty state 검증
  expect(body.data.length).toBe(0);
});
```

**After:**
```ts
test('GET /api/companies - returns company list with correct structure', async () => {
  const response = await request.get('/api/companies');
  expect(response.status()).toBe(200);
  const body = await response.json() as any;
  expect(body.success).toBe(true);
  expect(Array.isArray(body.data)).toBe(true);
});
```

공유 dev DB에서는 "empty state"를 가정할 수 없으므로, **API 응답 구조 검증**으로 변경.

---

## 파일 변경

| 파일 | 변경 사항 |
|------|---------|
| `qa/api/company.spec.ts` | `beforeAll`에 E2E cleanup 추가; 첫 번째 테스트 수정 |

---

## 검증 결과

✅ `beforeAll` cleanup으로 이전 E2E 데이터 정리  
✅ `my-atlas` seed 데이터 보존  
✅ 테스트 통과  
✅ 재시작 후 seed 데이터 존재 확인

---

## 이후 규칙

`qa/CLAUDE.md`에 다음 규칙 추가:

- ❌ **E2E 테스트는 seed 데이터 삭제 금지** — 공유 dev DB 보호
- ✅ **테스트 이름에 "E2E" 또는 "Test" 포함** — cleanup 필터로 인식
- ✅ **`afterAll`에서만 테스트용 company 삭제** — 생성된 것만 정리
