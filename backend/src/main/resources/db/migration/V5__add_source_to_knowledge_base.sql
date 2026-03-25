-- knowledge_base 테이블에 source 컬럼 추가
-- PDF 업로드로 생성된 청크의 경우 책 제목을 저장. 수동 작성 항목은 NULL.
ALTER TABLE knowledge_base
  ADD COLUMN source VARCHAR(200) DEFAULT NULL;

COMMENT ON COLUMN knowledge_base.source IS
  'PDF 업로드로 생성된 청크의 경우 책 제목을 저장. 수동 작성 항목은 NULL.';
