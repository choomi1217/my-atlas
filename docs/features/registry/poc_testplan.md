# PoC Phase 0 - Agentic Test Execution Plan

> 변경 유형: 기능 추가  
> 작성일: 2026-07-13  
> 버전: v1 (PoC)  
> 상태: 완료 (판정 6/6, go/no-go는 `registry_v20.md`가 소유)

> ⚠️ 아래 "Environment / Prerequisites"의 worktree 경로
> (`.claude/worktrees/registry`)는 **작성 시점의 사실**이다.
> worktree 모델은 ops v35 Part 1에서 폐기됐으므로, 지금 재현할 때는
> 레포 루트(`/Users/yeongmi/dev/qa/my-atlas`)를 기준으로 읽는다.

---

## Goal
An AI agent drives a real browser against the locally running my-atlas app,
executes each TC step by step, and judges PASS/FAIL.
5 gold TCs (all "create" happy-path, expected verdict = PASS) +
1 negative TC (expected verdict = FAIL, to validate the judge can detect FAIL).

## Environment / Prerequisites
- worktree root: /Users/yeongmi/dev/qa/my-atlas/.claude/worktrees/registry
- Start app: from root run `docker compose up` (also docker-compose.db.yml if DB is separate)
  - On boot, Flyway applies seeds -> company "my-atlas", product "Product Test Suite", seed TCs
- Frontend: http://localhost:5178   Backend (API proxied at /api): http://localhost:8085
- Healthcheck: GET http://localhost:8085/api/settings/public -> { loginRequired: true }
- Login gate (NOT a gold TC): at /login use #username=admin / #password=admin
  -> JWT stored in localStorage['my-atlas-token']
- No DB reset between runs -> assign {seq} per run (e.g. yyyymmdd-HHMMSS),
  append as suffix to created resource names so each run's artifacts are uniquely identifiable

## Routes / Selector hints (verified in code)
- /features                                    -> CompanyListPage. Button label: "+ New Company"
  -> CompanyFormModal (input placeholder "Company name...", submit button "Create").
     Clicking a company card navigates in.
- /features/companies/:companyId               -> ProductListPage. "Add New" card.
  -> ProductFormModal (input placeholder "Product name...",
     Platform <select> options WEB/DESKTOP/MOBILE/ETC, submit "Create").
     Search placeholder "Search products...". Clicking a product card navigates in.
- /features/companies/:companyId/products/:productId -> TestCasePage.
  SegmentTreeView + "+ Add Test Case". Clicking a tree node sets selectedPath.
  - Add segment: button "Root Path ë±ë¡" (empty state) or "+ Root Path";
    inline input placeholder "Path ì´ë¦ ìë ¥..."; confirm via green check button or Enter.
  - TestCaseFormModal: Title (required), Priority/Type/Status <select>,
    "+ Add Step", submit "Create".
  (NOTE: quoted Korean strings above are the literal on-screen UI labels the agent must match.)

---

## Gold TCs (expected verdict = PASS)

### G1 - TC-01 Company create  (HIGH/SMOKE, easy)
- Enter: /features
- Steps:
  1) Click "+ New Company" -> modal opens
  2) Type `TestCo-{seq}` into "Company name..."
  3) Click "Create"
- PASS: modal closes AND list shows card `TestCo-{seq}`
- expected_result: new Company saved and shown in the list

### G2 - TC-08 Product create  (HIGH/SMOKE, easy-med)
- Precondition: from G1 click card `TestCo-{seq}` -> /features/companies/:id
- Steps:
  1) Click "Add New" card -> ProductFormModal
  2) Type `WebApp-{seq}` into "Product name..."
  3) Select WEB in Platform <select>
  4) Click "Create"
- PASS: modal closes AND product list under that company shows `WebApp-{seq}`
- expected_result: new Product saved under selected Company and shown

### G3 - TC-15 Root Segment create  (HIGH/FUNCTIONAL, medium)
- Precondition: from G2 click card `WebApp-{seq}` -> .../products/:id (TestCasePage)
- Steps:
  1) Click "Root Path ë±ë¡" / "+ Root Path" -> inline input
  2) Type `Authentication-{seq}` into "Path ì´ë¦ ìë ¥..."
  3) Click green check button (or press Enter)
- PASS: tree shows root node `Authentication-{seq}`
- expected_result: Root Segment created under Product and shown in tree

### G4 - TC-18 TestCase create  (HIGH/SMOKE, medium)
- Precondition: click tree node `Authentication-{seq}` -> sets selectedPath
- Steps:
  1) Click "+ Add Test Case" -> TestCaseFormModal (path prefilled)
  2) Type `TC-Create-{seq}` into Title
  3) Select Priority/Type/Status (defaults OK)
  4) Add >=1 step via "+ Add Step"
  5) Click "Create"
- PASS: list shows `TC-Create-{seq}` under path `Authentication-{seq}`
- expected_result: new TestCase saved under selected path and shown

### G5 - TC-22 Company->Product->TestCase full flow  (HIGH/E2E, hardest)
- Use independent id (e.g. E2E-{seq}); validates 3-level route drilldown
- Steps & PASS:
  1) /features -> create Company `QA-Team-{seq}` -> appears in list
  2) Click card -> route changes to /features/companies/:id (observe)
  3) Create Product `Mobile-App-{seq}`, Platform MOBILE -> appears in list
  4) Click card -> route changes to .../products/:id (observe)
  5) Add Segment `Feature-A-{seq}` then child `Scenario-1-{seq}` -> tree built
  6) Select `Scenario-1-{seq}`, create TestCase `E2E-TC-{seq}` -> saved under that path
  7) Edit then delete the created TestCase -> CRUD works
- expected_result: full 3-level drilldown flow works end to end

---

## Negative TC (expected verdict = FAIL)

### N1 - Company duplicate-name rejection (synthetic TC; not in seed)
- Rationale: app has NO uniqueness/duplicate check on Company name
  (V1 unique index is on is_active only; no company existsByName in backend;
   no client-side dup check in CompanyFormModal) -> creating same name always succeeds.
- Precondition: a Company `DupCo-{seq}` already created earlier in THIS run.
  Cross-run uniqueness kept by {seq}; reuse same name only within the run.
- Steps:
  1) Click "+ New Company" -> modal
  2) Type the SAME `DupCo-{seq}` (identical to existing)
  3) Click "Create"
- TC's claimed expected_result (intentionally wrong):
  "duplicate-name error shown, second Company not created"
- Actual app behavior (observed): no error, a second `DupCo-{seq}` card is created (2 in list)
- Expected judge verdict: observed != expected -> judge MUST output FAIL.
  (If judge outputs PASS, the judge logic is broken -> harness bug signal.)

---

## Execution order (main thread)
1. `docker compose up` (root) -> Flyway applies seeds automatically
2. Healthcheck (5178 responds; /api/settings/public loginRequired:true)
3. /login -> admin/admin
4. Assign {seq}, run G1->G2->G3->G4->G5->N1 via browser tools
5. Verdicts: G1..G5 expected PASS; N1 expected FAIL

## Reference files
- Seed gold TCs: backend/src/main/resources/db/migration/V7__seed_testcase_v1.sql
  (TC-01, TC-08, TC-15, TC-18, TC-22; plus company my-atlas / product Product Test Suite / segment tree)
- admin/admin seed: V16__create_app_user.sql
- login_required=true: V202604210900__add_login_required_and_ip_rate_limit.sql
- Screens: frontend/src/pages/features/{CompanyListPage,ProductListPage,TestCasePage}.tsx,
  frontend/src/components/features/{CompanyFormModal,ProductFormModal,SegmentTreeView,TestCaseFormModal}.tsx
- No-dup-check evidence: V1__create_company_features.sql + backend company layer (no existsByName)