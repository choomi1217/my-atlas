# feature-registry_v6
Feature Registry — TestCase 모달 UI 다듬기

## 변경 유형
기능 개선

## 배경
v5에서 TestCase Add/Edit 모달, Company/Product 목록 UX, ConfirmDialog 등 대규모 UI 개선을 완료했다.
실제 사용 과정에서 불필요한 필드와 추가 개선점이 발견되어 UI를 다듬는다.

---

## 개선 항목

### 1. TestCase 모달 — Description 필드 삭제
**현재 상태:**
- TestCase Add/Edit 모달에 Description 텍스트 영역이 존재
- Title, Prompt Text, Preconditions, Steps 등과 역할이 중복되어 실제 사용하지 않음

**개선:**
- `TestCaseFormModal.tsx`에서 Description 필드(라벨 + textarea) 제거
- Backend DTO/엔티티의 `description` 컬럼은 유지 (기존 데이터 보존, nullable)
- 모달 레이아웃: Title → Priority/TestType/Status → Preconditions → Steps 순서로 정리

### 2. TestCase 모달 — Prompt Text 필드 삭제
**현재 상태:**
- TestCase Add/Edit 모달에 Prompt Text 텍스트 영역이 존재
- AI 기능이 아직 미구현 상태로, 현재 사용하지 않는 필드

**개선:**
- `TestCaseFormModal.tsx`에서 Prompt Text 필드(라벨 + textarea) 제거
- Backend DTO/엔티티의 `promptText` 컬럼은 유지 (추후 AI 기능 개발 시 활용, nullable)

### 3. TestCase List — AI Generate Draft 버튼 삭제
**현재 상태:**
- TestCase 목록에 AI Generate Draft 버튼이 존재
- AI 기능이 아직 미구현 상태로 동작하지 않음

**개선:**
- `TestCasePage.tsx`에서 AI Generate Draft 버튼 제거
- 추후 AI 기능 개발 시 backlog에서 복원 예정

### 4. TestCase 모달 — 기본 Status를 ACTIVE로 변경
**현재 상태:**
- TestCase Add 시 Status 기본값이 `DRAFT`로 설정됨
- 실제 사용 시 대부분 바로 `ACTIVE`로 변경하므로 매번 수동 변경이 불편

**개선:**
- `TestCaseFormModal.tsx`에서 Add 모드일 때 Status 초기값을 `ACTIVE`로 변경
- Edit 모드는 기존 값 유지

### 5. (추가 예정 — User 테스트 후 기재)

---

## 영향 범위

### Frontend 변경
| 파일 | 변경 내용 |
|------|----------|
| `components/features/TestCaseFormModal.tsx` | Description 필드 제거, Prompt Text 필드 제거, Add 시 기본 Status → ACTIVE |
| `pages/features/TestCasePage.tsx` | AI Generate Draft 버튼 제거 |

### Backend 변경
없음 (DB 컬럼 유지, 프론트에서만 필드 숨김)

---

## 구현 계획

### Step 1 — TestCaseFormModal 개선
- [x] Description 라벨 + textarea 제거
- [x] Prompt Text 라벨 + textarea 제거
- [x] formData 초기값에서 description, promptText 관련 state 정리 (emptyForm에 빈 문자열 유지 → 기존 데이터 보존)
- [x] onSubmit 시 해당 필드 전송 여부 확인 (빈 문자열로 전송 → Backend nullable 유지)
- [x] Add 모드 시 Status 기본값을 `DRAFT` → `ACTIVE`로 변경

### Step 2 — TestCasePage AI 버튼 제거
- [x] AI Generate Draft 버튼 제거
- [x] `handleGenerateDraft` 함수 및 `isGenerating` state 제거
- [x] 빈 목록 안내 문구에서 AI draft 언급 제거

### Step 3 — (User 추가 개선사항 반영 후 기재)

### Step 4 — Build & Verification (Agent-D)
- [ ] `./gradlew clean build` 성공
- [ ] `./gradlew test` 성공
- [ ] `docker compose up -d` 성공
- [ ] `npx playwright test` 성공
- [ ] `docker compose down` 정리
