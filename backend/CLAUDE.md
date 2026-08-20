# Backend: Java 21 + Spring Boot + Gradle

This file governs all backend development. **Always reference this when making changes to `/backend`.**

> 기술 스택·의존성 버전은 `build.gradle`이, 설정값은 `application.yml`이, 패키지 구조는 레포 트리가 소유한다.
> 표준 Gradle 명령(`build`, `test`, `bootRun`, `jacocoTestReport`)은 여기 중복 기재하지 않는다.
> **여기에는 기본값과 다른 컨벤션, 함정, 근거만 둔다.**

---

## ⚙️ 설정 근거 (코드만 봐서는 알 수 없는 것)

- **Hibernate `ddl-auto: none`** — Flyway가 schema를 단독 소유하고 Hibernate는 ORM만 담당한다.
  브랜치를 오가며 공유 DB를 쓰는 환경에서 entity drift로 인한 boot 실패를 막기 위한 것이므로,
  편의를 위해 `update`/`create`로 바꾸지 말 것.
- **마이그레이션 파일명은 타임스탬프 버전** (`V{YYYYMMDD}{HHmm}__{설명}.sql`) — 순차 번호 금지.
  자세한 규칙은 루트 `CLAUDE.md` 참조.

---

## 📋 Naming & Code Conventions

기본값과 **다른** 선택만 나열한다. 나머지는 Spring Boot 관례를 따른다.

### Classes
- **Controller:** `{Domain}Controller` — `@RestController` + `@RequestMapping("/api/{domain}")`
- **Service:** `{Domain}Service` (interface) + `{Domain}ServiceImpl` (`@Service`)
  - 인터페이스를 먼저 정의한다 — impl 클래스만 만들지 않는다
- **Repository:** `{Domain}Repository extends JpaRepository<{Entity}, Long>`
- **Entity:** `{Domain}Entity` — `@Entity` + `@Table(name = "{table_name}")`
- **DTO:** `{Domain}Dto` 또는 `{Domain}Request` / `{Domain}Response`
  - **불변 DTO는 `record`를 사용한다** (class + getter 금지)

### 필수 규칙
- **생성자 주입만 사용한다** — `@Autowired` 필드 주입 금지 (`final` 필드 + 생성자 또는 `@RequiredArgsConstructor`)
- **Controller 반환 타입은 `ResponseEntity<ApiResponse<T>>`로 통일한다** (`common/ApiResponse.java`)
- **nullable 반환은 `Optional<T>`** — `null` 반환 금지
- **Controller에 비즈니스 로직 금지** — 반드시 Service에 위임
- **매직 넘버/문자열은 상수로 추출** (`public static final` 또는 enum)
- **public 메서드에는 Javadoc** — package-private/private은 복잡할 때만

---

## 🔐 Security

- **JPQL/HQL은 반드시 파라미터 바인딩** (`:param`) — 문자열 연결로 쿼리 조립 금지
- **모든 public API 엔드포인트는 `@Valid` + Jakarta Bean Validation으로 입력 검증**
  (검증 실패는 `@RestControllerAdvice`가 자동 처리)
- **API 키 하드코딩 금지** — `application.yml`에서 `${ENV_VAR}`로 주입, `@Value`/`@ConfigurationProperties`로 접근
- **민감 정보 로깅 금지** — API 키, 비밀번호, 개인정보, 토큰

---

## ✅ Testing Requirements

- **Unit (Service):** JUnit 5 + Mockito, `src/test/java/com/myqaweb/{domain}/`, `{Service}Test.java`
  - **line coverage 70% 이상 유지** (`jacocoTestCoverageVerification`)
- **Controller:** `@WebMvcTest` + service layer mock — 요청/응답 매핑, HTTP status, validation 검증
- **Integration:** Testcontainers(pgvector) — vector search, PDF 파이프라인, Company activation mutex
- **테스트 전용 유틸리티 클래스 작성 금지** — 테스트 리소스는 실제 파일로 `src/test/resources/`에 배치
- ChatClient fluent chain을 바꾸면 **unit test와 integration test stub을 양쪽 다** 갱신할 것

---

## 🚨 Common Pitfalls

| ❌ | ✅ |
|----|----|
| `@Autowired` 필드 주입 | `final` 필드 + 생성자 주입 |
| `null` 반환 | `Optional<T>` 반환 |
| Controller에 비즈니스 로직 | Service에 위임 |
| `@Async` 호출 서비스 메서드에 `@Transactional` | 분리 — 비동기 스레드는 uncommitted row를 못 본다 |
| LLM JSON 응답을 그대로 파싱 | per-call `maxTokens` + truncation 복구 파서를 **항상 함께** |

---

## 🔗 Related Files

- Main config: `src/main/resources/application.yml`
- Test config: `src/test/resources/application.yml` (H2, Flyway 비활성, 더미 API 키)
- Spring AI config: `config/` 패키지의 `@Configuration` 클래스
- Global exception handler: `exception/GlobalExceptionHandler.java`
- Migrations: `src/main/resources/db/migration/`
- Build config: `build.gradle`
- Root context: `/my-atlas/CLAUDE.md`
