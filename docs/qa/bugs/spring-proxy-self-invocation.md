# Spring 프록시 self-invocation — 테스트를 전부 통과하고 운영에서만 실패하는 함정

> 성격: **버그 리포트가 아니라 코드 리뷰에서 잡은 함정 기록**
> 기록일: 2026-09-01
> 출처: ops_v36 `AccessLogRetentionScheduler` 구현 리뷰 — 커밋 전에 발견해 수정
> 도달 범위: 워킹트리에만 존재했고 **develop·운영에 반영된 적 없음**

> 이 문서의 값어치는 "무슨 사고가 났나"가 아니라 **§5 탐지 규칙**에 있다.
> 이번엔 리뷰에서 잡혔지만, 놓쳤다면 어떤 자동 검증에도 걸리지 않고 운영까지 갔을 유형이다.

---

## 1. 무엇이 문제였나

`@Scheduled` 메서드가 같은 클래스의 `@Transactional` 메서드를 호출하는 구조였다.

```java
@Scheduled(cron = "0 30 3 * * *")
public void purgeOldAccessLogs() {
    int deleted = deleteOlderThan(retentionDays);   // ← this.deleteOlderThan(...)
}

@Transactional
public int deleteOlderThan(int days) {
    return repository.deleteOlderThan(LocalDateTime.now().minusDays(days));
}
```

`deleteOlderThan`에 `@Transactional`이 붙어 있으니 트랜잭션이 걸릴 것처럼 보인다. **걸리지 않는다.**

Spring의 `@Transactional`은 **프록시 객체**가 메서드 호출을 가로채서 트랜잭션을 열어준다.
그런데 위 코드의 `deleteOlderThan(...)`은 프록시를 거치지 않는 `this`에 대한 직접 호출이다.
프록시가 개입할 지점이 없으므로 애노테이션은 그냥 무시된다.

`repository.deleteOlderThan`은 `@Modifying` 네이티브 DELETE라 **활성 트랜잭션이 필수**다.
따라서 이 스케줄러는 매일 새벽 3시 30분마다 `TransactionRequiredException`으로 실패한다.

---

## 2. 왜 위험한가 — 모든 검증 단계를 통과한다

| 검증 단계 | 결과 | 이유 |
|---|---|---|
| `compileJava` | ✅ 통과 | 문법적으로 완전히 정상이다 |
| 단위 테스트 (Mockito) | ✅ 통과 | 테스트는 `new`로 만든 **실제 객체**를 쓴다. 프록시가 없으니 self-invocation 문제 자체가 발생하지 않고, repository는 mock이라 트랜잭션이 필요 없다 |
| E2E | ✅ 통과 | 스케줄러는 cron 시각에만 돈다. E2E 실행 중에는 호출되지 않는다 |
| CI 전체 | ✅ 통과 | 위 세 가지가 전부 통과하므로 |
| **운영** | ❌ **실패했을 것** | 프록시가 개입하고, 실제 트랜잭션이 필요해지는 유일한 환경 |

**이 버그의 본질은 "테스트가 프로덕션과 다른 객체를 검증한다"는 것이다.**
단위 테스트는 순수 객체를, 운영은 프록시 객체를 쓴다. 둘의 동작이 갈리는 지점이 정확히 여기다.

게다가 실패해도 조용했을 것이다. 스케줄러 예외는 사용자 요청 경로가 아니라서 500 응답으로 드러나지 않고,
로그를 따로 보지 않으면 **"보존 정책이 도는 줄 알았는데 몇 달째 한 건도 안 지워진" 상태**가 된다.

---

## 3. 근본 원인

Spring AOP는 **프록시 기반**이다. 애노테이션(`@Transactional`, `@Async`, `@Cacheable`, `@Retryable`,
`@PreAuthorize` 등)은 전부 프록시가 호출을 가로챌 때만 동작한다.

```
[외부 호출]  →  프록시  →  실제 객체 메서드     ← 애노테이션 동작함
[내부 호출]              실제 객체 → this.메서드  ← 애노테이션 무시됨
```

즉 **같은 클래스 안에서 자기 메서드를 부르면 그 메서드의 AOP 애노테이션은 전부 무효**다.

---

## 4. 수정

`@Transactional`을 진입점(프록시를 거치는 메서드)으로 올리고, 내부 헬퍼를 없앴다.

```java
@Scheduled(cron = "0 30 3 * * *")
@Transactional
public void purgeOldAccessLogs() {
    if (!retentionEnabled) { ... return; }
    if (retentionDays <= 0) { ... return; }

    LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
    int deleted = repository.deleteOlderThan(cutoff);
}
```

`@Scheduled` 메서드에 `@Transactional`을 붙이는 것은 안전하다.
Spring이 스케줄 작업을 등록할 때 잡는 참조가 **프록시**이기 때문이다.

> 다시 헬퍼로 분리하고 싶어지는 유혹이 있어서, 코드에 Javadoc으로 이유를 박아뒀다.

---

## 5. 탐지 규칙 (재발 방지)

### 5-1. 코드 리뷰 체크리스트

- [ ] AOP 애노테이션(`@Transactional` / `@Async` / `@Cacheable` / `@Retryable` / `@PreAuthorize`)이
      붙은 메서드를 **같은 클래스 안에서** 호출하는 곳이 있는가?
- [ ] `@Scheduled`, `@EventListener`, `@PostConstruct` 등 **진입점** 메서드가
      내부 애노테이션 메서드를 호출하는가?
- [ ] 애노테이션이 붙은 메서드가 `private`인가? (`private`이면 프록시가 아예 오버라이드할 수 없어 항상 무효)

한 줄 grep으로 후보를 뽑을 수 있다.

```bash
# @Transactional / @Async 가 붙은 메서드명을 뽑아, 같은 파일에서 호출되는지 본다
grep -rn -A2 "@Transactional\|@Async" backend/src/main/java --include="*.java"
```

### 5-2. 테스트로 잡으려면

단위 테스트로는 **원리적으로 잡을 수 없다** (프록시가 없으므로).
잡으려면 스프링 컨텍스트가 뜬 상태에서 **주입받은 빈**으로 호출해야 한다.

```java
@SpringBootTest
class AccessLogRetentionSchedulerIT {

    @Autowired
    private AccessLogRetentionScheduler scheduler;   // ← 프록시가 주입된다

    @Test
    void 스케줄_메서드가_트랜잭션_안에서_실행된다() {
        scheduler.purgeOldAccessLogs();   // 프록시 경유 → TransactionRequiredException 이면 실패
    }
}
```

핵심은 **`new`로 만든 객체가 아니라 컨테이너가 준 빈을 쓰는 것**이다.

> 이번 건은 통합 테스트를 추가하지 않고 코드 리뷰로 잡았다.
> `@SpringBootTest`는 비싸므로, 이 클래스의 버그 유형이 재발하면 그때 추가한다.

---

## 6. 이 프로젝트의 형제 사례

`backend/CLAUDE.md`에 이미 같은 뿌리의 규칙이 있다.

> `@Async` 호출 서비스 메서드에 `@Transactional` 금지 — 비동기 스레드는 uncommitted row를 못 본다

`@Async`도 프록시 기반이라 self-invocation 시 **비동기로 안 돌고 그냥 동기 실행**된다.
증상만 다를 뿐(트랜잭션 누락 vs 비동기 누락) **원인은 동일**하다.

**정리: 이 프로젝트에서 프록시 애노테이션은 항상 "누가 이 메서드를 부르는가"를 먼저 확인하고 붙인다.**
