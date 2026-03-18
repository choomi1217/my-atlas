# Implement Company Features

## Current Project State
- Monorepo structure complete (frontend/, backend/)
- Packages: com.myqaweb.senior / .knowledgebase / .convention / .feature / .ticket / .common
- DB: PostgreSQL 15 + pgvector, running locally via Docker Compose
- Frontend routing: / /kb /conventions /features /ticket already configured

## Prerequisite
If spring.ai.anthropic.api-key and spring.ai.vectorstore.pgvector
are not configured in application.yml, add them as well.

## Goal
Implement full CRUD for Company Features (backend + frontend)

---

## Database Design

### Create Flyway migration file (V1__create_company_features.sql)

#### company table
- id           BIGINT PK AUTO_INCREMENT
- name         VARCHAR(100) NOT NULL
- is_active    BOOLEAN DEFAULT FALSE
- created_at   TIMESTAMP DEFAULT NOW()
- Constraint: only one row with is_active=true allowed at a time (partial unique index)

#### product table
- id            BIGINT PK AUTO_INCREMENT
- company_id    BIGINT FK → company.id
- name          VARCHAR(100) NOT NULL
- platform      VARCHAR(20) NOT NULL  -- WEB / DESKTOP / MOBILE / ETC
- description   TEXT
- created_at    TIMESTAMP DEFAULT NOW()

#### feature table
- id            BIGINT PK AUTO_INCREMENT
- product_id    BIGINT FK → product.id
- path          VARCHAR(500) NOT NULL  -- e.g. "Main Page › Login › Social Login"
- name          VARCHAR(200) NOT NULL
- description   TEXT                  -- human-readable description
- prompt_text   TEXT                  -- text to inject into AI prompt
- embedding     VECTOR(1536)          -- pgvector, used for RAG
- created_at    TIMESTAMP DEFAULT NOW()
- updated_at    TIMESTAMP DEFAULT NOW()

---

## Backend Implementation (com.myqaweb.feature)

### Entity
- Create JPA Entities for Company, Product, Feature
- Apply pgvector custom type for the embedding field in Feature

### Repository
- CompanyRepository: include findByIsActiveTrue()
- ProductRepository: include findAllByCompanyId()
- FeatureRepository
  - findAllByProductId()
  - Similarity search: findTopKByEmbedding(float[] embedding, int k)
    → Use pgvector <=> operator (cosine similarity)
    → Implement with native @Query

### Service

#### CompanyService
- Get all companies
- Register a company
- Switch active company (setActive): set current active to false, then set selected to true
- Delete a company

#### ProductService
- Get products by companyId
- Create / update / delete product

#### FeatureService
- Full CRUD for Feature
- saveWithEmbedding(FeatureRequest): concatenate description + prompt_text,
  generate vector via Claude Embeddings API, save to embedding column
- searchSimilar(String query, int topK): embed query, return top-K similar features

### Controller (REST API)

#### /api/companies
- GET    /api/companies               - Get all companies
- POST   /api/companies               - Register a company
- DELETE /api/companies/{id}          - Delete a company
- PATCH  /api/companies/{id}/activate - Switch active company

#### /api/products
- GET    /api/products?companyId={id} - Get products by company
- POST   /api/products                - Create a product
- PUT    /api/products/{id}           - Update a product
- DELETE /api/products/{id}           - Delete a product

#### /api/features
- GET    /api/features?productId={id} - Get features by product
- POST   /api/features                - Create a feature (auto-generate embedding)
- PUT    /api/features/{id}           - Update a feature (regenerate embedding)
- DELETE /api/features/{id}           - Delete a feature

---

## Frontend Implementation (/features page)

### Layout (3-column)
- Left sidebar: company list + activate button + add company button
- Center panel: product list of selected company (with platform badge)
- Right panel: feature list of selected product

### Company Sidebar
- Display list of company names
- Highlight currently active company (visual distinction)
- "Set Active" button (My Senior will answer based on this company's data)
- Add / delete company buttons

### Product Panel
- Display products as cards
- Platform badge: WEB / DESKTOP / MOBILE / ETC
- Add product button (name, platform, description input form)

### Feature Panel
- Visualize depth by parsing › separator from path (indentation per level)
- Click a feature to open edit form
  - Editable fields: path, name, description, prompt_text
  - Show loading indicator while embedding is being generated on save
- Add feature button

### State Management
- Manage activeCompany in global state (accessible from other pages)
- Use React Context or Zustand

---

## Notes
- Embedding generation is handled automatically on the backend when a feature is saved or updated
  (frontend only needs to show loading state and completion feedback)
- Prevent concurrency issues in setActive: wrap in a single transaction
- platform managed as a backend Enum: WEB, DESKTOP, MOBILE, ETC
- Apply error handling and loading states to all buttons
- Embedding model: text-embedding-3-small (based on Spring AI anthropic config)