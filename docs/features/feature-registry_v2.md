# Company Features → TestCase System Design

## Overview

Redesign the existing Company Features into a TestRail-style drill-down navigation.
When clicking "Company Features" in the LNB, the user navigates step by step through a hierarchical structure.

```
LNB Click → ① Company List → ② Products → ③ Features → ④ Test Cases
```

---

## Navigation Structure

### URL Routing

| Step | URL | Screen |
|---|---|---|
| ① | `/features` | Company list |
| ② | `/features/companies/:companyId` | Product list |
| ③ | `/features/companies/:companyId/products/:productId` | Feature tree |
| ④ | `/features/companies/:companyId/products/:productId/features/:featureId` | Test case list |

- Browser back button naturally navigates to the parent step
- State is restored from URL on page refresh
- Clicking a breadcrumb item jumps directly to that step

### Breadcrumb Example

```
Company Features › Acme Corp › Cloud (WEB) › Login › Social Login
```

---

## Screen-by-Screen Design

### ① Company List

**Entry point**: Click "Company Features" in the LNB

**Layout**: Fill the entire right panel with a Company card grid

**Features**:
- Display list of Company cards
- Visually highlight the active Company (badge or border accent)
- Set Active button (activates the selected Company globally)
- Add Company button with inline input form
- Delete Company button (confirmation modal)
- Click a Company card → navigate to ② Products

---

### ② Products

**Entry point**: Click a Company card

**Layout**: Product card list for the selected Company

**Features**:
- Platform badge on each Product card (WEB / MOBILE / DESKTOP / ETC)
- Add Product button with form (name, platform, description)
- Inline Edit / Delete actions
- Click a Product card → navigate to ③ Features

---

### ③ Features

**Entry point**: Click a Product card

**Layout**: Feature tree for the selected Product

**Features**:
- Parse `›` separator to render indented hierarchy
  - e.g. `"Main Page › Login › Social Login"` → 3-level indent
- Add Feature button with form (path, name, description, prompt_text)
- Click a Feature row → navigate to ④ Test Cases
- Right-click or action button on a Feature row for edit / delete

---

### ④ Test Cases

**Entry point**: Click a Feature row

**Layout**: Test Case card list for the selected Feature

**Features**:
- TC card: title, Priority badge, Type badge, Status, step count
- Click a TC card → detail / edit modal
- Add Test Case button
- **AI Draft Generation button**: automatically generates TC step drafts using the Feature's description + prompt_text via Claude

---

## Database Design

### Existing Tables (unchanged)

- `company` — keep as-is
- `product` — keep as-is
- `feature` — keep as-is (including embedding and prompt_text)

### New Table: `test_case`

```sql
CREATE TABLE test_case (
    id              BIGSERIAL PRIMARY KEY,
    feature_id      BIGINT NOT NULL REFERENCES feature(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    preconditions   TEXT,
    steps           JSONB NOT NULL DEFAULT '[]',
    expected_result TEXT,
    priority        VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',     -- HIGH / MEDIUM / LOW
    test_type       VARCHAR(20) NOT NULL DEFAULT 'FUNCTIONAL', -- SMOKE / FUNCTIONAL / REGRESSION / E2E
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',      -- DRAFT / ACTIVE / DEPRECATED
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

### steps JSONB Structure

```json
[
  {
    "order": 1,
    "action": "Navigate to the login page",
    "expected": "The login form is displayed"
  },
  {
    "order": 2,
    "action": "Click the Google social login button",
    "expected": "The Google OAuth popup opens"
  },
  {
    "order": 3,
    "action": "Select an account",
    "expected": "Redirected to the main page with the user's name displayed"
  }
]
```

### Flyway Migration Filename

```
V2__create_test_case.sql
```

---

## Backend Design (com.myqaweb.feature)

### Entity

```java
// TestCase.java
@Entity
public class TestCase {
    @Id @GeneratedValue
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "feature_id")
    private Feature feature;

    private String title;
    private String preconditions;

    @JdbcTypeCode(SqlTypes.JSON)
    private List<TestStep> steps;

    private String expectedResult;

    @Enumerated(EnumType.STRING)
    private Priority priority;

    @Enumerated(EnumType.STRING)
    private TestType testType;

    @Enumerated(EnumType.STRING)
    private TestStatus status;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

### Enum Definitions

```java
public enum Priority   { HIGH, MEDIUM, LOW }
public enum TestType   { SMOKE, FUNCTIONAL, REGRESSION, E2E }
public enum TestStatus { DRAFT, ACTIVE, DEPRECATED }
```

### Repository

```java
public interface TestCaseRepository extends JpaRepository<TestCase, Long> {
    List<TestCase> findAllByFeatureId(Long featureId);
    List<TestCase> findAllByFeatureIdAndStatus(Long featureId, TestStatus status);
}
```

### Service: TestCaseService

| Method | Description |
|---|---|
| `getByFeatureId(Long featureId)` | Get all TCs belonging to a Feature |
| `create(TestCaseRequest)` | Create a TC |
| `update(Long id, TestCaseRequest)` | Update a TC |
| `delete(Long id)` | Delete a TC |
| `generateDraft(Long featureId)` | Generate an AI draft based on Feature info |

### generateDraft Logic

1. Fetch Feature by `featureId` (extract description + prompt_text)
2. Call Claude API with Feature info as context to request TC step drafts
3. Parse the response and convert to `steps` JSONB format
4. Save with status = DRAFT and return

### REST API

#### Test Case Endpoints

| Method | URL | Description |
|---|---|---|
| GET | `/api/test-cases?featureId={id}` | Get TC list by Feature |
| POST | `/api/test-cases` | Create a TC |
| PUT | `/api/test-cases/{id}` | Update a TC |
| DELETE | `/api/test-cases/{id}` | Delete a TC |
| POST | `/api/test-cases/generate-draft?featureId={id}` | Generate AI draft |

---

## Frontend Design

### Routing Structure (React Router)

```jsx
<Route path="/features">
  <Route index element={<CompanyListPage />} />
  <Route path="companies/:companyId" element={<ProductListPage />} />
  <Route path="companies/:companyId/products/:productId" element={<FeatureTreePage />} />
  <Route path="companies/:companyId/products/:productId/features/:featureId" element={<TestCasePage />} />
</Route>
```

### Global State (Zustand)

```ts
interface FeatureStore {
  // Existing
  activeCompany: Company | null;
  setActiveCompany: (company: Company) => void;

  // For drill-down navigation (synced with URL params)
  selectedCompany: Company | null;
  selectedProduct: Product | null;
  selectedFeature: Feature | null;
}
```

> URL parameters are the source of truth for drill-down selection state.
> Zustand is responsible only for `activeCompany`, which needs to be shared across other pages.

### Breadcrumb Component

```tsx
// Dynamically rendered based on the current path
<Breadcrumb>
  <BreadcrumbItem to="/features">Company Features</BreadcrumbItem>
  <BreadcrumbItem to={`/features/companies/${companyId}`}>{company.name}</BreadcrumbItem>
  <BreadcrumbItem to={`/features/companies/${companyId}/products/${productId}`}>
    {product.name} ({product.platform})
  </BreadcrumbItem>
  <BreadcrumbItem>{feature.name}</BreadcrumbItem>
</Breadcrumb>
```

### Test Case Step Builder (inside edit modal)

```
[ Action input ]  [ Expected input ]  [ Delete ]
[ Action input ]  [ Expected input ]  [ Delete ]
[ + Add step ]
```

- Dynamically add / remove rows
- Drag to reorder (optional)

### AI Draft Generation UX

1. Click "✦ Generate AI Draft" button
2. Show loading spinner ("AI is writing test cases...")
3. On completion, a DRAFT status TC card appears in the list
4. User reviews, edits as needed → changes status to ACTIVE

---

## AI Integration Roadmap

| Feature | Description |
|---|---|
| TC draft auto-generation | Generate step drafts from Feature's description + prompt_text |
| Duplicate TC detection | Warn about similar TCs using Feature embedding on save |
| My Senior integration | Inject related TCs as RAG context during ticket analysis |
| Ticket Reviewer integration | Surface related TCs when analyzing the impact scope of a ticket |

---

## Implementation Priority

| Phase | Task | Notes |
|---|---|---|
| 1 | `V2__create_test_case.sql` Flyway migration | |
| 2 | TestCase Entity / Repository / Service / Controller | Full CRUD |
| 3 | Frontend routing restructure (4-step drill-down) | Remove existing 3-panel layout |
| 4 | Breadcrumb + page component for each step | |
| 5 | TC step builder UI | JSONB editing |
| 6 | AI draft generation API + frontend integration | |
| 7 | My Senior / Ticket Reviewer integration | Later phase |