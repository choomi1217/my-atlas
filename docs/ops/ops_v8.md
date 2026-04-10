> 변경 유형: 환경 개선  
> 작성일: 2026-04-08  
> 버전: v8  
> 상태: 완료

---

### 요구사항
1. pr merge 할때의 Pipline을 확인했는데 e2e 테스트가 끝나기도 전에 먼저 날아가버리는것 같습니다. 확인이 필요합니다.
    1. 현재의 Slack noti 가 불필요한 것은 아닌지

1. Claude 권한 필요하다, 혹은 Claude가 어떤걸 완료했다고 Slack에 메세지를 보내고 있는데 이에 대해 메세지에 좀 보충 설명이 필요합니다.
    1. 어떤 내용의 작업을 하고 있었는지
    2. 시간은 얼마나 걸렸는지
    3. 등등 완료된 내용에 대해서도 Slack 으로 보내주면 좋겠습니다.

---

### 문제 분석

#### 문제 1: E2E 완료 전 배포

main push 시 3개 워크플로우가 **독립 실행**:
```
main push
  ├── e2e.yml              (E2E 테스트 5~10분)
  ├── deploy-backend.yml   (즉시 배포!)  ← E2E 결과 모름
  └── deploy-frontend.yml  (즉시 배포!)  ← E2E 결과 모름
```

deploy-backend.yml, deploy-frontend.yml에 `needs:` 없이 push 트리거만 있어서 E2E와 무관하게 배포됨.

#### 문제 2: Slack 알림 과다 + 정보 부족

CI/CD 알림: PR 머지 시 최대 5개 Slack 메시지 (backend-ci, frontend-ci, e2e, deploy-backend, deploy-frontend)

Claude Code 알림: 고정 텍스트만 전송
- "✅ Claude Code 작업이 완료되었습니다."
- "🔔 Claude Code가 권한 승인을 기다리고 있습니다."
- 작업 내용, 소요 시간 등 동적 정보 없음

---

### 구현 계획

#### Step 1: e2e.yml에 배포 통합
- [x] deploy-backend, deploy-frontend job을 e2e.yml에 추가 (deploy-gate 이후)
- [x] deploy-backend.yml, deploy-frontend.yml 삭제
- [x] notify-slack을 E2E + 배포 통합 알림으로 수정

#### Step 2: CI Slack 알림 정리  
- [x] backend-ci.yml에서 Slack notification step 제거
- [x] frontend-ci.yml에서 Slack notification step 제거

#### Step 3: Claude Slack Hook 개선
- [x] scripts/claude-slack-notify.sh 생성 (동적 정보 수집)
- [x] .claude/settings.json hook command 변경

#### Step 4: 문서 업데이트
- [x] v8.md 최종 요약 작성
- [x] ops.md 버전 히스토리에 v8 추가

---

### [최종 요약]

#### 변경 파일

| 파일 | 변경 |
|------|------|
| `.github/workflows/e2e.yml` | deploy-backend, deploy-frontend job 추가. notify-slack 통합 알림 |
| `.github/workflows/deploy-backend.yml` | 삭제 |
| `.github/workflows/deploy-frontend.yml` | 삭제 |
| `.github/workflows/backend-ci.yml` | notify-slack job 제거 |
| `.github/workflows/frontend-ci.yml` | notify-slack job 제거 |
| `scripts/claude-slack-notify.sh` | 신규 — 브랜치, 커밋, 소요 시간 동적 수집 |
| `.claude/settings.json` | hook command를 스크립트 호출로 변경 |

#### 변경 전후 비교

**CI/CD 파이프라인:**
```
Before: main push → e2e.yml + deploy-backend.yml + deploy-frontend.yml (독립 실행, 5개 Slack 알림)
After:  main push → e2e.yml 하나로 통합 (E2E → deploy-gate → 배포 → Slack 1개)
```

**Claude Slack Hook:**
```
Before: "✅ Claude Code 작업이 완료되었습니다." (고정 텍스트)
After:  Branch, Last commit, Duration 포함 동적 메시지
```
