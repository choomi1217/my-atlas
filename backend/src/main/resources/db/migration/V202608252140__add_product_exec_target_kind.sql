-- registry_v24 Step 8 — 실행 대상 종류를 제품이 선언한다.
--
-- 기존 product.platform(WEB/DESKTOP/MOBILE/ETC)은 제품 분류 메타데이터이고,
-- 한 제품이 웹과 앱을 동시에 가질 수 있으므로 실행 대상과는 별개 개념이다. 컬럼을 분리한다.
--
-- 기본값 WEB — 기존 제품은 전부 웹 실행이었으므로 동작이 바뀌지 않는다.
ALTER TABLE product
    ADD COLUMN IF NOT EXISTS exec_target_kind VARCHAR(20) NOT NULL DEFAULT 'WEB';

COMMENT ON COLUMN product.exec_target_kind IS
    '에이전트 실행 대상 종류 (WEB | ANDROID | IOS). 워커는 자기가 구동 가능한 종류의 Job만 집는다.';
