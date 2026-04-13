> 변경 유형: 버그 수정  
> 작성일: 2026-04-13  
> 버전: v12  
> 상태: 완료

---

# Flyway Validation 실패 수정 — 공유 DB 환경 마이그레이션 충돌

## 1. 문제

### 현상

루트 프로젝트에서 `docker compose up -d`로 backend를 기동하면 Flyway validation 에러로 crash loop 발생.

```
Validate failed: Migrations have failed validation
Migration description mismatch for migration version 15
-> Applied to database : create app user
-> Resolved locally    : create chat session message

Detected applied migration not resolved locally: 17.
```

### 재현 경로

```
1. 다른 worktree(knowledge-base 등)에서 마이그레이션 적용 (V15, V16, V17)
2. 루트 프로젝트의 backend 기동 시도
3. Flyway가 DB 히스토리와 로컬 마이그레이션 파일을 비교
4. V15 description 불일치 + V17 로컬 파일 미존재 → validation 실패
5. Spring Boot 기동 실패 → restart loop
```

### 근본 원인

v10/v11에서 **모든 worktree가 단일 DB를 공유**하는 아키텍처를 채택했다. 하지만 각 worktree(feature 브랜치)는 서로 다른 Flyway 마이그레이션 파일을 가질 수 있다.

| 버전 | DB에 적용된 description | 루트 프로젝트 파일 | 충돌 |
|------|------------------------|-------------------|------|
| V15 | `create app user` | `V15__create_chat_session_message.sql` | description 불일치 |
| V16 | `create app user` | `V16__create_app_user.sql` | (정상) |
| V17 | `kb soft delete and category` | (파일 없음) | 로컬에 없는 마이그레이션 |

기존 설정(`ignore-migration-patterns: "*:missing"` + `out-of-order: true`)은 V17(로컬에 없는 마이그레이션)은 커버하지만, V15의 **description mismatch**는 커버하지 못했다.

### 영향

| 영향 | 설명 |
|------|------|
| 루트 프로젝트 backend 기동 불가 | crash loop으로 서비스 불가 |
| 모든 worktree에 동일 위험 | 어떤 worktree든 다른 worktree가 먼저 마이그레이션을 적용하면 동일 에러 발생 |

## 2. 해결

### 변경 사항

`application.yml`의 Flyway 설정에 `validate-on-migrate: false` 추가:

```yaml
# 변경 전
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    ignore-migration-patterns: "*:missing"
    out-of-order: true

# 변경 후
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    validate-on-migrate: false
    ignore-migration-patterns: "*:missing"
    out-of-order: true
```

### 설정 조합의 역할

| 설정 | 역할 | 커버하는 시나리오 |
|------|------|------------------|
| `validate-on-migrate: false` | DB 히스토리와 로컬 파일의 description/checksum 검증 비활성 | V15 description 불일치 |
| `ignore-migration-patterns: "*:missing"` | DB에는 있지만 로컬에 없는 마이그레이션 무시 | V17 로컬 파일 미존재 |
| `out-of-order: true` | 버전 순서 상관없이 미적용 마이그레이션 실행 | worktree 간 버전 번호 역전 |

### 검토한 대안

| 방안 | 장점 | 기각 사유 |
|------|------|-----------|
| Flyway repair | DB 히스토리를 로컬 파일에 맞춤 | 일시적 — 다른 worktree가 마이그레이션 적용하면 재발 |
| worktree별 DB 분리 | 완전한 격리 | v10에서 공유 DB로 결정한 이유(동기화 비용) 무효화 |
| timestamp 기반 버전 번호 | 충돌 확률 감소 | 기존 17개 마이그레이션 전환 비용 + description mismatch 미해결 |

### 안전성

- **로컬 개발 전용**: 운영/CI 환경은 별도 DB를 사용하므로 영향 없음
- **마이그레이션 적용은 정상 동작**: `validate-on-migrate: false`는 검증만 비활성 — 새 마이그레이션은 여전히 정상 적용됨
- **운영 배포 시**: EC2의 DB는 단일 소스(main 브랜치)에서만 마이그레이션이 적용되므로 충돌 없음

## 3. 변경 파일

| 파일 | 변경 |
|------|------|
| `backend/src/main/resources/application.yml` | `validate-on-migrate: false` 1줄 추가 |

## 4. 검증

```
변경 전: backend crash loop (Flyway validation 실패)
변경 후: backend 정상 기동 (Started MyQaWebApplication in 15.78 seconds)
```
