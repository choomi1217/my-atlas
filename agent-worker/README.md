# my-atlas Agent Worker (registry_v20)

TC를 **AI 에이전트가 브라우저에서 실행·판정**하는 Node 사이드카 워커.
Phase 0 PoC(Playwright MCP + Claude)에서 검증한 실행 루프의 제품화.

## 동작 (폴링 통신)

```
login(admin) → claim(job) → getContext(job)
  → chromium 구동 → baseUrl 진입 + seed 로그인(agentic)
  → TC step마다: [Claude가 액션 결정 → Playwright 실행 → Claude가 expected 대조 판정]
  → recordResult(TC별 verdict + step 증적) → complete(DONE/FAILED)
```

- 판정: step 전부 PASS → TC PASS / 하나라도 FAIL → FAIL / (FAIL 없이) 모호 → INCONCLUSIVE
- INCONCLUSIVE는 백엔드에서 TestResult RETEST로 매핑되어 사람 확인 대기열이 됨 (Phase 3)
- **수동 트리거 전용** (LLM 비용 보호) — Job 하나를 받아 실행 후 종료

## 로컬 실행

```bash
cd agent-worker
npm install
npx playwright install chromium   # 최초 1회
cp .env.example .env               # ANTHROPIC_API_KEY 입력
node src/index.js <jobId>          # 백엔드에서 생성된 agent_execution_job id
```

## 환경변수 (.env)

| 변수 | 설명 |
|------|------|
| `BACKEND_URL` | my-atlas 백엔드 (기본 http://localhost:8085) |
| `AGENT_WORKER_USERNAME/PASSWORD` | 백엔드 로그인 (시드 계정 id/password, `.env`에 직접 설정) |
| `ANTHROPIC_API_KEY` | Claude 호출 키 (필수) |
| `AGENT_MODEL` | 모델명 (기본 claude-haiku-4-5-20251001) |
| `HEADLESS` | 헤드리스 여부 (docker면 true) |
| `MAX_STEP_ACTIONS` | step당 최대 액션 시도 (토큰/시간 상한) |

## 전제

- 대상 Product에 **실행 프로파일**(`exec_base_url`, `exec_seed_note`)이 설정되어 있어야 함
- 마이그레이션 `V202607141600` 적용된 백엔드 (앱 부팅 시 Flyway)
- Node ≥ 20 (Playwright `URL.canParse` 요구)

## 구조

```
src/
├── index.js    # 진입점 (오케스트레이션: login→claim→context→run→record→complete)
├── backend.js  # 백엔드 API 클라이언트 (JWT)
└── agent.js    # 브라우저 에이전트 루프 (Playwright 관측 + Claude 액션/판정)
```
