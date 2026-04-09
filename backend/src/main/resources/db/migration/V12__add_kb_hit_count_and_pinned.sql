-- FAQ를 KB 기반 큐레이션 뷰로 전환하기 위한 컬럼 추가
-- hit_count: Chat RAG에서 조회된 횟수 (검색 빈도 Top 5 선정용)
-- pinned_at: 관리자 고정 시각 (NULL = 미고정, NOT NULL = 고정, 최대 15건)

ALTER TABLE knowledge_base ADD COLUMN hit_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge_base ADD COLUMN pinned_at TIMESTAMP DEFAULT NULL;

CREATE INDEX idx_kb_pinned_at ON knowledge_base (pinned_at) WHERE pinned_at IS NOT NULL;
CREATE INDEX idx_kb_hit_count ON knowledge_base (hit_count DESC);
