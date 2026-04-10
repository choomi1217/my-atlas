#!/bin/bash
# wt.sh — Worktree 빌드 자동화 스크립트
#
# 사용법:
#   ./scripts/wt.sh clean-up knowledge-base     # 특정 worktree 빌드
#   ./scripts/wt.sh clean-up --all              # 전체 worktree 빌드
#   ./scripts/wt.sh clean-up                    # 현재 worktree 빌드 (worktree 안에서 실행 시)

set -euo pipefail

MAIN_PROJECT="/Users/yeongmi/dev/qa/my-atlas"
WORKTREES_DIR="$MAIN_PROJECT/.claude/worktrees"

# --- 색상 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# --- 유틸 ---
log_step() { echo -e "  ${GREEN}✅${NC} $1"; }
log_fail() { echo -e "  ${RED}❌${NC} $1"; }
log_info() { echo -e "${YELLOW}🔧${NC} [$1] $2"; }

# --- DB 실행 확인 ---
ensure_db() {
  if ! docker ps --format '{{.Names}}' | grep -q '^myqaweb-db$'; then
    echo -e "${YELLOW}⚠️  myqaweb-db가 실행 중이 아닙니다. DB를 먼저 띄웁니다...${NC}"
    (cd "$MAIN_PROJECT" && docker compose -f docker-compose.db.yml up -d)
    echo "   DB 헬스체크 대기 중..."
    local retries=0
    while ! docker exec myqaweb-db pg_isready -U myqaweb > /dev/null 2>&1; do
      retries=$((retries + 1))
      if [ "$retries" -ge 30 ]; then
        echo -e "${RED}❌ DB 헬스체크 실패 (30초 초과)${NC}"
        exit 1
      fi
      sleep 1
    done
    echo -e "  ${GREEN}✅${NC} DB 준비 완료"
  fi
}

# --- clean-up: 단일 worktree ---
clean_up_one() {
  local wt_path="$1"
  local wt_name="$(basename "$wt_path")"

  log_info "$wt_name" "clean-up 시작"

  # 1. backend build
  if (cd "$wt_path/backend" && ./gradlew clean build 2>&1); then
    log_step "backend build"
  else
    log_fail "backend build"
    return 1
  fi

  # 2. frontend npm install
  if (cd "$wt_path/frontend" && npm install 2>&1); then
    log_step "frontend npm install"
  else
    log_fail "frontend npm install"
    return 1
  fi

  # 3. frontend build
  if (cd "$wt_path/frontend" && npm run build 2>&1); then
    log_step "frontend build"
  else
    log_fail "frontend build"
    return 1
  fi

  # 4. docker compose up (빌드된 결과물로 컨테이너 기동)
  if (cd "$wt_path" && docker compose up -d --build 2>&1); then
    log_step "docker compose up"
  else
    log_fail "docker compose up"
    return 1
  fi

  echo -e "${GREEN}🎉${NC} [$wt_name] clean-up 완료 — 컨테이너 실행 중"
  echo ""
}

# --- 메인 ---
COMMAND="${1:-}"
TARGET="${2:-}"

if [ -z "$COMMAND" ]; then
  echo "사용법:"
  echo "  ./scripts/wt.sh clean-up <worktree-name>   특정 worktree 빌드"
  echo "  ./scripts/wt.sh clean-up --all              전체 worktree 빌드"
  echo "  ./scripts/wt.sh clean-up                    현재 worktree 빌드"
  echo ""
  echo "사용 가능한 worktree:"
  ls "$WORKTREES_DIR" 2>/dev/null | sed 's/^/  - /'
  exit 0
fi

case "$COMMAND" in
  clean-up)
    ensure_db

    if [ "$TARGET" = "--all" ]; then
      # 전체 worktree 순차 빌드
      FAILED=()
      for wt_dir in "$WORKTREES_DIR"/*/; do
        wt_name="$(basename "$wt_dir")"
        if ! clean_up_one "$wt_dir"; then
          FAILED+=("$wt_name")
        fi
      done

      echo "=============================="
      if [ ${#FAILED[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ 전체 worktree clean-up 완료${NC}"
      else
        echo -e "${RED}❌ 실패한 worktree: ${FAILED[*]}${NC}"
        exit 1
      fi

    elif [ -z "$TARGET" ]; then
      # 현재 디렉토리가 worktree인지 확인
      CURRENT_DIR="$(pwd)"
      if [[ "$CURRENT_DIR" == "$WORKTREES_DIR"/* ]]; then
        clean_up_one "$CURRENT_DIR"
      else
        echo -e "${RED}❌ 현재 디렉토리가 worktree가 아닙니다. worktree 이름을 지정해주세요.${NC}"
        exit 1
      fi

    else
      # 특정 worktree
      WT_PATH="$WORKTREES_DIR/$TARGET"
      if [ ! -d "$WT_PATH" ]; then
        echo -e "${RED}❌ worktree '$TARGET'을 찾을 수 없습니다.${NC}"
        echo "사용 가능한 worktree:"
        ls "$WORKTREES_DIR" 2>/dev/null | sed 's/^/  - /'
        exit 1
      fi
      clean_up_one "$WT_PATH"
    fi
    ;;

  *)
    echo -e "${RED}❌ 알 수 없는 명령: $COMMAND${NC}"
    echo "사용 가능한 명령: clean-up"
    exit 1
    ;;
esac
