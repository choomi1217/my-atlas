-- app_user 테이블 생성 (PostgreSQL 예약어 'user' 회피)
CREATE TABLE app_user (
    id          BIGSERIAL    PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(200) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- admin 시드 (BCrypt 해시)
-- ⚠️ 이 해시는 초기 개발용 기본값이며 public 레포에 노출되어 있다.
--    운영 환경에서는 배포 직후 반드시 비밀번호를 교체할 것.
--    이 마이그레이션은 이미 적용되어 Flyway 체크섬이 고정돼 있으므로 값 자체는 수정할 수 없다.
--    교체는 DB에서 직접 수행한다: UPDATE app_user SET password = '<새 BCrypt 해시>' WHERE username = 'admin';
INSERT INTO app_user (username, password, role)
VALUES ('admin', '$2a$10$oHojrMk7yY4R0gn24URIVeTjVITdkE6GZbpUSrXDayzgPQ1BhIBgG', 'ADMIN');
