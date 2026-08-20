# Knowledge Base v8 — "도서" 워딩 제거 + 소스 익명화 리브랜딩

> 변경 유형: 기능 개선
> 작성일: 2026-04-23
> 버전: v8
> 상태: 진행 중

---

## 배경

포트폴리오/면접 시연용으로 운영되는 `youngmi.works` 서비스에서 현재 KB에 저장된 PDF 청크의 **출처 도서명**(`소프트웨어 테스팅 실무`)과 **"PDF 도서" / "도서" / "책 제목"** 같은 워딩이 그대로 노출되고 있다. 
상용 서적을 추출·청킹하여 DB에 보관·전송하는 형태는 **저작권 리스크**가 있어, 외부에서 출처 서적을 식별할 수 없도록 리브랜딩한다.

**방침 결정 (v7 논의 결과 반영)**
- **기능 자체는 유지**: PDF 파싱·청킹·임베딩·RAG 파이프라인은 포트폴리오 기술 증명용으로 그대로 둔다.
- **서비스 포지셔닝 재정의**: "PDF 도서 AI" → "**팀/개인 QA 문서 AI**". README·UI·이력서의 서사 수정.
- **기존 청크 데이터 보존**: 재임베딩은 비용·시간이 들어 하지 않는다. `source` 값만 익명 라벨로 UPDATE.
- **소스 라벨은 2~3개로 분산** (옵션 B 확정) — 단일 라벨은 "한 권에서 나온 티"가 남아 "이거저거 긁어모은 데이터인 척" 연출에 불리.
- **파일명 / 엔드포인트 / 내부 필드명 (bookTitle 등)은 그대로 둔다**: 외부 노출 없음 + 변경 비용 크고 DB 마이그레이션 유발.
- **범위**: 외부 노출되는 UI 문자열·서사 문구·AI 프롬프트 + DB `source` 값 익명화.

---

## 확정 워딩 매핑

용어 기본은 **"레퍼런스"**.

| 현재 표현 | 새 표현 (확정) |
|-----------|----------------|
| PDF 도서 | 레퍼런스 |
| 도서 (뱃지) | 레퍼런스 |
| 책 제목 (모달 라벨) | 레퍼런스명 |
| PDF 업로드 (버튼) | 레퍼런스 추가 |
| PDF 업로드 (모달 헤더) | 레퍼런스 추가 |
| PDF 파일 (라벨) | 파일 선택 |
| 업로드된 PDF 도서가 없습니다 | 업로드된 레퍼런스가 없습니다 |
| KB 항목이 없습니다. 직접 작성하거나 PDF를 업로드하세요. | KB 항목이 없습니다. 직접 작성하거나 레퍼런스를 추가하세요. |
| 도서 단위 일괄 삭제 | 레퍼런스 단위 일괄 삭제 |
| 책 전체 삭제 (툴팁) | 레퍼런스 전체 삭제 |
| 도서 참고 (senior system prompt) | 레퍼런스 |
| 도서: {source} (수정 페이지) | 출처: {source} |
| QA 도서(ISTQB, 테스트 설계 등) | QA 학습 노트·레퍼런스 자료 |
| PDF 도서 업로드 시 자동 청킹 (이력서) | PDF 문서 업로드 시 자동 청킹 |

---

## DB 소스 익명화 (옵션 B — 2~3개 분산)

### 기본 전략

`knowledge_base.source = '소프트웨어 테스팅 실무'` 청크를 **제목/카테고리 패턴에 따라 2~3개 의미있는 라벨로 분산**한다.

### 라벨 후보 (User 확정 필요)

| 후보 세트 | 라벨 | 분산 기준(예시) |
|-----------|------|----------------|
| **세트 A (주제 기반 3개)** | `테스트 설계 레퍼런스` | title/content에 "설계·테스트 케이스·블랙박스·화이트박스·동등분할·경계값" 포함 |
|  | `QA 프로세스 레퍼런스` | title/content에 "프로세스·워크플로우·조직·역할·계획" 포함 |
|  | `QA 기초 레퍼런스` | 나머지 모든 청크 (fallback) |
| **세트 B (매체 기반 2개)** | `QA 학습 노트` | 홀수 id |
|  | `QA 레퍼런스 자료` | 짝수 id |
| **세트 C (중립 3개)** | `QA 레퍼런스 #1` | id % 3 == 0 |
|  | `QA 레퍼런스 #2` | id % 3 == 1 |
|  | `QA 레퍼런스 #3` | id % 3 == 2 |

**권장**: 세트 A — 의미 있는 분류라 RAG "(레퍼런스: QA 프로세스 레퍼런스)" 같은 인용이 자연스러움. 단, 패턴 매칭이 실제 데이터에 맞는지 운영 DB 탐색 후 확정.

### 운영 DB 탐색 쿼리 (User 실행 필요)

세트 A를 쓰려면 실제 청크 제목/카테고리 분포를 먼저 봐야 한다. 아래를 **EC2 SSH 후 Postgres 컨테이너**에서 실행:

```bash
ssh -i ~/.ssh/my-atlas-key.pem ec2-user@3.34.154.147
docker exec -it $(docker ps --format '{{.Names}}' | grep -i postgres) \
  psql -U myqaweb -d myqaweb
```

```sql
-- 1. 총 청크 수
SELECT COUNT(*) FROM knowledge_base
 WHERE source = '소프트웨어 테스팅 실무' AND deleted_at IS NULL;

-- 2. 카테고리 분포
SELECT category, COUNT(*) FROM knowledge_base
 WHERE source = '소프트웨어 테스팅 실무' AND deleted_at IS NULL
 GROUP BY category ORDER BY COUNT(*) DESC;

-- 3. 제목 샘플 20개
SELECT id, category, title FROM knowledge_base
 WHERE source = '소프트웨어 테스팅 실무' AND deleted_at IS NULL
 ORDER BY id LIMIT 20;

-- 4. pdf_upload_job
SELECT id, book_title, status, total_chunks FROM pdf_upload_job;
```

User가 결과 공유 → 분산 SQL 확정.

### 최종 UPDATE SQL 틀 (세트 A 기준)

```sql
BEGIN;

-- knowledge_base 분산 익명화
UPDATE knowledge_base
   SET source = CASE
     WHEN title ~* '(설계|테스트 케이스|블랙박스|화이트박스|동등분할|경계값)' THEN 'QA 테스트 설계 레퍼런스'
     WHEN title ~* '(프로세스|워크플로우|조직|역할|계획|관리)' THEN 'QA 프로세스 레퍼런스'
     ELSE 'QA 기초 레퍼런스'
   END
 WHERE source = '소프트웨어 테스팅 실무';

-- 분산 결과 확인
SELECT source, COUNT(*) FROM knowledge_base
 WHERE source LIKE 'QA %' GROUP BY source;

-- pdf_upload_job도 갱신 (대표 라벨 or CASE)
UPDATE pdf_upload_job
   SET book_title = 'QA 레퍼런스 자료 모음'
 WHERE book_title = '소프트웨어 테스팅 실무';

-- 확인 후 COMMIT 또는 ROLLBACK
-- COMMIT;
-- ROLLBACK;
```

---

## 영향 범위 (전수 조사 결과)

### Frontend (외부 노출 — 필수 수정)

| 파일 | 라인 | 현재 표현 |
|------|------|-----------|
| `pages/KnowledgeBasePage.tsx` | 9, 87, 131, 145, 165, 167, 182 | 탭 `PDF 도서`, 버튼 `PDF 업로드`, 툴팁 `책 전체 삭제`, 빈 상태 2건, `도서` 뱃지 |
| `pages/KbDetailPage.tsx` | 66 | `도서` 뱃지 |
| `pages/KbEditPage.tsx` | 65 | `도서: {source}` 표시 ← **source 익명 라벨이 그대로 보이는 지점** |
| `components/kb/PdfUploadModal.tsx` | 57, 64, 96 | 헤더 `PDF 업로드`, 라벨 `책 제목`, 라벨 `PDF 파일` |
| `components/kb/PdfJobStatusCard.tsx` | 58 | `{job.bookTitle}` 표시 (익명 라벨이 출력될 자리) |
| `components/senior/FaqCard.tsx` | 31 | `PDF` 라벨 |
| `components/overview/FeaturesSection.tsx` | 12-14 | `PDF 업로드 파이프라인`, 태그 `PDF` |
| `data/featureDetails.ts` | 109, 133-175, 184-191 | KB 도메인 카드: `PDF 도서`, `QA 도서(ISTQB, 테스트 설계 등)`, `source=도서명`, PDF 중심 서사 |
| `components/resume/WorkExpTab.tsx` | 368 | `PDF 도서 업로드 시 자동 청킹...` |
| `public/resume/index.html` | 346 | 동일 문구 정적 HTML |

### Backend (외부로 새는 문자열만)

| 파일 | 라인 | 변경 |
|------|------|------|
| `senior/SeniorServiceImpl.java` | 198 | system prompt `"=== QA Knowledge Base (도서 참고) ===\n"` → `"=== QA Knowledge Base (레퍼런스) ===\n"` |
| `senior/SeniorServiceImplTest.java` | 247, 270, 291 | assertion 문자열 동반 수정 |

**건드리지 않는 것 (내부 식별자)**
- `bookTitle` 파라미터/필드/컬럼(`book_title`), `/api/kb/upload-pdf` 엔드포인트, `PdfUploadModal` 컴포넌트명, `PdfUploadJob` 엔티티 등. 외부 노출 없음 + 변경 비용 크고 DB 마이그레이션 유발.
- 서버 로그 메시지 (`log.info("... book='{}'")`) — 외부 공개 안 됨.

### DB

| 테이블 | 컬럼 | 현재 값 | 새 값 |
|--------|------|---------|-------|
| `knowledge_base` | `source` | `소프트웨어 테스팅 실무` | 세트 A 기준 2~3개 라벨 분산 |
| `pdf_upload_job` | `book_title` | `소프트웨어 테스팅 실무` | `QA 레퍼런스 자료 모음` (단일) |

**규칙 준수**: DELETE / TRUNCATE / DROP 금지. `UPDATE` 트랜잭션 내에서만. User가 직접 실행.

### 테스트 픽스처 (선택적)

| 파일 | 내용 | 조치 |
|------|------|------|
| `KnowledgeBaseServiceImplTest.java:220` | `pdf.setSource("ISTQB Book")` | `"Reference Book"` 등으로 변경 권장 |
| `PdfProcessingWorkerTest.java:85, 92` | `"ISTQB Foundation Level Syllabus"` | `"QA Reference Document"` 등 |
| `PdfPipelineServiceImplTest.java` | `"테스트 도서"` (이미 중립) | 유지 |

GitHub 공개 레포 노출 문자열이라 일관성 차원에서 같이 다듬는 걸 권장.

### E2E 셀렉터 체크

- Step 6 전에 `grep "PDF 도서\|책 제목\|도서" qa/` 필요. 있으면 새 워딩으로 치환.

---

## Phase별 실행 계획

### Phase 0 — 사전 준비 ✅

- [x] Step 0.1 — Worktree sync (reset + 심링크 재생성) — phantom 2 ahead 제거, develop HEAD 동기화
- [x] Step 0.2 — 워딩 매핑 확정 ("레퍼런스"), 옵션 B 확정

### Phase 1 — 운영 DB 탐색 + 분산 SQL 확정 (User 주도)

- [ ] Step 1.1 — User: EC2 SSH → 위 탐색 쿼리 4개 실행 → 결과 공유
- [ ] Step 1.2 — 결과 기반 세트 A/B/C 선택 및 패턴 조정
- [ ] Step 1.3 — 최종 UPDATE SQL 확정 (dry-run SELECT로 분산 결과 미리 확인)

### Phase 2 — Frontend 워딩 일괄 치환

- [ ] Step 2.1 — `pages/KnowledgeBasePage.tsx`: 탭 라벨·버튼·빈 상태·뱃지·툴팁
- [ ] Step 2.2 — `pages/KbDetailPage.tsx` + `pages/KbEditPage.tsx`: 뱃지·출처 표기
- [ ] Step 2.3 — `components/kb/PdfUploadModal.tsx`: 헤더·라벨
- [ ] Step 2.4 — `components/kb/PdfJobStatusCard.tsx`: 표시 라벨
- [ ] Step 2.5 — `components/senior/FaqCard.tsx`: PDF 뱃지 → 레퍼런스 뱃지
- [ ] Step 2.6 — `components/overview/FeaturesSection.tsx`: 홈 요약 리라이트
- [ ] Step 2.7 — `data/featureDetails.ts`: KB 카드 서사 전면 개정 (ISTQB 언급 제거, "QA 학습 노트 + 레퍼런스 자료" 내러티브)
- [ ] Step 2.8 — 이력서: `WorkExpTab.tsx` + `public/resume/index.html`

### Phase 3 — Backend system prompt 중립화

- [ ] Step 3.1 — `SeniorServiceImpl.java:198` 프롬프트 문자열 수정
- [ ] Step 3.2 — `SeniorServiceImplTest.java` 3곳 assertion 동반 수정
- [ ] Step 3.3 — `./gradlew test --tests SeniorServiceImplTest` 로컬 통과 확인

### Phase 4 — 테스트 픽스처 저작권-safe화

- [ ] Step 4.1 — `KnowledgeBaseServiceImplTest.java:220` 소스 명 변경
- [ ] Step 4.2 — `PdfProcessingWorkerTest.java` 두 곳 ISTQB 문자열 중립화
- [ ] Step 4.3 — 관련 테스트 통과 확인

### Phase 5 — 문서 갱신

- [ ] Step 5.1 — 레포 루트 `README.md` — "도서 참고" 관련 서술 수정
- [ ] Step 5.2 — `docs/features/knowledge-base/knowledge-base.md` 메인 명세서 "도서" / "ISTQB" 치환, 버전 히스토리에 v8 추가
- [ ] Step 5.3 — `docs/features/senior/my-senior.md` "도서 참고" 언급 동반 수정

### Phase 6 — DB UPDATE 실행 (User 주도)

- [ ] Step 6.1 — 로컬 DB: 해당 없음 (현재 로컬은 비어있음)
- [ ] Step 6.2 — **운영 DB UPDATE 실행** — Phase 1.3에서 확정한 SQL을 EC2 Postgres 컨테이너에서 트랜잭션 내 실행, 확인 후 COMMIT

### Phase 7 — Agent-D 검증

- [ ] Step 7.1 — `./gradlew clean build`
- [ ] Step 7.2 — `docker compose up -d --build` + `npx playwright test` (E2E 전체)
- [ ] Step 7.3 — `docker compose down` (무조건 teardown)

### Phase 8 — PR + 배포 + 문서 마감

- [ ] Step 8.1 — PR 생성 (feature/knowledge-base → develop), User가 리뷰·머지
- [ ] Step 8.2 — 배포 완료 후 운영 DB UPDATE 실행 (Phase 6.2) — **배포 순서 주의**: 코드 배포 → DB UPDATE 순이어야 익명 라벨 노출 구간 최소화 (거꾸로면 일시적으로 새 코드가 옛 라벨 표시)
- [ ] Step 8.3 — 배포 직후 smoke test: `/kb` 목록 열어 "레퍼런스" 워딩·익명 라벨 확인
- [ ] Step 8.4 — v8.md 체크박스 갱신 + 상태 `진행 중` → `완료`
- [ ] Step 8.5 — [최종 요약] 섹션 작성

---

## 위험 / 주의

| 항목 | 대응 |
|------|------|
| 기존 청크 재임베딩 필요? | **불필요**. source만 변경, embedding·content·title 그대로라 RAG 벡터 검색 영향 없음 |
| RAG 답변 품질 영향 | system prompt `(도서 참고)` → `(레퍼런스)` 중립화. 답변 스타일 큰 변화 없으나 실 서비스에서 1~2건 smoke test 권장 |
| 배포 vs DB UPDATE 순서 | **코드 배포 먼저 → DB UPDATE 후** — 거꾸로 하면 옛 UI에 새 라벨이 노출되어 부자연 |
| 기존 서버 로그 | 로그의 `book='소프트웨어 테스팅 실무'`는 과거 기록에 남음. 외부 비공개라 OK |
| Playwright E2E 셀렉터 | Phase 7 전 `grep "PDF 도서\|책 제목\|도서 " qa/` 필수. 있으면 같이 수정 |
| 운영 DB 트랜잭션 안전성 | UPDATE는 BEGIN; ... ROLLBACK 옵션 확보. SELECT로 분산 결과 검증 후 COMMIT |
| 분산 CASE 패턴 miss | 운영 DB 제목 분포 탐색 (Phase 1.1) 전에는 패턴 신뢰도 미검증. Step 1.3에서 dry-run SELECT로 분포 확인 필수 |

---

## 변경 유형

- 기능 개선 (UX 문구 + 콘텐츠 서사 + 시스템 프롬프트 중립화 + 운영 데이터 익명화) → 메이저 증가 v7 → **v8**

---

## [최종 요약]

(Phase 8 완료 후 작성)
