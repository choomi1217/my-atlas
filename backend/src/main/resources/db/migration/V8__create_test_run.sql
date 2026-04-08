-- Test Run: 독립적 테스트 집합 (Product 레벨, 재사용 가능)
CREATE TABLE test_run (
    id          BIGSERIAL PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, name)
);
CREATE INDEX idx_test_run_product_id ON test_run(product_id);

-- Test Run과 Test Case의 N:M 관계
CREATE TABLE test_run_test_case (
    test_run_id  BIGINT NOT NULL REFERENCES test_run(id) ON DELETE CASCADE,
    test_case_id BIGINT NOT NULL REFERENCES test_case(id) ON DELETE CASCADE,
    added_at     TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (test_run_id, test_case_id)
);
CREATE INDEX idx_test_run_test_case_run ON test_run_test_case(test_run_id);

-- Version: 릴리스 계획
CREATE TABLE version (
    id            BIGSERIAL PRIMARY KEY,
    product_id    BIGINT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    release_date  DATE,
    copied_from   BIGINT,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, name)
);
CREATE INDEX idx_version_product_id ON version(product_id);
CREATE INDEX idx_version_release_date ON version(release_date);

-- Version Phase: Version 내 각 단계별 TestRun 참조
CREATE TABLE version_phase (
    id            BIGSERIAL PRIMARY KEY,
    version_id    BIGINT NOT NULL REFERENCES version(id) ON DELETE CASCADE,
    phase_name    VARCHAR(100) NOT NULL,
    test_run_id   BIGINT NOT NULL REFERENCES test_run(id),
    order_index   INT NOT NULL,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_version_phase_version ON version_phase(version_id);
CREATE INDEX idx_version_phase_test_run ON version_phase(test_run_id);
CREATE UNIQUE INDEX idx_version_phase_order ON version_phase(version_id, order_index);

-- Test Result: 실제 수행 결과 (Version + Phase 단위)
CREATE TABLE test_result (
    id               BIGSERIAL PRIMARY KEY,
    version_id       BIGINT NOT NULL REFERENCES version(id) ON DELETE CASCADE,
    version_phase_id BIGINT NOT NULL REFERENCES version_phase(id) ON DELETE CASCADE,
    test_case_id     BIGINT NOT NULL REFERENCES test_case(id) ON DELETE CASCADE,
    status           VARCHAR(20) DEFAULT 'UNTESTED',
    comment          TEXT,
    executed_at      TIMESTAMP,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE (version_phase_id, test_case_id)
);
CREATE INDEX idx_test_result_version      ON test_result(version_id);
CREATE INDEX idx_test_result_version_phase ON test_result(version_phase_id);
CREATE INDEX idx_test_result_test_case    ON test_result(test_case_id);
