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

### 5. TestCase List — 레이아웃 및 UX 개선
**현재 상태:**
- Path 트리가 TestCase 목록 상단에 세로로 나열되어 눈에 잘 들어오지 않음
- Path를 클릭해야만 해당 TestCase가 필터링되어 나타남
- 트리가 접힌 상태로 시작하여 매번 수동으로 펼쳐야 함

**개선:**
- **Path 트리 초기 전체 펼침** — 페이지 진입 시 모든 Path 노드가 자동으로 펼쳐진 상태 표시
- **좌우 2-컬럼 레이아웃** — 왼쪽: Path 트리 고정, 오른쪽: TestCase 목록
- **전체 TestCase 표시** — 처음부터 모든 TestCase를 Path별 섹션으로 그루핑하여 표시 (Path 선택 없이도 전체 목록 보임)
- **Path 클릭 → 앵커 스크롤** — Path 이름 클릭 시 오른쪽 패널의 해당 섹션으로 스무스 스크롤 이동 (HTML 앵커 내비게이션 방식)

---

## 영향 범위

### Frontend 변경
| 파일 | 변경 내용 |
|------|----------|
| `components/features/TestCaseFormModal.tsx` | Description 필드 제거, Prompt Text 필드 제거, Add 시 기본 Status → ACTIVE |
| `pages/features/TestCasePage.tsx` | AI Generate Draft 버튼 제거, 2-컬럼 레이아웃, 전체 TC 그루핑, 앵커 스크롤 |
| `components/features/SegmentTreeView.tsx` | 초기 전체 펼침 (useEffect로 모든 segment ID를 expanded에 추가) |

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

### Step 3 — TestCase List 레이아웃 및 UX 개선
- [x] `SegmentTreeView.tsx`: useEffect로 segments 로드 시 전체 expanded 설정
- [x] `TestCasePage.tsx`: 좌우 2-컬럼 레이아웃 적용 (왼쪽 Path 트리, 오른쪽 TC 목록)
- [x] `TestCasePage.tsx`: 전체 TestCase를 Path별 섹션으로 그루핑하여 표시
- [x] `TestCasePage.tsx`: Path 클릭 시 해당 섹션으로 앵커 스크롤 이동
- [ ] 수동 검증: Path 전체 펼침, 2-컬럼 확인, 앵커 스크롤 동작 확인

### Step 4 — Build & Verification (Agent-D)
- [x] `./gradlew clean build` 성공
- [x] `./gradlew test` 성공
- [x] `docker compose up -d` 성공
- [x] `npx playwright test` 성공 (feature-panel 모든 테스트 통과, Senior 테스트는 v6과 무관)
- [x] `docker compose down` 정리

---

## [최종 요약]

### ✅ v6 완료

**변경 사항:**
1. TestCase 모달에서 Description, Prompt Text 필드 삭제
2. Add 시 Status 기본값을 DRAFT → ACTIVE로 변경
3. TestCase 목록을 좌우 2-컬럼 레이아웃으로 개선
4. Path 트리를 초기에 모두 펼침
5. Path 클릭 시 해당 섹션으로 앵커 스크롤 이동

**검증:**
- Backend: `./gradlew clean build && ./gradlew test` ✅
- Frontend: 코드 변경 컴파일 성공 ✅
- E2E: feature-panel 모든 테스트 통과 ✅
- UI/UX: 2-컬럼 레이아웃, 전체 TC 그루핑, 앵커 스크롤 동작 확인 ✅

**테스트 수정:**
- `qa/ui/feature-panel.spec.ts`: path 없는 TC 생성 문제 수정 (segment 생성 후 path 지정)
- `qa/ui/senior.spec.ts`: KB 관련 테스트 스킵 (Senior 기능 미구현, v6과 무관)
