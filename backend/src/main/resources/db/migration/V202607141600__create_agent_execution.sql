-- registry_v20 Phase 1 Step 1 — Agentic Test Execution 도메인
-- 신규: agent_execution_job, agent_execution_result
-- 변경: test_result(executed_by, agent_execution_result_id), product(실행 프로파일)
-- 참고: Test Studio Job 패턴 복제 (V202604171800__create_test_studio_job.sql)

-- 실행 Job: scope 단위(단건 dry run | Phase 일괄) 비동기 실행 추적
CREATE TABLE agent_execution_job (
    id                  BIGSERIAL PRIMARY KEY,
    product_id          BIGINT      NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    phase_id            BIGINT      REFERENCES version_phase(id) ON DELETE CASCADE, -- 단건 dry run이면 null
    target_test_case_id BIGINT      REFERENCES test_case(id) ON DELETE CASCADE,     -- SINGLE(dry run) 대상 TC, PHASE_*면 null
    scope               VARCHAR(20) NOT NULL,   -- SINGLE | PHASE_ALL | PHASE_UNTESTED | PHASE_PREV_FAIL
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | RUNNING | DONE | FAILED | CANCELLED
    requested_by        VARCHAR(100),
    error_message       TEXT,
    total_count         INT         NOT NULL DEFAULT 0,
    done_count          INT         NOT NULL DEFAULT 0,
    pass_count          INT         NOT NULL DEFAULT 0,
    fail_count          INT         NOT NULL DEFAULT 0,
    inconclusive_count  INT         NOT NULL DEFAULT 0,
    created_at          TIMESTAMP   NOT NULL DEFAULT now(),
    completed_at        TIMESTAMP
);
CREATE INDEX idx_agent_exec_job_product ON agent_execution_job(product_id, created_at DESC);
CREATE INDEX idx_agent_exec_job_phase   ON agent_execution_job(phase_id);

-- 실행 결과: job 하위, TC별 판정 + step 증적
CREATE TABLE agent_execution_result (
    id                   BIGSERIAL PRIMARY KEY,
    job_id               BIGINT      NOT NULL REFERENCES agent_execution_job(id) ON DELETE CASCADE,
    test_case_id         BIGINT      NOT NULL REFERENCES test_case(id) ON DELETE CASCADE,
    verdict              VARCHAR(20),            -- PASS | FAIL | INCONCLUSIVE
    step_logs            JSONB,                  -- [{order, actionTaken, observed, judgment, screenshotKey}]
    ai_failure_analysis  TEXT,                   -- 제품 결함 / 테스트 결함 / 환경 분류 + 근거
    duration_ms          BIGINT,
    token_cost           INT,
    created_at           TIMESTAMP   NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_exec_result_job ON agent_execution_result(job_id);

-- test_result: 실행 주체 구분 + 증적 역참조 (기존 데이터 호환: 기본 HUMAN)
ALTER TABLE test_result ADD COLUMN executed_by VARCHAR(20) NOT NULL DEFAULT 'HUMAN'; -- HUMAN | AGENT | CI
ALTER TABLE test_result ADD COLUMN agent_execution_result_id BIGINT
    REFERENCES agent_execution_result(id) ON DELETE SET NULL;

-- product: 실행 프로파일 (자격증명은 DB 평문 저장 금지 — 별도 방식으로 이연)
ALTER TABLE product ADD COLUMN exec_base_url  VARCHAR(500); -- 에이전트 실행 대상 baseUrl
ALTER TABLE product ADD COLUMN exec_seed_note TEXT;         -- 로그인/seed 절차 서술 (비밀값 금지)
