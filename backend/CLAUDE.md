# Backend: Java 21 + Spring Boot 3.3.1 + Gradle

This file governs all backend development. **Always reference this when making changes to `/backend`.**

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| **Language** | Java 21 |
| **Framework** | Spring Boot 3.3.1 |
| **Build Tool** | Gradle (use `./gradlew` scripts) |
| **Data Access** | Spring Data JPA + Hibernate |
| **Database** | PostgreSQL 15+ |
| **Embeddings** | pgvector extension |
| **AI Integration** | Spring AI (Claude claude-3-5-sonnet-20241022) |
| **Dependency Injection** | Spring DI (via `@Component`, `@Service`, `@Repository`) |
| **Validation** | Jakarta Bean Validation (JSR-380) |
| **Testing** | JUnit 5, Mockito |
| **Logging** | SLF4J + Logback |
| **Code Generation** | Lombok (via `@Data`, `@Builder`, etc.) |

---

## 🛠️ Build & Execution Commands

All commands use `./gradlew` (Gradle Wrapper). Run from `/backend` directory.

### Build
```bash
./gradlew build
# Compiles, runs tests, builds JAR at build/libs/myqaweb-*.jar
```

### Run Locally
```bash
./gradlew bootRun
# Starts Spring Boot dev server on http://localhost:8080
# Auto-reloads on file changes (with proper IDE setup)
```

### Test
```bash
./gradlew test
# Runs all unit & integration tests (src/test/java)
# Reports: build/reports/tests/test/index.html
```

### Coverage Report
```bash
./gradlew test jacocoTestReport
# Generates JaCoCo coverage report
# Report: build/reports/jacoco/test/html/index.html
# Verify coverage threshold: ./gradlew jacocoTestCoverageVerification
```

### Clean
```bash
./gradlew clean
# Removes build/ directory for fresh build
```

---

## 📦 Package Structure

All code lives under `src/main/java/com/myqaweb/`:

```
com/myqaweb/
├── MyQaWebApplication.java       # Spring Boot entry point (@SpringBootApplication)
├── common/
│   └── ApiResponse.java          # Shared DTO for REST responses
├── {domain}/                      # Feature domains (repeat per domain)
│   ├── {Domain}Controller.java    # @RestController, @RequestMapping("/api/{domain}")
│   ├── {Domain}Service.java       # Business logic (interface or direct impl)
│   ├── {Domain}Repository.java    # extends JpaRepository<Entity, ID>
│   ├── {Domain}Entity.java        # JPA @Entity
│   └── {Domain}Dto.java           # DTO for API request/response
├── config/
│   ├── JpaConfig.java             # Optional: JPA/Hibernate config
│   └── AiConfig.java              # Spring AI + Claude config
└── exception/
    ├── GlobalExceptionHandler.java # @RestControllerAdvice
    └── CustomException.java        # Custom runtime exceptions
```

**Current domains:** `convention`, `feature`, `knowledgebase`, `senior`

---

## 📋 Naming & Code Conventions

### Classes
- **Controller:** `{Domain}Controller` (e.g., `SeniorController`)
  - Annotate with `@RestController`
  - Annotate with `@RequestMapping("/api/{domain}")`
  - Example: `GET /api/senior/chat`

- **Service:** `{Domain}Service` (interface) + `{Domain}ServiceImpl` (implementation)
  - Interface: Business operations contract
  - Implementation: `@Service` annotation
  - Inject repositories via constructor (prefer over `@Autowired` field injection)
  - Example:
    ```java
    public interface SeniorService {
        ChatResponse askSenior(String query);
    }

    @Service
    public class SeniorServiceImpl implements SeniorService {
        private final SeniorRepository repo;

        public SeniorServiceImpl(SeniorRepository repo) {
            this.repo = repo;
        }

        @Override
        public ChatResponse askSenior(String query) {
            // Implementation
        }
    }
    ```

- **Repository:** `{Domain}Repository extends JpaRepository<{Entity}, Long>`
  - Annotate with `@Repository` (or let Spring auto-detect)
  - Add custom query methods as needed
  - Example:
    ```java
    @Repository
    public interface SeniorRepository extends JpaRepository<SeniorEntity, Long> {
        Optional<SeniorEntity> findByName(String name);
    }
    ```

- **Entity:** `{Domain}Entity`
  - Annotate with `@Entity` and `@Table(name = "{table_name}")`
  - Use Lombok `@Data` for getters/setters/equals/hashCode/toString
  - Mark ID with `@Id @GeneratedValue(strategy = GenerationType.IDENTITY)`
  - Example:
    ```java
    @Entity
    @Table(name = "seniors")
    @Data
    public class SeniorEntity {
        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @Column(nullable = false)
        private String name;
    }
    ```

- **DTO:** `{Domain}Dto` or `{Domain}Request` / `{Domain}Response`
  - For API payloads (request/response bodies)
  - Use **record** (Java 16+) for immutable DTOs:
    ```java
    public record SeniorRequest(String query) {}
    public record SeniorResponse(Long id, String answer) {}
    ```
  - Or use `@Data @Builder` if mutable:
    ```java
    @Data
    @Builder
    public class ConventionDto {
        private Long id;
        private String term;
        private String definition;
    }
    ```

### Methods
- **Controller endpoints:**
  - Use HTTP verbs: `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`
  - Annotate parameters: `@PathVariable`, `@RequestParam`, `@RequestBody`
  - Return `ResponseEntity<ApiResponse<T>>` for consistency
  - Example:
    ```java
    @PostMapping("/chat")
    public ResponseEntity<ApiResponse<ChatResponse>> askQuestion(@RequestBody ChatRequest req) {
        ChatResponse resp = seniorService.askSenior(req.query());
        return ResponseEntity.ok(ApiResponse.success(resp));
    }
    ```

- **Service methods:**
  - Should be **public interface methods** (not all implementation details)
  - Prefer descriptive names over abbreviations
  - Use `Optional<T>` for nullable returns, not null checks
  - Example:
    ```java
    Optional<SeniorEntity> findById(Long id);
    ChatResponse askSenior(String query);
    void deleteSenior(Long id);
    ```

### Constants & Magic Values
- **Extract all magic numbers/strings to constants**
  - Define in a `Constants` class or at class level
  - Use `public static final` or enums
  - Example:
    ```java
    public class SeniorConstants {
        public static final int MAX_QUERY_LENGTH = 500;
        public static final String DEFAULT_MODEL = "claude-3-5-sonnet-20241022";
    }
    ```

### Documentation
- **Public methods require Javadoc:**
  ```java
  /**
   * Fetches a senior QA profile by ID.
   *
   * @param id the unique identifier
   * @return an Optional containing the senior, empty if not found
   */
  public Optional<SeniorEntity> findById(Long id) {
      return repository.findById(id);
  }
  ```
- Package-private / private methods don't need Javadoc unless complex

---

## 🔐 Security Guidelines

### Database
- **Always use parameterized queries** — JPQL/HQL with `:parameter` binding or `?` placeholders
  - ✅ GOOD:
    ```java
    @Query("SELECT s FROM SeniorEntity s WHERE s.name = :name")
    Optional<SeniorEntity> findByName(@Param("name") String name);
    ```
  - ❌ BAD: String concatenation or manual SQL — allows SQL injection

- **Use Spring Data JPA query methods** when possible (auto-parameterized)

### Input Validation
- **All public API endpoints must validate input:**
  ```java
  @PostMapping("/chat")
  public ResponseEntity<?> chat(@Valid @RequestBody ChatRequest req) {
      // ChatRequest has @NotNull, @Size, etc. annotations
  }
  ```
- Use **Jakarta Bean Validation** annotations:
  - `@NotNull`, `@NotBlank`, `@NotEmpty`
  - `@Size(min=..., max=...)`, `@Length`, `@Pattern`
  - `@Email`, `@Positive`, `@Min`, `@Max`
- Validation errors auto-handled by `@RestControllerAdvice` (see exception handling)

### API Keys & Secrets
- **Never hardcode API keys** in source code
- **Use environment variables** in `application.yml`:
  ```yaml
  anthropic:
    api-key: ${ANTHROPIC_API_KEY}  # Injected from .env or GitHub Secrets
    model: claude-3-5-sonnet-20241022
  ```
- Access via `@Value` or `@ConfigurationProperties`
- **GitHub Actions** uses `secrets.ANTHROPIC_API_KEY` (see `.github/workflows/`)

### Logging
- **Never log sensitive data:** API keys, passwords, personal info, tokens
  - ❌ BAD: `log.info("User API key: " + key);`
  - ✅ GOOD: `log.info("API call successful");`
- Use SLF4J for logging:
  ```java
  private static final Logger log = LoggerFactory.getLogger(SeniorService.class);
  log.info("Processing query: {}", query);
  log.error("Error fetching senior", ex);
  ```

### CORS & Authentication
- Configure CORS in `application.yml` or `WebConfig.java` as needed
- If authentication is added, use Spring Security or similar
- Keep JWT tokens in secure, HttpOnly cookies (if applicable)

---

## ✅ Testing Requirements

### Unit Tests (Service Layer)
- **Target:** 70%+ line coverage
- **Tool:** JUnit 5 + Mockito
- **Location:** `src/test/java/com/myqaweb/{domain}/`
- **Pattern:** `{Service}Test.java`
- **Example:**
  ```java
  @ExtendWith(MockitoExtension.class)
  class SeniorServiceTest {
      @Mock private SeniorRepository repository;
      @InjectMocks private SeniorServiceImpl service;

      @Test
      void testAskSeniorSuccess() {
          // Arrange
          SeniorEntity senior = new SeniorEntity();
          senior.setId(1L);
          when(repository.findById(1L)).thenReturn(Optional.of(senior));

          // Act
          Optional<SeniorEntity> result = service.findById(1L);

          // Assert
          assertTrue(result.isPresent());
          assertEquals("Senior Name", result.get().getName());
          verify(repository).findById(1L);
      }
  }
  ```

### Controller Tests
- Use `@WebMvcTest` for isolated controller testing
- Mock the service layer
- Test request/response mapping, HTTP status, validation
- **Example:**
  ```java
  @WebMvcTest(SeniorController.class)
  class SeniorControllerTest {
      @Autowired private MockMvc mockMvc;
      @MockBean private SeniorService service;

      @Test
      void testChatEndpoint() throws Exception {
          ChatResponse response = new ChatResponse("answer");
          when(service.askSenior("query")).thenReturn(response);

          mockMvc.perform(post("/api/senior/chat")
              .contentType(MediaType.APPLICATION_JSON)
              .content("{\"query\":\"test\"}"))
              .andExpect(status().isOk())
              .andExpect(jsonPath("$.data.answer").value("answer"));
      }
  }
  ```

### Integration Tests (Optional)
- Test DB + Service + Controller together
- Use `@SpringBootTest` with test container or H2 database
- Verify end-to-end behavior

### Running Tests
```bash
# All tests
./gradlew test

# Specific class
./gradlew test --tests SeniorServiceTest

# Coverage
./gradlew jacocoTestReport
open build/reports/jacoco/test/html/index.html
```

---

## 🚨 Common Pitfalls

1. **Field injection with `@Autowired`** → Use constructor injection instead
   ```java
   // ❌ BAD
   @Autowired private SeniorRepository repo;

   // ✅ GOOD
   private final SeniorRepository repo;
   public SeniorService(SeniorRepository repo) {
       this.repo = repo;
   }
   ```

2. **Returning null instead of Optional**
   ```java
   // ❌ BAD
   if (entity == null) return null;

   // ✅ GOOD
   return Optional.ofNullable(entity);
   ```

3. **Mixing business logic in Controller**
   ```java
   // ❌ BAD
   @PostMapping("/save")
   public void save(SeniorEntity s) {
       // Business logic here
   }

   // ✅ GOOD
   @PostMapping("/save")
   public ResponseEntity<?> save(@RequestBody SeniorDto dto) {
       service.save(dto);  // Delegate to service
   }
   ```

4. **Not validating input**
   ```java
   // ❌ BAD
   public void process(String query) { }

   // ✅ GOOD
   public void process(@NotBlank String query) { }
   ```

5. **Hardcoding values**
   ```java
   // ❌ BAD
   String apiKey = "sk-ant-...";

   // ✅ GOOD
   @Value("${anthropic.api-key}")
   private String apiKey;
   ```

---

## 📂 Example: Adding a New Domain

Let's say you're adding a `BlogPost` domain:

### 1. Create Entity
```java
// src/main/java/com/myqaweb/blogpost/BlogPostEntity.java
@Entity
@Table(name = "blog_posts")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BlogPostEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
```

### 2. Create Repository
```java
// src/main/java/com/myqaweb/blogpost/BlogPostRepository.java
@Repository
public interface BlogPostRepository extends JpaRepository<BlogPostEntity, Long> {
    List<BlogPostEntity> findByTitleContainingIgnoreCase(String title);
}
```

### 3. Create Service
```java
// src/main/java/com/myqaweb/blogpost/BlogPostService.java
public interface BlogPostService {
    BlogPostDto create(CreateBlogPostRequest request);
    Optional<BlogPostDto> findById(Long id);
    List<BlogPostDto> searchByTitle(String title);
    void delete(Long id);
}

// BlogPostServiceImpl.java
@Service
@RequiredArgsConstructor
public class BlogPostServiceImpl implements BlogPostService {
    private final BlogPostRepository repository;

    @Override
    public BlogPostDto create(CreateBlogPostRequest request) {
        BlogPostEntity entity = new BlogPostEntity();
        entity.setTitle(request.title());
        entity.setContent(request.content());
        BlogPostEntity saved = repository.save(entity);
        return toDto(saved);
    }

    @Override
    public Optional<BlogPostDto> findById(Long id) {
        return repository.findById(id).map(this::toDto);
    }

    private BlogPostDto toDto(BlogPostEntity entity) {
        return new BlogPostDto(entity.getId(), entity.getTitle(), entity.getContent(), entity.getCreatedAt());
    }
}
```

### 4. Create DTOs
```java
// DTOs
public record CreateBlogPostRequest(@NotBlank String title, @NotBlank String content) {}
public record BlogPostDto(Long id, String title, String content, LocalDateTime createdAt) {}
```

### 5. Create Controller
```java
// src/main/java/com/myqaweb/blogpost/BlogPostController.java
@RestController
@RequestMapping("/api/blog")
@RequiredArgsConstructor
public class BlogPostController {
    private final BlogPostService service;

    @PostMapping
    public ResponseEntity<ApiResponse<BlogPostDto>> create(@Valid @RequestBody CreateBlogPostRequest req) {
        BlogPostDto result = service.create(req);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<BlogPostDto>> getById(@PathVariable Long id) {
        return service.findById(id)
            .map(dto -> ResponseEntity.ok(ApiResponse.success(dto)))
            .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Blog post not found")));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<BlogPostDto>>> search(@RequestParam String title) {
        List<BlogPostDto> results = service.searchByTitle(title);
        return ResponseEntity.ok(ApiResponse.success(results));
    }
}
```

### 6. Add Tests
```java
// src/test/java/com/myqaweb/blogpost/BlogPostServiceTest.java
@ExtendWith(MockitoExtension.class)
class BlogPostServiceTest {
    @Mock private BlogPostRepository repository;
    @InjectMocks private BlogPostServiceImpl service;

    @Test
    void testCreateBlogPost() {
        // Arrange
        CreateBlogPostRequest request = new CreateBlogPostRequest("Title", "Content");
        BlogPostEntity entity = new BlogPostEntity();
        entity.setId(1L);
        entity.setTitle("Title");
        when(repository.save(any())).thenReturn(entity);

        // Act
        BlogPostDto result = service.create(request);

        // Assert
        assertEquals("Title", result.title());
        verify(repository).save(any());
    }
}
```

---

## 🔗 Related Files

- Main config: `src/main/resources/application.yml`
- Spring AI config: Look for `@Configuration` classes in `config/` package
- Global exception handler: `exception/GlobalExceptionHandler.java`
- Build config: `build.gradle` (Gradle dependencies, plugins)
- Root context: `/my-atlas/CLAUDE.md`

---

## ✨ Summary

- **Language:** Java 21
- **Build:** `./gradlew build`, `./gradlew bootRun`, `./gradlew test`
- **Packages:** `controller`, `service`, `repository`, `entity`, `dto` per domain
- **DB:** JPA with parameterized queries only
- **Validation:** `@Valid` + Bean Validation
- **Tests:** 70%+ coverage with Mockito + JUnit 5
- **Security:** Never hardcode secrets, validate all input, no sensitive logs
- **Code:** Interfaces for services, records for DTOs, Javadoc on public methods
