-- Test Studio v2.5: Style-by-Example
-- 스타일 세트(프로필) + 세트 내 예시 TC(verbatim) + Company 보조 설정 / 활성 세트 선택
-- 기본 견본(Sample, 로그인)은 코드 상수(DefaultStyleSamples)로 제공하므로 테이블 row 없음.

-- ① 스타일 세트 (사용자 정의, 이름 변경 가능)
CREATE TABLE test_studio_style_profile (
    id         BIGSERIAL PRIMARY KEY,
    company_id BIGINT       NOT NULL REFERENCES company(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_style_profile_company ON test_studio_style_profile(company_id);

-- ② 세트 내 예시 TC (verbatim — test_case 와 동형 컬럼, 단 Company-scoped 이며 운영 Test Suite 미노출)
CREATE TABLE test_studio_style_example (
    id               BIGSERIAL PRIMARY KEY,
    profile_id       BIGINT       NOT NULL REFERENCES test_studio_style_profile(id) ON DELETE CASCADE,
    title            VARCHAR(300) NOT NULL,
    preconditions    TEXT         DEFAULT NULL,
    steps            JSONB        DEFAULT NULL,
    expected_results JSONB        DEFAULT NULL,
    priority         VARCHAR(10)  DEFAULT NULL,
    test_type        VARCHAR(20)  DEFAULT NULL,
    sort_order       INT          NOT NULL DEFAULT 0,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_style_example_profile_order ON test_studio_style_example(profile_id, sort_order);

-- ③ Company 보조 설정 + 활성 세트 선택 (Company 1:1)
--    selected_profile_id 가 가리키던 세트 삭제 시 SET NULL → 기본 견본 Sample 로 안전 복귀
CREATE TABLE test_studio_config (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT      NOT NULL UNIQUE REFERENCES company(id) ON DELETE CASCADE,
    selected_profile_id BIGINT      DEFAULT NULL REFERENCES test_studio_style_profile(id) ON DELETE SET NULL,
    step_format         VARCHAR(30) NOT NULL DEFAULT 'ACTION_EXPECTED',
    detail_level        VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    tone                VARCHAR(20) NOT NULL DEFAULT 'PLAIN',
    created_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP   NOT NULL DEFAULT NOW()
);
