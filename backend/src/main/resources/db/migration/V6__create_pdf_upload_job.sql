-- PDF 업로드 작업 이력 및 처리 상태 관리 테이블
CREATE TABLE pdf_upload_job (
    id                BIGSERIAL PRIMARY KEY,
    book_title        VARCHAR(200) NOT NULL,
    original_filename VARCHAR(300) NOT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    total_chunks      INT          DEFAULT NULL,
    error_message     TEXT         DEFAULT NULL,
    created_at        TIMESTAMP    DEFAULT NOW(),
    completed_at      TIMESTAMP    DEFAULT NULL
);
