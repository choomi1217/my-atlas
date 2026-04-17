#!/bin/bash
# PostToolUse hook: Playwright 테스트 실행 후 skipped/did-not-run 검증
# Claude가 "0 failed"만 보고 넘어가는 것을 방지

HOOK_INPUT=$(cat)

# Bash 명령어 추출
COMMAND=$(echo "$HOOK_INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)

# playwright test 명령이 아니면 무시
if ! echo "$COMMAND" | grep -qE 'playwright test'; then
  exit 0
fi

# 실행 결과(stdout) 추출
STDOUT=$(echo "$HOOK_INPUT" | jq -r '.tool_result.stdout // empty' 2>/dev/null || true)

if [ -z "$STDOUT" ]; then
  exit 0
fi

# 수치 추출 (macOS/Linux 호환 — grep -E 사용)
SKIPPED=$(echo "$STDOUT" | grep -oE '[0-9]+ skipped' | grep -oE '[0-9]+' | head -1 || true)
FAILED=$(echo "$STDOUT" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' | head -1 || true)
PASSED=$(echo "$STDOUT" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' | head -1 || true)
DID_NOT_RUN=$(echo "$STDOUT" | grep -c 'did not run' || true)

WARNINGS=""

if [ -n "$SKIPPED" ] && [ "$SKIPPED" -gt 0 ]; then
  WARNINGS="${WARNINGS}  - ${SKIPPED}개 테스트 SKIPPED. 원인 조사 필수."
fi

if [ -n "$DID_NOT_RUN" ] && [ "$DID_NOT_RUN" -gt 0 ]; then
  WARNINGS="${WARNINGS}  - 'did not run' 테스트 감지. 반드시 원인 조사."
fi

if [ -n "$FAILED" ] && [ "$FAILED" -gt 0 ]; then
  WARNINGS="${WARNINGS}  - ${FAILED}개 테스트 FAILED."
fi

if [ -n "$WARNINGS" ]; then
  REASON="Playwright 검증 경고: ${WARNINGS} | 필수 조치: 1) skipped 원인 조사 2) 변경 파일 관련 E2E 개별 실행 3) passed=${PASSED:-0} 예상치 확인"
  jq -nc --arg reason "$REASON" '{"decision":"block","reason":$reason}'
  exit 0
fi

exit 0
