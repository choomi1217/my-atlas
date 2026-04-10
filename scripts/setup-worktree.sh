#!/bin/bash
# setup-worktree.sh
# 워크트리에서 docker compose를 실행하기 위한 환경을 자동 설정한다.
# 메인 .env를 복사한 뒤, 워크트리별 고유 포트/컨테이너 변수를 추가한다.
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

DB_PORT=$((15432 + SLOT))
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

# --- docker-compose.override.yml 생성 (DB 독립 볼륨 + 메인 DB 접속) ---
cat > "$WORKTREE_DIR/docker-compose.override.yml" << OVERRIDE_EOF
# Worktree override: DB는 독립 볼륨 사용 (메인 볼륨 보호)
# backend는 메인 레포의 myqaweb-db(5432)에 접속
services:
  db:
    volumes:
      - worktree_pgdata:/var/lib/postgresql/data
    ports: !reset
      - "${DB_PORT}:5432"

  backend:
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://host.docker.internal:5432/myqaweb
      SPRING_DATASOURCE_USERNAME: \${SPRING_DATASOURCE_USERNAME:-myqaweb}
      SPRING_DATASOURCE_PASSWORD: \${SPRING_DATASOURCE_PASSWORD:-admin}
      ANTHROPIC_API_KEY: \${ANTHROPIC_API_KEY}
      OPENAI_API_KEY: \${OPENAI_API_KEY}
    extra_hosts:
      - "host.docker.internal:host-gateway"

volumes:
  worktree_pgdata:
OVERRIDE_EOF

echo "✅ .env + docker-compose.override.yml 생성 완료"
echo ""
echo "📋 포트 할당:"
echo "   DB:       메인 레포 (5432) 공유"
echo "   Backend:  ${BACKEND_PORT}"
echo "   Frontend: ${FRONTEND_PORT}"
echo ""
echo "⚠️  메인 레포에서 DB를 먼저 띄워야 합니다:"
echo "   cd $MAIN_PROJECT && docker compose up -d db"
echo ""
echo "🚀 실행: cd $WORKTREE_DIR && docker compose up -d"
echo "🌐 접속: http://localhost:${FRONTEND_PORT}"
