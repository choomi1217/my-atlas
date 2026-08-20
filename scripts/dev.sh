#!/bin/bash
# dev.sh — 로컬 개발 스택 관리 스크립트
#
# ops_v34에서 worktree 모델을 폐기하면서 wt.sh를 대체한다.
# worktree 개념(sync / 심링크 / 대상 resolve)은 전부 제거하고 스택 관리만 남겼다.
#
# 사용법:
#   ./scripts/dev.sh up       # 빌드 후 docker compose up (캐시 사용)
#   ./scripts/dev.sh fresh    # 컨테이너/이미지 제거 후 깨끗하게 재빌드
#   ./scripts/dev.sh down     # 스택 내리기 (DB는 유지)
#   ./scripts/dev.sh status   # 컨테이너 + git 브랜치 상태

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- 색상 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_step() { echo -e "  ${GREEN}✅${NC} $1"; }
log_fail() { echo -e "  ${RED}❌${NC} $1"; }
log_info() { echo -e "${YELLOW}🔧${NC} $1"; }

# --- DB 실행 확인 ---
# DB는 docker-compose.db.yml로 독립 실행된다. 앱 스택을 내려도 DB는 유지된다.
ensure_db() {
  if ! docker ps --format '{{.Names}}' | grep -q '^myqaweb-db$'; then
    echo -e "${YELLOW}⚠️  myqaweb-db가 실행 중이 아닙니다. DB를 먼저 띄웁니다...${NC}"
    (cd "$PROJECT_ROOT" && docker compose -f docker-compose.db.yml up -d)
    echo "   DB 헬스체크 대기 중..."
    local retries=0
    while ! docker exec myqaweb-db pg_isready -U myqaweb > /dev/null 2>&1; do
      retries=$((retries + 1))
      if [ "$retries" -ge 30 ]; then
        log_fail "DB 헬스체크 실패 (30초 초과)"
        exit 1
      fi
      sleep 1
    done
    log_step "DB 준비 완료"
  fi
}

# --- 빌드 ---
build_all() {
  log_info "backend gradle build..."
  if (cd "$PROJECT_ROOT/backend" && ./gradlew clean build); then
    log_step "backend build"
  else
    log_fail "backend build"
    return 1
  fi

  log_info "frontend npm install + build..."
  if (cd "$PROJECT_ROOT/frontend" && npm install && npm run build); then
    log_step "frontend build"
  else
    log_fail "frontend build"
    return 1
  fi
}

# --- up: 캐시 사용 빌드 후 기동 ---
cmd_up() {
  ensure_db
  build_all || return 1

  log_info "docker compose up -d --build..."
  if (cd "$PROJECT_ROOT" && docker compose up -d --build); then
    log_step "docker compose up"
  else
    log_fail "docker compose up"
    return 1
  fi

  echo -e "${GREEN}🎉${NC} 스택 기동 완료 — Backend: http://localhost:8080 / Frontend: http://localhost:5173"
}

# --- fresh: 컨테이너/이미지 제거 후 no-cache 재빌드 ---
cmd_fresh() {
  log_info "기존 컨테이너/이미지 제거 중..."
  # --profile worker: agent-worker가 profiles 선언이라 프로파일 없이는 안 내려간다
  (cd "$PROJECT_ROOT" && docker compose --profile worker down --rmi local --remove-orphans) || true
  log_step "기존 컨테이너/이미지 제거"

  ensure_db
  build_all || return 1

  log_info "docker compose build --no-cache..."
  if (cd "$PROJECT_ROOT" && docker compose build --no-cache && docker compose up -d); then
    log_step "docker compose up"
  else
    log_fail "docker compose up"
    return 1
  fi

  echo -e "${GREEN}🎉${NC} fresh 기동 완료 — 깨끗한 이미지로 실행 중"
}

# --- down: 앱 스택만 내림 (DB 유지) ---
cmd_down() {
  # -v 절대 금지 — DB 볼륨 보존 (CLAUDE.md Critical Rules)
  log_info "앱 스택 내리는 중 (DB는 유지)..."
  (cd "$PROJECT_ROOT" && docker compose --profile worker down)
  log_step "스택 down 완료 — myqaweb-db는 그대로 유지됨"
}

# --- status ---
cmd_status() {
  echo ""
  echo "=== 컨테이너 ==="
  docker ps -a --filter "name=myqaweb" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  echo ""
  echo "=== Git ==="
  (cd "$PROJECT_ROOT" && git fetch origin --quiet 2>/dev/null || true)
  local branch ahead behind dirty
  branch=$(cd "$PROJECT_ROOT" && git branch --show-current)
  ahead=$(cd "$PROJECT_ROOT" && git rev-list --count origin/develop..HEAD 2>/dev/null || echo "?")
  behind=$(cd "$PROJECT_ROOT" && git rev-list --count HEAD..origin/develop 2>/dev/null || echo "?")
  dirty=$(cd "$PROJECT_ROOT" && git status --short | wc -l | tr -d ' ')
  printf "  branch: %s\n  ahead(origin/develop): %s\n  behind(origin/develop): %s\n  dirty: %s\n" \
    "$branch" "$ahead" "$behind" "$dirty"
  echo ""
  echo "=== 로컬 브랜치 ==="
  (cd "$PROJECT_ROOT" && git branch | sed 's/^/  /')
  echo ""
}

# --- 메인 ---
COMMAND="${1:-}"

case "$COMMAND" in
  up)     cmd_up ;;
  fresh)  cmd_fresh ;;
  down)   cmd_down ;;
  status) cmd_status ;;
  "")
    echo "사용법: ./scripts/dev.sh <command>"
    echo ""
    echo "명령:"
    echo "  up       빌드 후 docker compose up (캐시 사용)"
    echo "  fresh    컨테이너/이미지 제거 후 깨끗하게 재빌드"
    echo "  down     스택 내리기 (DB는 유지)"
    echo "  status   컨테이너 + git 브랜치 상태"
    exit 0
    ;;
  *)
    log_fail "알 수 없는 명령: $COMMAND"
    echo "사용 가능한 명령: up, fresh, down, status"
    exit 1
    ;;
esac
