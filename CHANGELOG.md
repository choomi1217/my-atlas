# Changelog

## v2026.08.21 — 2026-08-21

### 🐛 Fixes
- 문서 전용 PR이 required check 대기로 영구 교착되는 문제 (#149)

## v2026.08.11.0653 — 2026-08-11

### ✨ Features
- registry_v20 에이전트 워커 — Node 사이드카 (Playwright 브라우저 조작)
- registry_v20 마무리 — Vite 컨테이너 접속 설정 + CI 결과 import
- registry_v20 Product 실행 프로파일 필드 (exec_base_url/exec_seed_note)
- registry_v20 Agentic Test Execution 프론트엔드 — AI 실행 UI
- registry_v20 Agentic Test Execution 백엔드 — 실행 엔진 도메인

### 🐛 Fixes
- agent-worker/.env.example — admin/admin 예시값 제거
- 문서/UI에 노출된 admin/admin 자격증명 문구를 일반화
- CI TestResult import — admin 로그인 자격증명을 GitHub Secrets로 이동
- develop 병합으로 새로 들어온 TestStudioGeneratorTest 테스트의 ProductEntity 생성자 인자 수 보정

### 📝 Docs
- changelog v2026.08.11
- registry_v20 명세 + 오늘 세션 하드닝 기록, TC 작성 가이드라인
- changelog v2026.08.06

### 🔧 Chore
- Claude 자동 코드 리뷰 트리거 제어 (ops v33)

## v2026.08.11 — 2026-08-11

_변경 사항 없음 ([type] 커밋 기준)_

## v2026.07.03 — 2026-07-03

### ♻️ Refactor
- AnthropicChatOptions 빌더를 지역 변수로 추출 (가독성/일관성)

### 🔧 Chore
- Spring Boot 4.0 + Spring AI 2.0 GA 마이그레이션 (ops v32)

