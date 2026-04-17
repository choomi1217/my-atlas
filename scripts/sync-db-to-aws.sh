#!/bin/bash
# 로컬 DB → AWS DB 동기화 스크립트
# knowledge_base, pdf_upload_job, flyway_schema_history는 보존
#
# 사용법: ./scripts/sync-db-to-aws.sh

set -e

SSH_KEY="$HOME/.ssh/my-atlas-key.pem"
EC2_HOST="3.34.154.147"
EC2_USER="ec2-user"
LOCAL_DB_CONTAINER="myqaweb-db"
REMOTE_DB_CONTAINER="myqaweb-db"
DB_USER="myqaweb"
DB_NAME="myqaweb"
DUMP_FILE="/tmp/my-atlas-sync.sql"

PROTECTED_TABLES="knowledge_base pdf_upload_job flyway_schema_history"
EXCLUDE_FLAGS=""
for t in $PROTECTED_TABLES; do
  EXCLUDE_FLAGS="$EXCLUDE_FLAGS --exclude-table=$t"
done

echo "=== [1/5] 로컬 DB 덤프 (보호 테이블 제외) ==="
docker exec $LOCAL_DB_CONTAINER pg_dump -U $DB_USER -d $DB_NAME \
  --data-only --disable-triggers --no-owner --no-acl \
  $EXCLUDE_FLAGS \
  > "$DUMP_FILE"
echo "  덤프 완료: $(wc -l < "$DUMP_FILE") lines"

echo "=== [2/5] EC2로 전송 ==="
scp -i "$SSH_KEY" "$DUMP_FILE" "$EC2_USER@$EC2_HOST:/tmp/my-atlas-sync.sql"
echo "  전송 완료"

echo "=== [3/5] AWS DB 기존 데이터 정리 (보호 테이블 제외) ==="
TABLES=$(docker exec $LOCAL_DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "
  SELECT string_agg(tablename, ', ')
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT IN ('knowledge_base', 'pdf_upload_job', 'flyway_schema_history');
")
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" \
  "docker exec $REMOTE_DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \"TRUNCATE $TABLES CASCADE;\""
echo "  정리 완료"

echo "=== [4/5] AWS DB 복원 ==="
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" bash -s << 'REMOTE'
docker cp /tmp/my-atlas-sync.sql myqaweb-db:/tmp/my-atlas-sync.sql
docker exec myqaweb-db psql -U myqaweb -d myqaweb -f /tmp/my-atlas-sync.sql > /dev/null 2>&1
REMOTE
echo "  복원 완료"

echo "=== [5/5] 검증 ==="
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" \
  "docker exec $REMOTE_DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \"
    SELECT 'app_user' as tbl, count(*) FROM app_user UNION ALL
    SELECT 'company', count(*) FROM company UNION ALL
    SELECT 'product', count(*) FROM product UNION ALL
    SELECT 'segment', count(*) FROM segment UNION ALL
    SELECT 'test_case', count(*) FROM test_case UNION ALL
    SELECT 'knowledge_base', count(*) FROM knowledge_base UNION ALL
    SELECT 'pdf_upload_job', count(*) FROM pdf_upload_job
    ORDER BY 1;
  \""

rm -f "$DUMP_FILE"
echo ""
echo "✅ 동기화 완료! (knowledge_base, pdf_upload_job 보존됨)"
