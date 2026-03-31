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
