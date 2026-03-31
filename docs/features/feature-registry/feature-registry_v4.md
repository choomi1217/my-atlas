# feature-registry_v4

## 개요

Input View 기능을 삭제하고, Tree View 기반으로 Path를 관리한다.
TestCase 추가/수정 폼은 모달로 통일하고, QA 작성 흐름에 맞게 필드 구조와 순서를 전면 개선한다.

---

## 1. Tree View — Path 관리

### 1-1. Path 등록 방법

- Tree View에 Root Path가 없는 경우, 직접 Root Path를 등록하는 입력 필드를 노출한다.
- Root Path가 존재하는 경우, 노드를 마우스 오른쪽 클릭하면 Context Menu가 열린다.
- Context Menu를 통해 선택한 노드의 상단 또는 하단에 새 Path를 추가할 수 있다.
- Root Path 상단에 새 Path를 추가하면, 기존 Root Path는 자동으로 새 Path의 하위 노드로 이동한다.
  - 기존 Root Path의 자식 노드들은 구조 그대로 유지된다.

### 1-2. Context Menu 지원 기능

마우스 오른쪽 클릭 시 노출되는 메뉴 항목은 다음과 같다.

1. 상단에 Path 추가
2. 하단에 Path 추가
3. Path 삭제
   - Root Path는 삭제할 수 없다.
   - 삭제 버튼은 Root Path에서 disabled 처리한다.

### 1-3. Add Test Case 버튼 동작

1. Tree View에서 원하는 Path 노드를 클릭하여 선택한다.
2. "Add Test Case" 버튼을 클릭한다.
3. TestCase 추가 모달이 오픈된다.
4. 모달 상단 Path breadcrumb에 1번에서 선택한 Path가 자동으로 표시된다. (읽기 전용)
5. 저장 시 모달이 닫히고, 선택한 Path에 TestCase가 즉시 추가된다.

---

## 2. TestCase 폼 모달 (Add / Edit 공통)

Add Test Case와 Edit 모두 동일한 모달 컴포넌트를 사용한다.
진입 방식만 다르고 폼 구조와 필드는 동일하다.

| 진입 | 트리거 | Path breadcrumb | 저장 버튼 |
|------|--------|-----------------|-----------|
| Add  | Tree View에서 Path 선택 후 "Add Test Case" 버튼 클릭 | 선택한 Path 자동 표시 (읽기 전용) | "Create" |
| Edit | TestCase 카드의 "Edit" 버튼 클릭 | 해당 TC의 Path 표시 (읽기 전용) | "Save" |

**공통 동작**
- 모달 외부 클릭 또는 Cancel 버튼으로 닫힌다.
- 닫을 때 변경사항이 있으면 "저장하지 않고 닫으시겠습니까?" 확인 다이얼로그를 표시한다.

### 2-1. 필드 구성 및 순서

QA 작성 흐름(어디서 → 무엇을 → 어떤 조건에서 → 어떻게 → 결과)에 맞게 필드 순서를 정렬한다.

| 순서 | 필드 | 필수 여부 | 설명 |
|------|------|-----------|------|
| 1 | Path breadcrumb | 필수 | Tree View에서 선택한 Path. 수정 불가 (읽기 전용 표시) |
| 2 | Title | 필수 | TestCase 제목 |
| 3 | Preconditions | 선택 | 테스트 실행 전 전제 조건 |
| 4 | Steps | 필수 | Action + Step Expected Result (아래 상세 참고) |
| 5 | Overall Expected Result | 선택 | 전체 흐름의 최종 기대 결과 |
| 6 | Priority / Type / Status | 선택 | 고급 옵션 (기본 접힘 상태로 제공) |
| 7 | Description | 선택 | 사람이 읽는 기능 설명 |
| 8 | Prompt text | 선택 | AI 드래프트 생성 시 참고할 추가 컨텍스트 |

### 2-2. Steps 상세 설계

#### 기본 동작

- Steps 섹션은 기본적으로 Action 입력칸 1개가 열린 상태로 시작한다.
- "＋ Add Step" 버튼으로 Step row를 추가할 수 있다.
- 각 Step row 우측의 × 버튼으로 해당 Step을 삭제할 수 있다.

#### Step Expected Result — 클릭 온디맨드 방식

기존 방식의 문제:

```
Steps
1. A 버튼 클릭
2. A 화면 노출       ← 1번의 기대결과인데 Action 칸에 섞어서 작성해야 했음
3. A-1 버튼 클릭

Expected Result
1. 팝업창이 나온다.  ← 3번의 기대결과
```

개선 방식:

- 각 Step row에는 기본적으로 Action 입력칸만 노출된다.
- Action 입력칸 옆 "＋ Expected" 버튼을 클릭하면, 해당 Step 바로 아래에
  "Step expected result" 입력칸이 열린다.
- Step expected result는 선택(optional) 항목이며, 필요한 Step에만 추가한다.
- 입력칸이 열린 상태에서 버튼 텍스트는 "✓ Expected"로 변경되어 입력 여부를 시각적으로 표시한다.
- 입력칸 우측 × 버튼으로 해당 Step의 expected result를 제거할 수 있다.

개선 후 동일한 TC 작성 예시:

```
Step 1  Action: A 버튼 클릭
        Step expected result: A 화면이 노출된다.   ← [+ Expected] 클릭 후 입력

Step 2  Action: A-1 버튼 클릭
        (Step expected result 없음)

Overall Expected Result: 팝업창이 노출된다.
```

#### Step row UI 구조

```
[ 번호 ] [ Action 입력칸 ················ ] [ + Expected ] [ × ]
          [ Step expected result 입력칸 · ]               [ × ]  ← 클릭 시 열림
```

### 2-3. Overall Expected Result

- Steps 섹션 아래에 별도 필드로 제공한다.
- 역할: 개별 Step의 기대결과가 아닌, 이 TestCase 전체의 최종 판정 기준을 기술한다.
- 선택(optional) 항목이다.

### 2-4. Priority / Type / Status — 고급 옵션

- 기본적으로 접힌 상태(collapsed)로 제공한다.
- 클릭 시 펼쳐지며 3개 셀렉트를 노출한다.
- 기본값: Priority = MEDIUM, Type = FUNCTIONAL, Status = DRAFT
- 생성 시점에 Status는 항상 DRAFT로 고정한다. (목록에서 변경 가능)

### 2-5. Description / Prompt text

- Description: 이 TestCase가 검증하는 기능을 사람이 읽기 좋게 서술하는 필드
  - placeholder 예시: "소셜 로그인 후 메인 페이지 진입 여부를 검증한다."
- Prompt text: AI 드래프트 생성 시 Claude에게 전달되는 추가 컨텍스트
  - placeholder 예시: "실패 케이스 중점 생성, 네트워크 오류 시나리오 포함"
  - 필드 레이블 옆에 "AI 드래프트 생성 시 참고" 부연 텍스트를 표시한다.

---

## 3. TestCase 목록 — Accordion

### 3-1. 목록 표시 방식

- TestCase 목록은 Accordion 카드 형태로 표시한다.
- 기본 상태: 카드가 접혀있으며 핵심 정보만 한눈에 표시한다.
- 카드 헤더 클릭 시 해당 카드가 펼쳐지며 상세 내용을 표시한다.
- 여러 카드를 동시에 펼칠 수 있다.

### 3-2. 접힌 상태 — 카드 헤더 표시 항목

```
[ ▶ ] [ Title          ] [ Path          ] [ Priority ] [ Type ] [ Status ] [ Edit ] [ Delete ]
```

- Title: TestCase 제목
- Path: 해당 TC가 속한 Path (예: LNB > My Senior)
- Priority / Type / Status: 배지(badge) 형태로 표시

### 3-3. 펼쳐진 상태 — 카드 본문 표시 항목

| 항목 | 표시 방식 |
|------|-----------|
| Description | 텍스트 |
| Steps | 번호 목록. Step expected result가 있는 경우 해당 Step 아래에 들여쓰기로 표시 |
| Overall Expected Result | 있는 경우에만 표시 |
| Created date | 하단에 muted 텍스트로 표시 |

Steps 표시 예시:
```
1. A 버튼 클릭
   Expected: A-1 Section 오픈
2. A-1 버튼 클릭
   Expected: 팝업창 오픈
```

### 3-4. Edit / Delete 버튼 동작

- Edit: 해당 TestCase의 정보가 채워진 편집 모달을 오픈한다. (2번 섹션과 동일한 모달)
- Delete: 확인 다이얼로그 표시 후 삭제한다.
- 두 버튼 모두 카드 헤더 우측에 배치하며, 카드 헤더 클릭(펼침/접힘) 이벤트와 충돌하지 않도록 이벤트 전파를 차단한다.

---

## 4. 변경 요약

| 항목 | 기존 | 변경 |
|------|------|------|
| Path 입력 방식 | Cascading Input View (삭제) | Tree View Context Menu로 통합 |
| Add TestCase 진입 방식 | 화면 하단 Accordion 섹션 오픈 | 모달 오픈 |
| Edit 진입 방식 | — | 모달 오픈 (Add와 동일한 컴포넌트) |
| 폼 일관성 | Add와 Edit 진입 방식 상이 | 모달로 통일 |
| 필드 순서 | Path → Title → Description → Prompt text → Priority/Type/Status → Preconditions → Steps → Expected Result | Path → Title → Preconditions → Steps → Overall Expected Result → 고급 옵션 → Description → Prompt text |
| Step Expected Result | Steps와 별도 Expected Result 필드에 혼재 | 각 Step row에 온디맨드 버튼으로 추가 |
| Priority/Type/Status 위치 | 폼 중간 노출 | 기본 접힘 상태 (고급 옵션) |
| Description / Prompt text 구분 | placeholder 외 구분 없음 | 레이블 부연 텍스트로 역할 명확화 |
| TestCase 목록 표시 | 카드 항상 펼쳐진 상태 | Accordion (기본 접힘, 클릭 시 펼침) |