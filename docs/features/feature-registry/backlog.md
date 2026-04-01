# Feature Registry — 개선 백로그

버전 미정 개선사항을 기록하는 파일.
비슷한 항목끼리 묶어서 버저닝 예정.

---

## 미분류 개선사항

### 1. TestCase의 Product 간 이동 기능
**배경:**
- Company는 거의 고정이지만, Product는 프로젝트가 성장하면서 재구성이 필요할 수 있음
- 예: 처음에 "Atlas" 하나의 Product로 TestCase를 작성했지만, 규모가 커지면서 LNB 메뉴별로 Product를 분리하고 싶어짐 (MySenior, Knowledge Base, WordConvention 등)
- 이때 기존 TestCase를 새 Product로 옮길 수 있어야 함

**필요 기능:**
- TestCase를 다른 Product로 이동 (단건 또는 다건)
- 이동 시 Segment(Path) 매핑 처리 고려 필요

### 2. TestCase AI 기능 (v6에서 임시 삭제, 추후 재개발)
**배경:**
- v6에서 Prompt Text 필드와 AI Generate Draft 버튼을 삭제함
- AI 기능이 미구현 상태였으므로 UI만 먼저 정리
- 추후 AI 기능을 제대로 설계하여 재도입 예정

**삭제된 항목:**
- TestCase 모달의 `Prompt Text` 입력 필드 (DB 컬럼 `promptText`는 유지)
- TestCase 목록의 `AI Generate Draft` 버튼

**추후 개발 시 고려사항:**
- AI가 TestCase를 자동 생성/보완하는 기능 설계
- Prompt Text 필드 복원 또는 새로운 AI 인터페이스 설계

### 3. Test Run (테스트 수행) 기능
**배경:**
- TestCase를 작성하는 것과 별개로, 특정 버전/릴리스에 대해 어떤 TestCase들을 수행할지 선택하고 결과를 기록하는 기능이 필요
- TestRail의 Test Run 개념과 유사: TestCase 풀에서 원하는 케이스를 골라 Test Run을 생성하고, 각 케이스의 수행 결과(Pass/Fail 등)를 기록
- 현재는 TestCase 작성만 가능하고, 실제 테스트 수행 이력을 관리할 수 없음

**핵심 개념:**
- **Test Run**: 특정 버전/목적에 대해 수행할 TestCase 묶음 (예: "v2.1 릴리스 QA", "핫픽스 검증")
- **Test Result**: Test Run 내 각 TestCase의 수행 결과 (Pass, Fail, Blocked, Skipped, Retest 등)

**필요 기능:**
- Test Run 생성 시 대상 TestCase 선택 (다건 선택)
- Test Run에 버전/릴리스명, 설명 등 메타데이터 부여
- 각 TestCase별 결과 상태 선택 (Pass / Fail / Blocked / Skipped / Retest 등)
- 결과에 코멘트/비고 작성 가능
- Test Run 단위 진행률 확인 (예: 15/30 완료, Pass 12 / Fail 2 / Blocked 1)
- Test Run 이력 관리 (과거 Run 조회, 버전별 비교)
