> 변경 유형: 버그 수정  
> 작성일: 2026-04-15  
> 버전: v15  
> 상태: 진행 중

---

# Slack 알림 JSON 파싱 오류 수정

## 1. 배경

PR #62 머지 시 `e2e.yml`의 Slack Notification job이 실패했다.

**에러:**
```
SlackError: Invalid input! Failed to parse contents of the provided payload
```

**원인:** `e2e.yml:310`에서 `${{ github.event.head_commit.message }}`를 JSON 문자열 안에 **이스케이프 없이** 직접 삽입한다. Squash merge 커밋 메시지에 줄바꿈, `"`, `*` 등 특수문자가 포함되면 JSON 구조가 깨진다.

**재현 조건:**
- Squash merge 시 PR body 전체가 커밋 메시지에 포함됨
- 커밋 메시지가 여러 줄이거나 JSON 특수문자(`"`, `\`, 줄바꿈)를 포함하면 100% 실패

**영향 범위:**
- `e2e.yml` Slack Notification job만 해당 (프로젝트 내 유일한 CI Slack 알림)
- `backend-ci.yml`, `frontend-ci.yml`에는 Slack 알림 없음 (v8에서 e2e.yml로 통합됨)

---

## 2. 현재 코드 (문제 지점)

**파일:** `.github/workflows/e2e.yml:293-326`

```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v2.0.0
  with:
    webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
    webhook-type: incoming-webhook
    payload: |
      {
        ...
        { "type": "mrkdwn", "text": "*Commit:*\n${{ github.event.head_commit.message }}" },
        ...                                    ↑ 이스케이프 없이 직접 삽입 — 줄바꿈/특수문자로 JSON 깨짐
      }
```

**참고:** `scripts/claude-slack-notify.sh:41`에는 이미 JSON 이스케이프 처리가 있음:
```bash
SUMMARY_ESCAPED=$(echo "$SUMMARY" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk '{printf "%s\\n", $0}' | sed '$ s/\\n$//')
```

---

## 3. 구현 계획

### Step 1: 커밋 메시지 전처리 스텝 추가

`Determine results` 스텝에서 커밋 메시지를 **첫 줄만 추출 + 72자 truncate + JSON 이스케이프** 처리한다.

```yaml
- name: Determine results
  id: results
  run: |
    # ... 기존 E2E/Deploy/Overall 판정 로직 유지 ...
    
    # Commit message: 첫 줄만 추출, 72자 제한, JSON 이스케이프
    COMMIT_MSG=$(echo "$COMMIT_MESSAGE" | head -1 | cut -c1-72)
    COMMIT_MSG=$(echo "$COMMIT_MSG" | sed 's/\\/\\\\/g; s/"/\\"/g')
    echo "commit_msg=$COMMIT_MSG" >> $GITHUB_OUTPUT
  env:
    COMMIT_MESSAGE: ${{ github.event.head_commit.message }}
```

**핵심 포인트:**
- `env:`로 환경변수에 넣으면 GitHub Actions expression injection을 방지
- `head -1`로 첫 줄(커밋 제목)만 추출 → 줄바꿈 제거
- `cut -c1-72`로 Slack 필드 길이 제한 내 유지
- `sed`로 `\`와 `"`를 이스케이프 → JSON 안전

### Step 2: payload에서 안전한 출력값 사용

```yaml
# Before
{ "type": "mrkdwn", "text": "*Commit:*\n${{ github.event.head_commit.message }}" },

# After
{ "type": "mrkdwn", "text": "*Commit:*\n${{ steps.results.outputs.commit_msg }}" },
```

---

## 4. 변경 파일

| 파일 | 변경 |
|------|------|
| `.github/workflows/e2e.yml` | `Determine results` 스텝에 커밋 메시지 전처리 추가 + payload에서 안전한 출력값 참조 |

---

## 5. 검증

| 항목 | 방법 |
|------|------|
| JSON 유효성 | 변경 후 payload 템플릿에 `"`, `\`, 줄바꿈 포함 커밋 메시지 대입 시 JSON 깨지지 않는지 확인 |
| 실제 CI | PR 생성 → develop push → Slack 알림 수신 확인 |
| 긴 커밋 메시지 | Squash merge 커밋(여러 줄 body)으로 테스트 |

---

## Steps

- [x] Step 1: `Determine results` 스텝에 커밋 메시지 전처리 로직 추가
- [x] Step 2: Slack payload에서 `github.event.head_commit.message` → `steps.results.outputs.commit_msg`로 교체
- [ ] Step 3: PR 생성하여 실제 CI에서 Slack 알림 동작 검증
- [x] Step 4: 문서 업데이트 (ops.md 버전 히스토리, ops-issues.md)
