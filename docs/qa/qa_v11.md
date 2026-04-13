# E2E 테스트 시드 데이터 삭제 버그 수정

> 변경 유형: 버그 수정  
> 작성일: 2026-04-13  
> 버전: v11  
> 상태: 완료

---

## 1. Context

### 1.1 배경

공유 DB 환경에서 E2E 테스트(`company-panel.spec.ts`, `product-panel.spec.ts`) 실행 후 Flyway V7 시드 데이터가 전부 삭제되는 버그가 발생했다.

- **DB 통계:** company 502건 INSERT / 502건 DELETE — 생성된 모든 행이 삭제됨
- **생존 데이터:** knowledge_base(72건)만 생존 (company FK 없는 독립 테이블)
- **삭제된 데이터:** my-atlas company + Product Test Suite + 22 TestCase (CASCADE 삭제)

### 1.2 근본 원인

`qa/pages/features-page.ts`의 Page Object 메서드 2개가 `.first()` 셀렉터로 페이지의 **첫 번째** Delete 버튼을 무차별 클릭한다.

| 메서드 | 위치 | 현재 동작 |
|--------|------|-----------|
| `deleteCompany()` | L184-192 | `.first()` → 페이지 내 아무 company의 Delete 클릭 |
| `deleteProduct()` | L197-205 | `.first()` → 페이지 내 아무 product의 Delete 클릭 |

시드 company "my-atlas"가 목록 상단에 표시되면, 테스트가 의도한 E2E 테스트 company가 아닌 시드 company를 삭제하게 된다. Company 삭제는 CASCADE로 하위 Product, Segment, TestCase까지 전부 삭제한다.

### 1.3 올바른 패턴 (이미 존재)

같은 파일의 `deleteTestCase(title: string)` (L167-179)은 이미 올바르게 구현되어 있다:

```typescript
async deleteTestCase(title: string) {
  const card = this.page.locator('.bg-white.border.rounded-lg')
    .filter({ hasText: title })
    .first();
  await card.getByRole('button', { name: /Delete/i }).click();
  // ...
}
```

카드 이름으로 스코핑한 뒤 해당 카드 내에서 Delete 버튼을 클릭 → 의도한 엔티티만 삭제.

---

## 2. 수정 계획

### Step 1: `qa/pages/features-page.ts` — Page Object 수정

- [x] `deleteCompany()` → `deleteCompany(companyName: string)` 변경
  - `.first()` 제거, `filter({ hasText: companyName })`으로 대상 카드 스코핑
- [x] `deleteProduct()` → `deleteProduct(productName: string)` 변경
  - 동일 패턴 적용

### Step 2: 호출부 수정

- [x] `qa/ui/company-panel.spec.ts` — `deleteCompany()` → `deleteCompany('E2E Delete Test')`
- [x] `qa/ui/product-panel.spec.ts` — `deleteProduct()` → `deleteProduct('E2E Delete Product')`
- [x] `qa/ui/company-panel.spec.ts` — Activate 버튼 `.first()` 4곳 → 카드 스코핑으로 변경
- [x] `qa/ui/company-panel.spec.ts` — delete 검증에서 `getByText` → `getByRole('heading')` + auto-wait 적용

### Step 3: 시드 데이터 복구

- [x] V7 마이그레이션 SQL 수동 실행으로 시드 데이터 복구

```bash
docker exec -i myqaweb-db psql -U myqaweb -d myqaweb < backend/src/main/resources/db/migration/V7__seed_testcase_v1.sql
```

### Step 4: 검증

- [x] `SELECT COUNT(*) FROM test_case` → 22건 확인
- [x] `SELECT COUNT(*) FROM company WHERE name = 'my-atlas'` → 1건 확인
- [x] `npx playwright test ui/company-panel.spec.ts` → 9/9 전체 통과
- [x] `npx playwright test ui/product-panel.spec.ts` → 6/6 전체 통과
- [x] 테스트 후 시드 데이터 보존 확인 (my-atlas 1건, test_case 22건, knowledge_base 72건 유지)

---

## 3. 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `qa/pages/features-page.ts` | `deleteCompany()`, `deleteProduct()`에 name 파라미터 추가, 카드 스코핑 |
| `qa/ui/company-panel.spec.ts` | `deleteCompany()` 호출에 company 이름 전달 |
| `qa/ui/product-panel.spec.ts` | `deleteProduct()` 호출에 product 이름 전달 |

## 4. 수정하지 않는 것

- `CompanyService.delete()` 등 비즈니스 로직 — 정상 동작, 변경 불필요
- `cleanupAllTestData()` — 이미 "E2E"/"Test" 이름 필터가 있어 올바르게 동작
- API spec의 `afterAll` 정리 — 자체 생성한 company ID로 삭제하므로 올바름
