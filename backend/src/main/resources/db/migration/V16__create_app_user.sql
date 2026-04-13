-- app_user 테이블 생성 (PostgreSQL 예약어 'user' 회피)
CREATE TABLE app_user (
    id          BIGSERIAL    PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(200) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- admin 시드 (password: admin, BCrypt 해시)
INSERT INTO app_user (username, password, role)
VALUES ('admin', '$2a$10$oHojrMk7yY4R0gn24URIVeTjVITdkE6GZbpUSrXDayzgPQ1BhIBgG', 'ADMIN');
