# Changelog

## v2026.08.26 — 2026-08-26

### ✨ Features
- Android 테스트 자동화 — Appium 드라이버 + 실행 대상 종류 선언

### 🐛 Fixes
- 이력서 PDF 2개 누락 — 프로덕션 다운로드 버튼 복구

### 📝 Docs
- registry_v24 — Android 트랙 분리 + 구현 후 실측 기록
- changelog v2026.08.24

### 🔧 Chore
- .mcp.json 추적 해제 — 머신 종속 경로

## v2026.08.24 — 2026-08-24

### 🐛 Fixes
- 평문 admin 크리덴셜 제거 — .env.example / V16 주석
- frontend required check 이름 불일치 — matrix 제거

### 📝 Docs
- poc_testplan.md 삭제 — 평문 크리덴셜 제거
- ops v35 — v34 통합 및 레포 정리 인벤토리
- changelog v2026.08.20.1359

## v2026.08.20.1359 — 2026-08-20

_변경 사항 없음 ([type] 커밋 기준)_

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

