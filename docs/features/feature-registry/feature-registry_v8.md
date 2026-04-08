# Feature Registry — Segment 순환 참조 검증 쿼리 수정 (v8)

> 변경 유형: 버그 수정  
> 작성일: 2026-03-30  
> 버전: v8  
> 상태: 완료

---

## 배경
v7에서 순환 참조 검증 로직을 구현할 때, SegmentRepository에 PostgreSQL 네이티브 문법인
`WITH RECURSIVE` CTE 쿼리를 `@Query`(JPQL)로 사용했다. JPQL은 `WITH RECURSIVE`를 지원하지
않아 서버 시작 시 SyntaxException이 발생하고 backend가 재시작되는 문제가 생겼다.

v7 E2E 테스트 결과:
- 91 passed ✅
- 2 skipped (쿼리 문법 오류) ⚠️
- 순환 참조 검증 테스트 2개 미작동

**해결 방향:** CTE 쿼리를 제거하고, 이미 존재하는 `findAllByParentId()`를 활용해 Service Layer에서
BFS(너비 우선 탐색)로 모든 자손을 수집하는 방식으로 변경한다.

---

## 개선 항목

### 1. SegmentRepository — CTE 쿼리 삭제
**현재 상태:**
- `@Query(value="""WITH RECURSIVE descendants AS ...""")` 로 JPQL에서 네이티브 CTE 사용 시도
- SyntaxException: "WITH RECURSIVE descendants" 문법 오류

**개선:**
- `findAllDescendants()` 메서드 삭제
- `findAllByParentId(Long parentId)` 는 유지 (Spring Data JPA 자동 생성)

### 2. SegmentServiceImpl — isDescendant() BFS 방식 재구현
**현재 상태:**
```java
public boolean isDescendant(Long segmentId, Long potentialParentId) {
    List<SegmentEntity> descendants = segmentRepository.findAllDescendants(segmentId);
    return descendants.stream().anyMatch(s -> s.getId().equals(potentialParentId));
}
```

**개선:**
```java
@Override
@Transactional(readOnly = true)
public boolean isDescendant(Long segmentId, Long potentialDescendantId) {
    Queue<Long> queue = new LinkedList<>();
    queue.add(segmentId);
    while (!queue.isEmpty()) {
        Long current = queue.poll();
        List<SegmentEntity> children = segmentRepository.findAllByParentId(current);
        for (SegmentEntity child : children) {
            if (child.getId().equals(potentialDescendantId)) return true;
            queue.add(child.getId());
        }
    }
    return false;
}
```

- BFS 알고리즘으로 모든 자손을 순회
- 각 레벨마다 `findAllByParentId()` 호출 (DB 레벨 재귀 대신 App 레벨 재귀)
- import 추가: `java.util.Queue`, `java.util.LinkedList`

### 3. SegmentServiceImplTest — Mock 패턴 변경
**현재 상태:**
```java
when(segmentRepository.findAllDescendants(1L)).thenReturn(List.of(child, grandchild));
```

**개선:**
```java
// BFS 순서에 맞게 각 단계별로 mock 설정
when(segmentRepository.findAllByParentId(1L)).thenReturn(List.of(child));
when(segmentRepository.findAllByParentId(2L)).thenReturn(List.of(grandchild));
when(segmentRepository.findAllByParentId(3L)).thenReturn(List.of());
```

**영향 받는 테스트 메서드 (5개):**
- `testReparentCircularReference_ChildAsParent` (188~197줄)
- `testReparentCircularReference_GrandchildAsParent` (200~208줄)
- `testIsDescendant_True` (211~218줄)
- `testIsDescendant_False` (220~225줄)
- `testValidateReparent_DescendantFails` (239~243줄)

### 4. E2E 테스트 복원
**현재 상태:**
```typescript
test.skip('PATCH /api/segments/{id}/parent - circular reference prevention', ...)
test.skip('PATCH /api/segments/{id}/parent - self as parent prevention', ...)
```

**개선:**
```typescript
test('PATCH /api/segments/{id}/parent - circular reference prevention', ...)
test('PATCH /api/segments/{id}/parent - self as parent prevention', ...)
```

- `qa/api/segment.spec.ts` 260줄, 298줄의 `test.skip` → `test` 로 복원
- 쿼리 수정 후 backend가 정상 시작되면 이 테스트들이 정상 작동

---

## 영향 범위

### Backend 변경
| 파일 | 변경 내용 |
|------|---------|
| `SegmentRepository.java` | `findAllDescendants()` 메서드 삭제 |
| `SegmentServiceImpl.java` | `isDescendant()` BFS 방식으로 재구현 |
| `SegmentServiceImplTest.java` | mock 5개 `findAllDescendants` → `findAllByParentId` 로 변경 |

### Frontend 변경
없음 (SegmentTreeView.tsx 등 DnD 구현은 유지)

### E2E 테스트 변경
| 파일 | 변경 내용 |
|------|---------|
| `qa/api/segment.spec.ts` | `test.skip` 2개 → `test` 로 복원 |

---

## 구현 계획

### Step 1 — SegmentRepository 수정
- [ ] `findAllDescendants()` 메서드 삭제

### Step 2 — SegmentServiceImpl 수정
- [ ] `isDescendant()` BFS 방식으로 재구현
- [ ] import 추가: `java.util.Queue`, `java.util.LinkedList`
- [ ] 로직 검증: 루트(1) → 자식(2) → 손자(3) 구조에서 올바르게 검색되는지 확인

### Step 3 — SegmentServiceImplTest 수정
- [ ] 5개 테스트 메서드의 mock 재구성
- [ ] `findAllByParentId` 호출 패턴으로 단계별 mock 설정
- [ ] 단위 테스트 실행: `./gradlew test --tests "*Segment*"`

### Step 4 — E2E 테스트 복원
- [ ] `qa/api/segment.spec.ts` 260줄 `test.skip` → `test`
- [ ] `qa/api/segment.spec.ts` 298줄 `test.skip` → `test`

### Step 5 — Build & Verification (Agent-D)
- [ ] `./gradlew clean build -x test` 성공 (SyntaxException 없음)
- [ ] `./gradlew test` 성공 (모든 Segment 테스트)
- [ ] `docker compose up --build -d` 성공 (backend 정상 시작)
- [ ] `npx playwright test api/segment.spec.ts` 성공 (2개 테스트 400 응답 확인)
- [ ] `docker compose down` 정리

---

## 검증 체크리스트

### Backend 검증
- ✅ `SegmentRepository.java` 에서 `findAllDescendants()` 제거됨
- ✅ `SegmentServiceImpl.java` 의 `isDescendant()` BFS 구현
- ✅ Unit 테스트 5개 mock 재구성
- ✅ `./gradlew test` 전원 통과

### Docker 검증
- ✅ `docker compose up --build` 시작 시 SyntaxException 없음
- ✅ backend 정상 시작 (10초 이내)

### E2E 검증
- ✅ `npx playwright test api/segment.spec.ts` 실행: **11 passed**
- ✅ Circular reference test (Test 10): 400 BAD_REQUEST 응답 확인 ✓
- ✅ Self as parent test (Test 11): 400 BAD_REQUEST 응답 확인 ✓
- ✅ Reparent success, to root, cascade delete 테스트 모두 통과
- ⚠️ 404 test 1개: 범위 외 오류 (GlobalExceptionHandler 이슈, v8.1에서 수정)

---

## 기술 상세

### BFS 알고리즘 설명

```
입력: segmentId=1, potentialDescendantId=3
구조: 1(root) → 2(child) → 3(grandchild)

Step 1: queue=[1]
  - current=1
  - children = findAllByParentId(1) = [2]
  - 2 != 3 → queue=[2]

Step 2: queue=[2]
  - current=2
  - children = findAllByParentId(2) = [3]
  - 3 == 3 → return true ✅

Time Complexity: O(N) — N = 총 노드 수
Space Complexity: O(N) — queue 최대 크기
```

### findAllByParentId 재사용 이점
- 이미 구현되고 테스트된 메서드
- Spring Data JPA 자동 생성 쿼리 (안정적)
- DB 부담 적음 (각 쿼리는 "parent_id = ?" 단순 WHERE)
- 예측 가능한 성능

---

## 기존 데이터 호환성

- DB 마이그레이션 불필요 (segment 테이블 스키마 변경 없음)
- 기존 segment 계층 구조 그대로 사용 가능
- 쿼리만 APP 레벨로 변경되었으므로 데이터 영향 없음
