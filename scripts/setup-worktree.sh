#!/bin/bash
# setup-worktree.sh
# 워크트리에서 docker compose를 실행하기 위한 환경을 자동 설정한다.
# 메인 .env를 복사한 뒤, 워크트리별 고유 포트/컨테이너 변수를 추가한다.
#
# DB는 메인 레포의 docker-compose.db.yml로 독립 실행되므로,
# 워크트리에서는 backend + frontend만 설정한다.
#
# 사용법:
#   bash scripts/setup-worktree.sh .claude/worktrees/registry

set -euo pipefail

MAIN_PROJECT="/Users/yeongmi/dev/qa/my-atlas"

# 워크트리 경로 결정
if [ $# -ge 1 ]; then
  WORKTREE_DIR="$(cd "$1" && pwd)"
else
  WORKTREE_DIR="$(pwd)"
fi

# 메인 프로젝트에서 실행하면 안 됨
if [ "$WORKTREE_DIR" = "$MAIN_PROJECT" ]; then
  echo "❌ 메인 프로젝트에서는 실행할 필요 없습니다."
  exit 1
fi

WORKTREE_NAME="$(basename "$WORKTREE_DIR")"
echo "🔧 워크트리 설정: $WORKTREE_NAME ($WORKTREE_DIR)"

# --- DB 실행 확인 ---
if ! docker ps --format '{{.Names}}' | grep -q '^myqaweb-db$'; then
  echo "⚠️  myqaweb-db 컨테이너가 실행 중이 아닙니다."
  echo "   먼저 DB를 띄워주세요: cd $MAIN_PROJECT && docker compose -f docker-compose.db.yml up -d"
  exit 1
fi

# --- 포트 슬롯 할당 (알파벳 순) ---
WORKTREE_NAMES=($(ls "$MAIN_PROJECT/.claude/worktrees/" 2>/dev/null | sort))
SLOT=0
for i in "${!WORKTREE_NAMES[@]}"; do
  if [ "${WORKTREE_NAMES[$i]}" = "$WORKTREE_NAME" ]; then
    SLOT=$((i + 1))
    break
  fi
done

if [ "$SLOT" -eq 0 ]; then
  echo "⚠️  워크트리 목록에서 '$WORKTREE_NAME'을 찾을 수 없음 — 슬롯 1 사용"
  SLOT=1
fi

BACKEND_PORT=$((8080 + SLOT))
FRONTEND_PORT=$((5173 + SLOT))

# --- .env 생성 (메인 복사 + 포트 변수 추가) ---
# 기존 심볼릭 링크가 있으면 제거
if [ -L "$WORKTREE_DIR/.env" ]; then
  rm "$WORKTREE_DIR/.env"
  echo "🔗 기존 심볼릭 링크 제거"
fi

# 메인 .env 복사
cp "$MAIN_PROJECT/.env" "$WORKTREE_DIR/.env"

# 기존 포트/컨테이너 변수가 있으면 제거 (재실행 대비)
sed -i '' '/^# Worktree Docker ports/d' "$WORKTREE_DIR/.env"
sed -i '' '/^COMPOSE_CONTAINER_PREFIX=/d' "$WORKTREE_DIR/.env"
sed -i '' '/^DB_PORT=/d' "$WORKTREE_DIR/.env"
sed -i '' '/^SPRING_DATASOURCE_URL=/d' "$WORKTREE_DIR/.env"
sed -i '' '/^BACKEND_PORT=/d' "$WORKTREE_DIR/.env"
sed -i '' '/^FRONTEND_PORT=/d' "$WORKTREE_DIR/.env"

# 포트 변수 추가
cat >> "$WORKTREE_DIR/.env" << EOF

# Worktree Docker ports (슬롯 $SLOT: $WORKTREE_NAME)
COMPOSE_CONTAINER_PREFIX=myqaweb-${WORKTREE_NAME}
BACKEND_PORT=${BACKEND_PORT}
FRONTEND_PORT=${FRONTEND_PORT}
EOF

# --- 기존 docker-compose.override.yml 제거 (DB 분리로 더 이상 불필요) ---
if [ -f "$WORKTREE_DIR/docker-compose.override.yml" ]; then
  rm "$WORKTREE_DIR/docker-compose.override.yml"
  echo "🗑️  기존 docker-compose.override.yml 제거 (DB 분리로 불필요)"
fi

echo "✅ .env 생성 완료"
echo ""
echo "📋 포트 할당:"
echo "   DB:       myqaweb-db (5432) — docker-compose.db.yml로 독립 실행"
echo "   Backend:  ${BACKEND_PORT}"
echo "   Frontend: ${FRONTEND_PORT}"
echo ""
echo "🚀 실행: cd $WORKTREE_DIR && docker compose up -d"
echo "🌐 접속: http://localhost:${FRONTEND_PORT}"
