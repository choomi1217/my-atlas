> 변경 유형: 버그 수정  
> 작성일: 2026-04-07  
> 버전: v2.1  
> 상태: 완료

---

# My Senior 버그 수정 — Hibernate 6 + pgvector VECTOR 타입 매핑 오류

## 1. 버그 현상

### API 오류
- `GET /api/senior/faq` → **500 Internal Server Error**
- 응답: `{ "success": false, "message": "Internal server error", "data": null }`

### UI 영향
- My Senior 페이지 진입 시 FAQ 목록 로드 실패
- 화면에 "Error: Request failed with status code 500" 표시
- FAQ 검색, 추가, 삭제 등 모든 FAQ UI 기능 사용 불가

### E2E 테스트 실패 (5/16)

| # | 테스트 | 실패 원인 |
|---|--------|-----------|
| 1 | `GET /api/senior/faq - returns list` | API 500 반환 (expected 200) |
| 2 | `should show FAQ view as default entry` | FAQ UI 렌더링 실패 → 검색 바 미노출 |
| 3 | `should navigate between FAQ and Chat views` | FAQ 뷰 전환 후 검색 바 미노출 |
| 4 | `should create a new FAQ and display it in the list` | "+ 추가" 버튼 미노출 (FAQ UI 미렌더링) |
| 5 | `should delete a FAQ from the list` | 동일 원인 |

---

## 2. 근본 원인 분석

### 에러 스택트레이스 (핵심)

```
org.springframework.orm.jpa.JpaSystemException: 
  org.postgresql.util.PSQLException: No results were returned by the query.

Caused by: org.hibernate.HibernateException
  at FloatPrimitiveArrayJavaType.wrap(FloatPrimitiveArrayJavaType.java:149)
  at ArrayJdbcType$2.doExtract(ArrayJdbcType.java:182)
  ...
  at com.myqaweb.senior.SeniorServiceImpl.findAllFaqs(SeniorServiceImpl.java:92)
```

### 원인: Hibernate 6 + pgvector 타입 불일치

**FaqEntity.java** (수정 전):
```java
@Column(columnDefinition = "VECTOR(1536)")
private float[] embedding;  // ← 타입 힌트 없음
```

**문제 흐름:**
1. `faqRepository.findAll()` 실행
2. Hibernate 6가 `float[]` 필드를 **표준 JDBC Array 타입**(`FloatPrimitiveArrayJavaType`)으로 매핑
3. PostgreSQL에서 `embedding` 컬럼 값을 읽을 때, pgvector는 **`PGobject` (USER-DEFINED 타입)**을 반환
4. Hibernate의 `FloatPrimitiveArrayJavaType.wrap()`이 `PGobject`를 `java.sql.Array`로 캐스팅 시도 → **실패**

### 발생 조건
- FAQ 테이블에 **embedding 값이 존재하는 레코드가 1건이라도 있을 때** 발생
- 현재 DB 상태: FAQ 8건 중 id=2에 실제 embedding 데이터 존재

### KB API가 정상인 이유
- `knowledge_base` 테이블이 현재 **0건** (embedding 있는 레코드 없음)
- 동일한 엔티티 매핑이지만, 읽을 데이터가 없어서 에러 미발생
- **KB에 embedding 데이터가 들어오면 동일 에러 발생 예정** (잠재 버그 → 동시 수정)

### 단위 테스트가 통과하는 이유
- `SeniorServiceImplTest`: Repository를 **Mockito mock**으로 대체 → 실제 JDBC 매핑 미발생
- `FaqIntegrationTest`: Testcontainers pgvector 사용 → JDBC 드라이버 레벨에서 타입 등록이 달라 통과

---

## 3. 해결 방법

### 시도 1: `@JdbcTypeCode(SqlTypes.VECTOR)` — 실패

Hibernate 6.4+의 `SqlTypes.VECTOR`를 시도했으나, **쓰기 시 bytea 타입으로 변환**하여 pgvector가 거부:
```
ERROR: column "embedding" is of type vector but expression is of type bytea
```
- 읽기는 해결되지만 쓰기가 깨짐 → Integration 테스트 7개 실패

### 시도 2: 커스텀 Hibernate `UserType` — 성공

pgvector의 `PGobject`를 직접 핸들링하는 `VectorType` UserType을 생성:

**VectorType.java** (`common/` 패키지):
- **읽기:** `ResultSet.getObject()` → `PGobject.getValue()` → `float[]` 파싱
- **쓰기:** `float[]` → `PGobject(type="vector", value="[0.1,0.2,...]")` → `PreparedStatement.setObject()`

### 수정 파일 (3개)

| 파일 | 변경 |
|------|------|
| `common/VectorType.java` | **신규** — Hibernate UserType 구현 |
| `senior/FaqEntity.java` | `@Type(VectorType.class)` 추가 |
| `knowledgebase/KnowledgeBaseEntity.java` | `@Type(VectorType.class)` 추가 |

### 변경 범위
- DB 스키마 변경: **없음**
- API 변경: **없음**
- Frontend 변경: **없음**
- Flyway 마이그레이션: **불필요**

---

## 4. 구현 순서

| Step | 작업 | 파일 | 상태 |
|------|------|------|------|
| 1 | VectorType UserType 생성 | `common/VectorType.java` | ✅ |
| 2 | FaqEntity에 `@Type(VectorType.class)` 추가 | `senior/FaqEntity.java` | ✅ |
| 3 | KnowledgeBaseEntity에 동일 적용 | `knowledgebase/KnowledgeBaseEntity.java` | ✅ |
| 4 | Backend 빌드 및 전체 테스트 | `./gradlew clean build` | ✅ |
| 5 | Docker 재빌드 및 E2E 테스트 | `docker compose up -d && npx playwright test` | ✅ |

---

## 5. 검증 결과

| # | 검증 항목 | 결과 |
|---|----------|------|
| 1 | `./gradlew clean build` | ✅ BUILD SUCCESSFUL (Unit + Integration 전체 통과) |
| 2 | `curl http://localhost:8080/api/senior/faq` | ✅ 200 OK |
| 3 | `npx playwright test api/senior-faq.spec.ts` | ✅ 8/8 passed |
| 4 | `npx playwright test ui/senior.spec.ts` | ✅ 6 passed + 2 skipped (KB 관련) |
| 5 | Senior E2E 전체 | ✅ **14 passed, 2 skipped, 0 failed** |
