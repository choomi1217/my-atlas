#!/bin/bash
# scripts/sync-db-to-aws-v23.sh
# v23: 로컬 dev → AWS prod 마이그레이션 (유저 결정 반영)
#
# 사용법:
#   ./scripts/sync-db-to-aws-v23.sh 1a   # dev 정리
#   ./scripts/sync-db-to-aws-v23.sh 1b   # dev prod-유지 테이블 TRUNCATE
#   ./scripts/sync-db-to-aws-v23.sh 1c   # prod 데이터 이식
#   ./scripts/sync-db-to-aws-v23.sh 1d   # dev 추가 UPDATE
#   ./scripts/sync-db-to-aws-v23.sh 2    # dev → prod sync
#   ./scripts/sync-db-to-aws-v23.sh 3    # 검증
#   ./scripts/sync-db-to-aws-v23.sh all  # 전부 순차 실행

set -euo pipefail

# === 환경 ===
SSH_KEY="$HOME/.ssh/my-atlas-key.pem"
EC2_HOST="3.34.154.147"
EC2_USER="ec2-user"
DB_CONTAINER="myqaweb-db"
DB_USER="myqaweb"
DB_NAME="myqaweb"

BACKUP_DIR="$HOME/dev/qa/my-atlas/.claude/worktrees/ops-env/backups"
PROD_BACKUP="${BACKUP_DIR}/aws-backup-pre-v23-20260423200633.sql"
DEV_BACKUP="${BACKUP_DIR}/dev-backup-pre-v23-20260423205342.sql"

WORK_DIR="/tmp/my-atlas-v23"
mkdir -p "$WORK_DIR"

# === 헬퍼: pg_dump COPY 블록 추출 ===
extract_copy() {
  local source="$1"
  local table="$2"
  /usr/bin/awk -v t="$table" '
    $0 ~ "^COPY public\\." t " " { in_copy=1; print; next }
    in_copy && /^\\\.$/ { in_copy=0; print; print ""; exit }
    in_copy { print }
  ' "$source"
}

# === Phase 1a: dev 정리 ===
phase_1a_cleanup() {
  echo "[Phase 1a] dev 정리"
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
  DROP TABLE IF EXISTS knowledge_base_backup;
  -- 3180 smoke-test (CASCADE 로 관련 product/segment/test_case/test_run 등 삭제)
  DELETE FROM company WHERE id = 3180;
  TRUNCATE knowledge_base, pdf_upload_job, kb_category, faq CASCADE;
COMMIT;
SELECT 'Phase 1a 완료' AS status;
SQL
}

# === Phase 1b: dev prod-유지 테이블 TRUNCATE ===
phase_1b_truncate() {
  echo "[Phase 1b] dev prod-유지 테이블 TRUNCATE"
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
  TRUNCATE
    app_user, chat_session, convention, version, ticket,
    word_category, user_company_access, ai_usage_log,
    api_access_log, system_settings,
    test_case_image, test_result_comment
  CASCADE;
COMMIT;
SELECT 'Phase 1b 완료 (CASCADE 영향: version→version_phase/test_result/daily_test_snapshot, app_user→user_company_access, chat_session→chat_message, test_result→ticket)' AS status;
SQL
}

# === Phase 1c: prod 데이터 이식 ===
phase_1c_import_prod() {
  echo "[Phase 1c] prod 데이터 이식"

  local SQL_FILE="$WORK_DIR/import.sql"
  > "$SQL_FILE"

  # 재시도 대비: app_user 재초기화 (FK cascade 로 user_company_access 도 비워짐)
  echo "TRUNCATE app_user CASCADE;" >> "$SQL_FILE"
  echo "" >> "$SQL_FILE"

  # FK 순서:
  # 1. app_user (독립)
  extract_copy "$PROD_BACKUP" "app_user" >> "$SQL_FILE"

  # 2. user_company_access: company_id=2144 (삭제된 배민) 제외
  echo "COPY public.user_company_access (id, user_id, company_id, created_at) FROM stdin;" >> "$SQL_FILE"
  /usr/bin/awk '
    /^COPY public\.user_company_access / { in_copy=1; next }
    in_copy && /^\\\.$/ { in_copy=0; exit }
    in_copy {
      split($0, f, "\t")
      if (f[3] != "2144") print
    }
  ' "$PROD_BACKUP" >> "$SQL_FILE"
  echo "\\." >> "$SQL_FILE"
  echo "" >> "$SQL_FILE"

  # 3. chat_session → 4. chat_message
  extract_copy "$PROD_BACKUP" "chat_session" >> "$SQL_FILE"
  extract_copy "$PROD_BACKUP" "chat_message" >> "$SQL_FILE"

  # 5. convention (독립)
  extract_copy "$PROD_BACKUP" "convention" >> "$SQL_FILE"

  # 6. version (product FK, dev product 유지 중)
  extract_copy "$PROD_BACKUP" "version" >> "$SQL_FILE"

  # 7. version_phase (version FK)
  extract_copy "$PROD_BACKUP" "version_phase" >> "$SQL_FILE"

  # 8. daily_test_snapshot (version/phase FK)
  extract_copy "$PROD_BACKUP" "daily_test_snapshot" >> "$SQL_FILE"

  # 9. test_result: dev 원본에서 (version_id=561 OR version_phase_id=580 제외)
  echo "COPY public.test_result (id, version_id, version_phase_id, test_case_id, status, comment, executed_at, created_at, updated_at) FROM stdin;" >> "$SQL_FILE"
  /usr/bin/awk '
    /^COPY public\.test_result / { in_copy=1; next }
    in_copy && /^\\\.$/ { in_copy=0; exit }
    in_copy {
      split($0, f, "\t")
      if (f[2] != "561" && f[3] != "580") print
    }
  ' "$DEV_BACKUP" >> "$SQL_FILE"
  echo "\\." >> "$SQL_FILE"
  echo "" >> "$SQL_FILE"

  # 10. test_result_comment: prod (레거시 /api/feature-images/ 제외)
  echo "COPY public.test_result_comment (id, test_result_id, parent_id, author, content, image_url, created_at, updated_at) FROM stdin;" >> "$SQL_FILE"
  /usr/bin/awk '
    /^COPY public\.test_result_comment / { in_copy=1; next }
    in_copy && /^\\\.$/ { in_copy=0; exit }
    in_copy {
      split($0, f, "\t")
      if (f[6] !~ /^\/api\/feature-images\//) print
    }
  ' "$PROD_BACKUP" >> "$SQL_FILE"
  echo "\\." >> "$SQL_FILE"
  echo "" >> "$SQL_FILE"

  # 11. ticket (test_result FK)
  extract_copy "$PROD_BACKUP" "ticket" >> "$SQL_FILE"

  # 12. test_case_image: prod (깨진 5건 제외)
  echo "COPY public.test_case_image (id, test_case_id, filename, original_name, order_index, created_at) FROM stdin;" >> "$SQL_FILE"
  /usr/bin/awk '
    /^COPY public\.test_case_image / { in_copy=1; next }
    in_copy && /^\\\.$/ { in_copy=0; exit }
    in_copy {
      split($0, f, "\t")
      broken = (f[3] == "cda128db-2131-44bb-85e2-bf77dec06523.png" ||
                f[3] == "8805f06f-edd0-41a9-8de0-29f91427628a.png" ||
                f[3] == "8ecc112a-351b-4e13-a0b0-e4a511ac5eef.png" ||
                f[3] == "774488cc-aee5-448c-bd10-61c5baeca66e.png" ||
                f[3] == "baaac331-36ef-4724-8a7c-39233eacd31e.png")
      if (!broken) print
    }
  ' "$PROD_BACKUP" >> "$SQL_FILE"
  echo "\\." >> "$SQL_FILE"
  echo "" >> "$SQL_FILE"

  # 13-16. 독립 테이블
  extract_copy "$PROD_BACKUP" "word_category" >> "$SQL_FILE"
  extract_copy "$PROD_BACKUP" "ai_usage_log" >> "$SQL_FILE"
  extract_copy "$PROD_BACKUP" "api_access_log" >> "$SQL_FILE"
  extract_copy "$PROD_BACKUP" "system_settings" >> "$SQL_FILE"

  # 17. version_phase_test_case: dev 원본 (version_phase_id=580 제외)
  echo "COPY public.version_phase_test_case (id, version_phase_id, test_case_id, added_at) FROM stdin;" >> "$SQL_FILE"
  /usr/bin/awk '
    /^COPY public\.version_phase_test_case / { in_copy=1; next }
    in_copy && /^\\\.$/ { in_copy=0; exit }
    in_copy {
      split($0, f, "\t")
      if (f[2] != "580") print
    }
  ' "$DEV_BACKUP" >> "$SQL_FILE"
  echo "\\." >> "$SQL_FILE"
  echo "" >> "$SQL_FILE"

  # 18. version_phase_test_run: dev 원본 (version_phase_id=580 제외)
  echo "COPY public.version_phase_test_run (id, version_phase_id, test_run_id, created_at) FROM stdin;" >> "$SQL_FILE"
  /usr/bin/awk '
    /^COPY public\.version_phase_test_run / { in_copy=1; next }
    in_copy && /^\\\.$/ { in_copy=0; exit }
    in_copy {
      split($0, f, "\t")
      if (f[2] != "580") print
    }
  ' "$DEV_BACKUP" >> "$SQL_FILE"
  echo "\\." >> "$SQL_FILE"

  echo "  import.sql: $(/usr/bin/wc -l < "$SQL_FILE") lines"

  docker cp "$SQL_FILE" "$DB_CONTAINER:/tmp/import.sql"
  docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f /tmp/import.sql

  echo "[Phase 1c] 완료"
}

# === Phase 1d: dev 추가 UPDATE ===
phase_1d_adjust() {
  echo "[Phase 1d] dev 추가 UPDATE (company 이름 영어화, 1440 활성)"
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
  UPDATE company SET name = '🥧 ProtoPie'  WHERE id = 1644;
  UPDATE company SET name = '🤖 LuxRobo'   WHERE id = 1646;
  UPDATE company SET name = '💳 Toss Place' WHERE id = 1647;
  UPDATE company SET name = '🛵 WooWaHan'  WHERE id = 2142;
  UPDATE company SET is_active = true      WHERE id = 1440;
COMMIT;
SELECT id, name, is_active FROM company ORDER BY id;
SQL
}

# === Phase 2: dev → prod sync ===
phase_2_sync() {
  echo "[Phase 2] dev → prod sync"

  local DEV_SYNC_DUMP="$WORK_DIR/dev-final.sql"

  docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" \
    --data-only --disable-triggers --no-owner --no-acl \
    --exclude-table=knowledge_base \
    --exclude-table=pdf_upload_job \
    --exclude-table=kb_category \
    --exclude-table=flyway_schema_history \
    --exclude-table=faq \
    > "$DEV_SYNC_DUMP"

  echo "  dev dump: $(/usr/bin/wc -l < "$DEV_SYNC_DUMP") lines"

  scp -i "$SSH_KEY" "$DEV_SYNC_DUMP" "$EC2_USER@$EC2_HOST:/tmp/v23-dev-final.sql"

  ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1" <<'REMOTE'
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename != 'flyway_schema_history'
  LOOP
    EXECUTE 'TRUNCATE TABLE ' || quote_ident(t) || ' CASCADE';
  END LOOP;
END $$;
SELECT 'prod TRUNCATE 완료' AS status;
REMOTE

  ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" bash <<REMOTE
docker cp /tmp/v23-dev-final.sql $DB_CONTAINER:/tmp/v23-dev-final.sql
docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1 -f /tmp/v23-dev-final.sql > /dev/null 2>&1
REMOTE

  echo "[Phase 2] 완료"
}

# === Phase 3: 검증 ===
phase_3_verify() {
  echo "[Phase 3] 검증 — prod row count"
  ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" "docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \"
    SELECT 'app_user' AS tbl, count(*) FROM app_user UNION ALL
    SELECT 'company', count(*) FROM company UNION ALL
    SELECT 'product', count(*) FROM product UNION ALL
    SELECT 'segment', count(*) FROM segment UNION ALL
    SELECT 'test_case', count(*) FROM test_case UNION ALL
    SELECT 'test_case_image', count(*) FROM test_case_image UNION ALL
    SELECT 'test_run', count(*) FROM test_run UNION ALL
    SELECT 'test_run_test_case', count(*) FROM test_run_test_case UNION ALL
    SELECT 'test_result', count(*) FROM test_result UNION ALL
    SELECT 'test_result_comment', count(*) FROM test_result_comment UNION ALL
    SELECT 'convention', count(*) FROM convention UNION ALL
    SELECT 'version', count(*) FROM version UNION ALL
    SELECT 'version_phase', count(*) FROM version_phase UNION ALL
    SELECT 'daily_test_snapshot', count(*) FROM daily_test_snapshot UNION ALL
    SELECT 'ticket', count(*) FROM ticket UNION ALL
    SELECT 'user_company_access', count(*) FROM user_company_access UNION ALL
    SELECT 'knowledge_base', count(*) FROM knowledge_base UNION ALL
    SELECT 'pdf_upload_job', count(*) FROM pdf_upload_job UNION ALL
    SELECT 'kb_category', count(*) FROM kb_category UNION ALL
    SELECT 'word_category', count(*) FROM word_category UNION ALL
    SELECT 'ai_usage_log', count(*) FROM ai_usage_log UNION ALL
    SELECT 'api_access_log', count(*) FROM api_access_log
    ORDER BY 1;
  \""
}

# === Main ===
case "${1:-all}" in
  1a) phase_1a_cleanup ;;
  1b) phase_1b_truncate ;;
  1c) phase_1c_import_prod ;;
  1d) phase_1d_adjust ;;
  2)  phase_2_sync ;;
  3)  phase_3_verify ;;
  all)
    phase_1a_cleanup
    phase_1b_truncate
    phase_1c_import_prod
    phase_1d_adjust
    phase_2_sync
    phase_3_verify
    ;;
  *)
    echo "Usage: $0 {1a|1b|1c|1d|2|3|all}"
    exit 1
    ;;
esac
