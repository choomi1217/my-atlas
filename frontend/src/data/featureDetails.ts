interface ApiEndpoint {
  method: string
  path: string
  desc: string
}

interface SchemaRow {
  table: string
  desc: string
  key: string
}

interface TestRow {
  label: string
  count: number
  detail: string
}

export interface VersionEntry {
  version: string
  date: string
  type: string
  title: string
  highlights: string[]
}

export interface AboutSection {
  why: string[]
  what: string[]
  benefit: string[]
  screenshot?: string
}

export interface FeatureDetail {
  slug: string
  name: string
  tagline: string
  description: string[]
  about: AboutSection
  techStack: string[]
  architecture: string[]
  apis: ApiEndpoint[]
  schema: SchemaRow[]
  testing: TestRow[]
  versions: VersionEntry[]
}

export interface FuturePlan {
  name: string
  description: string
  difficulty: string
}

export const futurePlans: FuturePlan[] = [
  { name: 'Toast 알림 시스템', description: 'alert() 대체, 성공/에러/경고 통합 알림', difficulty: '낮음' },
  { name: 'Error Boundary', description: 'React Error Boundary + Fallback UI', difficulty: '낮음' },
  { name: '404 / Error 페이지', description: '라우트 미스매치 처리', difficulty: '낮음' },
  { name: 'FE 에러 처리 표준화', description: 'Axios 인터셉터 + 공통 에러 hook', difficulty: '중간' },
  { name: '상태 관리 통합', description: 'Context/Zustand 중복 제거', difficulty: '낮음' },
  { name: 'API 문서 (Swagger)', description: 'SpringDoc OpenAPI 자동 생성', difficulty: '낮음' },
  { name: '요청 로깅 미들웨어', description: 'Spring Filter로 요청/응답 로깅', difficulty: '중간' },
  { name: 'Release Readiness 통계', description: 'Feature Registry — Go/No-Go 릴리즈 판단 대시보드', difficulty: '높음' },
]

export const featureDetails: Record<string, FeatureDetail> = {
  senior: {
    slug: 'senior',
    name: 'My Senior',
    tagline: 'RAG 기반 AI 시니어 QA 챗봇',
    description: [
      '사용자의 질문을 임베딩하여 FAQ, Knowledge Base, Convention을 벡터 검색하고, 컨텍스트로 주입한 뒤 Claude API로 답변을 생성한다.',
      'SSE 스트리밍으로 실시간 응답을 제공하며, FAQ 카드뷰에서 자주 묻는 질문을 관리할 수 있다.',
    ],
    about: {
      why: [
        'QA 신입이 반복적으로 같은 질문을 할 때, 시니어가 매번 답변하는 비용을 줄이고 싶었다.',
        '팀의 QA 지식이 개인의 기억에만 존재하면 퇴사 시 소실된다.',
        'FAQ, KB, Convention을 하나의 AI 컨텍스트로 통합하면 "우리 팀만의 시니어"를 만들 수 있다.',
      ],
      what: [
        'RAG(Retrieval-Augmented Generation) 파이프라인으로 팀 지식 기반 AI 챗봇을 구현했다.',
        '질문을 임베딩하여 pgvector 코사인 유사도로 관련 지식을 검색하고, Claude API로 답변을 생성한다.',
        'FAQ 카드뷰에서 자주 묻는 질문을 관리하고, 카드 클릭으로 Chat에 컨텍스트를 전달할 수 있다.',
      ],
      benefit: [
        '신입 QA의 온보딩 시간을 단축 — 반복 질문을 AI가 즉시 답변한다.',
        'FAQ → Chat 컨텍스트 전달로 "이 질문에 대해 더 알려줘" 같은 심화 학습이 가능하다.',
        '팀 지식을 구조화하여 퇴사/이동 시에도 지식이 보존된다.',
      ],
    },
    techStack: ['Spring AI', 'Claude API', 'pgvector', 'SSE', 'OpenAI Embedding', 'React Hooks'],
    architecture: [
      '사용자 질문 + 선택된 FAQ 컨텍스트 수신',
      'OpenAI text-embedding-3-small로 질문 임베딩 생성 (1536 dims)',
      '컨텍스트 수집 — FAQ context (최우선) → Company Features → KB (cosine top 3) → FAQ (cosine top 3) → Conventions (전체)',
      'System Prompt 구성 + Claude claude-3-5-sonnet 호출',
      'SseEmitter로 토큰 단위 스트리밍 응답 전송',
      'Frontend: fetch + ReadableStream으로 실시간 렌더링',
    ],
    apis: [
      { method: 'POST', path: '/api/senior/chat', desc: 'SSE 스트리밍 AI 채팅 (message, faqContext?)' },
      { method: 'GET', path: '/api/senior/faq', desc: 'FAQ 전체 조회' },
      { method: 'POST', path: '/api/senior/faq', desc: 'FAQ 생성 (+ 비동기 임베딩)' },
      { method: 'PUT', path: '/api/senior/faq/{id}', desc: 'FAQ 수정 (+ 비동기 임베딩)' },
      { method: 'DELETE', path: '/api/senior/faq/{id}', desc: 'FAQ 삭제' },
    ],
    schema: [
      { table: 'faq', desc: 'FAQ 항목 (질문/답변 + 벡터 임베딩)', key: 'id, title, content, tags, embedding(1536), created_at' },
      { table: 'knowledge_base', desc: 'QA 지식 (수동 작성 + PDF 청킹)', key: 'id, title, content, source, embedding(1536), created_at' },
      { table: 'convention', desc: '팀 용어 컨벤션 (전체 조회)', key: 'id, term, definition, category, created_at' },
    ],
    testing: [
      { label: 'Service Unit', count: 13, detail: 'FAQ CRUD 9 + Chat Context 4' },
      { label: 'Controller Unit', count: 11, detail: 'REST 엔드포인트 전체' },
      { label: 'Embedding Service', count: 6, detail: '임베딩 생성/변환' },
      { label: 'E2E (Playwright)', count: 8, detail: 'FAQ 진입, 뷰 전환, CRUD, KB 서브뷰' },
    ],
    versions: [
      { version: 'v0', date: '2026-03-20', type: '기능 추가', title: 'My Senior 초기 설계', highlights: ['AI 시니어 QA 챗봇 + FAQ + KB 3탭 구조', 'RAG 파이프라인 설계', 'SSE 스트리밍 구현'] },
      { version: 'v1', date: '2026-03-22', type: '기능 추가', title: 'FAQ 개선 — 기본 진입 화면 변경', highlights: ['기본 진입 화면을 Chat → FAQ로 변경', 'FAQ → Chat 컨텍스트 전달 구현', 'faqContext System Prompt 병합'] },
      { version: 'v2', date: '2026-03-28', type: '테스트 보강', title: 'E2E 테스트 보강', highlights: ['API 5개 + UI 3개 추가', '수정 검증, 검색 필터링, Chat 컨텍스트 전달'] },
      { version: 'v3', date: '2026-04-07', type: '버그 수정', title: 'pgvector VECTOR 타입 매핑 수정', highlights: ['Hibernate 6 + pgvector 호환 이슈 해결', '커스텀 VectorType UserType 구현'] },
      { version: 'v4', date: '2026-04-08', type: '기능 개선', title: 'FAQ → KB 기반 큐레이션 뷰 전환', highlights: ['KB 글 중 선정된 것만 FAQ 목록에 노출', '검색 전적 + 관리자 고정 기능'] },
      { version: 'v5', date: '2026-04-08', type: '기능 개선', title: 'KB 메뉴 분리 + LNB 개선', highlights: ['KB 관리를 독립 메뉴로 이동', 'My Senior는 Chat/FAQ 2탭으로 축소'] },
      { version: 'v6', date: '2026-04-10', type: '기능 개선', title: 'Chat 개선 3종', highlights: ['Markdown 렌더링 (react-markdown)', '채팅 기록 DB 저장 (chat_session/chat_message)', '채팅 → KB 저장 기능'] },
      { version: 'v6.1', date: '2026-04-10', type: '버그 수정', title: 'Chat 스타일 개선', highlights: ['Chat view 폰트/스타일 개선', '기존 세션 호환성 처리'] },
    ],
  },

  kb: {
    slug: 'kb',
    name: 'Knowledge Base',
    tagline: 'PDF 파이프라인 + 벡터 검색 지식 관리',
    description: [
      'QA 지식을 Markdown WYSIWYG 에디터로 작성하거나, PDF 도서를 업로드하면 자동으로 청킹·임베딩하여 벡터 DB에 저장한다.',
      '수동 작성 문서와 PDF 청크를 분리하여 RAG 검색 시 수동 문서(top 3)를 우선하고, PDF(top 2)를 보조로 사용한다.',
    ],
    about: {
      why: [
        'QA 도서(ISTQB, 테스트 설계 등)의 내용을 팀 내에서 빠르게 검색하고 참조하고 싶었다.',
        'PDF 도서를 통째로 읽는 것보다, 관련 챕터만 AI가 찾아주면 업무 효율이 올라간다.',
        '수동 작성 지식과 PDF 도서를 하나의 벡터 DB에서 통합 검색할 수 있어야 했다.',
      ],
      what: [
        'Markdown WYSIWYG 에디터로 QA 지식을 작성하고, 이미지를 첨부할 수 있다.',
        'PDF 도서를 업로드하면 자동으로 챕터 파싱 → 토큰 기반 청킹 → 임베딩 파이프라인이 실행된다.',
        'My Senior 챗봇의 RAG 소스로 활용되어, 질문 시 관련 지식이 컨텍스트로 주입된다.',
      ],
      benefit: [
        'PDF 도서의 특정 내용을 AI가 즉시 찾아주어 학습 시간을 절약한다.',
        '팀원이 직접 작성한 QA 지식을 우선 검색(top 3)하여 팀 맞춤형 답변을 제공한다.',
        '비동기 파이프라인으로 대용량 PDF도 백그라운드 처리 — 업무 중단 없이 지식 축적 가능하다.',
      ],
    },
    techStack: ['PDFBox', 'pgvector', 'OpenAI Embedding', '@uiw/react-md-editor', 'Spring @Async', 'Virtual Threads'],
    architecture: [
      'PDF 업로드 → PENDING Job 생성, jobId 즉시 반환',
      '@Async Worker: PDFBox 텍스트 추출 → 정규식 챕터 파싱',
      '토큰 기반 청킹 (500-800 tokens, 50 overlap)',
      '청크별 OpenAI 임베딩 생성 (Rate Limit: 200ms sleep, 429 시 5s retry × 3)',
      'knowledge_base 테이블에 source=도서명으로 저장',
      'Frontend: 3초 간격 polling으로 Job 상태 추적',
    ],
    apis: [
      { method: 'POST', path: '/api/kb', desc: 'KB 생성 (Markdown + 비동기 임베딩)' },
      { method: 'GET', path: '/api/kb', desc: 'KB 전체 조회' },
      { method: 'PUT', path: '/api/kb/{id}', desc: 'KB 수정' },
      { method: 'DELETE', path: '/api/kb/{id}', desc: 'KB 삭제' },
      { method: 'POST', path: '/api/kb/upload-pdf', desc: 'PDF 업로드 → jobId' },
      { method: 'GET', path: '/api/kb/jobs/{jobId}', desc: 'Job 상태 조회' },
      { method: 'DELETE', path: '/api/kb/books/{source}', desc: '도서 단위 일괄 삭제' },
    ],
    schema: [
      { table: 'knowledge_base', desc: 'QA 지식 (수동: source=null, PDF: source=도서명)', key: 'id, title, content, category, tags, source, embedding(1536)' },
      { table: 'pdf_upload_job', desc: 'PDF 비동기 처리 이력', key: 'id, book_title, original_filename, status(ENUM), total_chunks, error_message' },
    ],
    testing: [
      { label: 'Service Unit', count: 13, detail: 'CRUD + stripMarkdown' },
      { label: 'Controller Unit', count: 8, detail: 'REST + PDF + Validation' },
      { label: 'Integration', count: 5, detail: 'Vector Search, Source 필터, Book 삭제' },
      { label: 'E2E (Playwright)', count: 12, detail: 'API CRUD + UI 에디터 + 카드' },
    ],
    versions: [
      { version: 'v0', date: '2026-03-24', type: '기능 추가', title: 'LNB 독립 메뉴 + PDF 파이프라인', highlights: ['KB를 My Senior에서 분리하여 독립 메뉴로 구성', 'PDF 파싱/청킹/임베딩 파이프라인 구현'] },
      { version: 'v0.1', date: '2026-03-25', type: '버그 수정', title: '@Async self-invocation + Rate Limit', highlights: ['PDF 처리 시 비동기 호출 문제 해결', 'OpenAI API 429 대응 (5초 retry × 3)'] },
      { version: 'v1', date: '2026-04-06', type: '테스트 보강', title: 'E2E 테스트 보강', highlights: ['API 테스트 8개 추가', 'UI 테스트 커버리지 확대'] },
      { version: 'v2', date: '2026-04-06', type: '기능 개선', title: 'Markdown 에디터 + 이미지 첨부', highlights: ['@uiw/react-md-editor 도입', 'KB 페이지 전면 구현 (/kb, /kb/write, /kb/edit)', 'RAG 우선순위 (수동 top 3 + PDF top 2)'] },
      { version: 'v3', date: '2026-04-08', type: '기능 개선', title: 'stripMarkdown + 접근성 개선', highlights: ['임베딩 시 stripMarkdown 적용', 'Markdown 에디터 UX 개선'] },
      { version: 'v4', date: '2026-04-09', type: '버그 수정', title: 'pgvector 타입 매핑 수정', highlights: ['embedding 필드 @Transient 선언', '네이티브 쿼리 전환'] },
      { version: 'v5', date: '2026-04-10', type: '기능 개선', title: 'PDF 메타데이터 + 재업로드 방지', highlights: ['source 컬럼으로 PDF 구분', '동일 책 재업로드 시 기존 청크 삭제 후 신규'] },
      { version: 'v6', date: '2026-04-10', type: '기능 추가', title: '상세 조회/수정 페이지', highlights: ['/kb/:id 상세 페이지', '/kb/edit/:id 수정 페이지', 'PDF 챕터별 필터링'] },
    ],
  },

  conventions: {
    slug: 'conventions',
    name: 'Word Conventions',
    tagline: '팀 용어 표준화 사전',
    description: [
      '디자이너가 "LNB"라 하고 개발자가 "사이드바"라 하는 용어 불일치를 해결하기 위한 팀 공식 용어 사전이다.',
      'My Senior 챗봇의 RAG 컨텍스트에 전체 용어가 주입된다.',
    ],
    about: {
      why: [
        '디자이너가 "LNB"라 하고 개발자가 "사이드바"라 하면, 테스트 케이스에 어떤 용어를 써야 할까?',
        '용어가 통일되지 않으면 버그 리포트의 재현 단계가 모호해지고 커뮤니케이션 비용이 증가한다.',
        '팀 공식 용어 사전이 있으면 QA 문서의 일관성이 보장된다.',
      ],
      what: [
        '용어(term)와 정의(definition)를 등록하고, 이미지를 첨부하여 시각적 참고자료를 제공한다.',
        'Drag & Drop 이미지 업로드, 알파벳/가나다 순 정렬, 키워드 검색을 지원한다.',
        'My Senior 챗봇의 RAG에 전체 용어가 주입되어, AI 답변에서도 팀 용어가 사용된다.',
      ],
      benefit: [
        '테스트 케이스, 버그 리포트, 릴리즈 노트에서 동일한 용어를 사용할 수 있다.',
        '신입 QA가 팀 용어를 빠르게 학습할 수 있다.',
        'AI 챗봇이 팀 용어를 인식하여 더 정확한 답변을 생성한다.',
      ],
    },
    techStack: ['Spring Boot CRUD', 'Image Upload', 'Drag & Drop', 'Tailwind Grid'],
    architecture: [
      '용어(term) + 정의(definition) + 카테고리 + 이미지 URL 구조',
      '이미지 Drag & Drop 업로드 → 로컬 파일시스템 저장 (UUID 파일명)',
      '알파벳/가나다 순 정렬, 키워드 검색 지원',
      'RAG에서 Convention 전체를 System Prompt에 주입 (임베딩 없이 전체 조회)',
    ],
    apis: [
      { method: 'GET', path: '/api/conventions', desc: '전체 조회' },
      { method: 'POST', path: '/api/conventions', desc: '생성 (term, definition 필수)' },
      { method: 'PUT', path: '/api/conventions/{id}', desc: '수정' },
      { method: 'DELETE', path: '/api/conventions/{id}', desc: '삭제' },
      { method: 'POST', path: '/api/convention-images', desc: '이미지 업로드' },
    ],
    schema: [
      { table: 'convention', desc: '팀 용어 사전 (임베딩 없음)', key: 'id, term, definition, category, image_url, created_at, updated_at' },
    ],
    testing: [
      { label: 'Service Unit', count: 6, detail: 'CRUD + imageUrl/updatedAt' },
      { label: 'Controller Unit', count: 5, detail: 'REST + 이미지' },
      { label: 'E2E API', count: 14, detail: 'CRUD + Validation + 이미지' },
      { label: 'E2E UI', count: 8, detail: '목록, 생성, 수정, 삭제, 검색, 정렬' },
    ],
    versions: [
      { version: 'v0', date: '2026-03-20', type: '기능 추가', title: 'Backend CRUD 구현', highlights: ['Convention CRUD API', 'E2E 테스트'] },
      { version: 'v1', date: '2026-04-10', type: '기능 추가', title: 'Frontend 전면 구현', highlights: ['Card List, 등록/수정 페이지', '이미지 첨부 (Drag & Drop)', 'DB image_url/updated_at 컬럼 추가'] },
    ],
  },

  'test-suite': {
    slug: 'test-suite',
    name: 'Product Test Suite',
    tagline: '계층형 테스트 케이스 관리 시스템',
    description: [
      'Company → Product → TestCase 3단계 드릴다운 구조로 테스트 케이스를 관리한다.',
      'Segment 트리(Adjacency List)로 논리적 경로를 설정하고, AI가 테스트 케이스 초안을 자동 생성한다.',
    ],
    about: {
      why: [
        '테스트 케이스가 스프레드시트에 흩어져 있으면 "어디에 어떤 TC가 있는지" 파악하기 어렵다.',
        'TestRail 같은 상용 도구의 핵심 기능(계층 구조, 경로 관리)을 직접 구현하여 팀에 맞게 커스터마이징하고 싶었다.',
        'AI가 Feature 설명만으로 테스트 케이스 초안을 생성하면 TC 작성 시간을 줄일 수 있다.',
      ],
      what: [
        'Company → Product → TestCase 3단계 드릴다운으로 테스트 케이스를 체계적으로 관리한다.',
        'Segment 트리(Adjacency List)로 "설정 > 계정 > 비밀번호 변경" 같은 논리적 경로를 설정한다.',
        'Claude AI가 Product와 Segment 경로 기반으로 테스트 스텝을 자동 생성한다 (DRAFT → 검토 → ACTIVE).',
      ],
      benefit: [
        '테스트 케이스의 위치를 Segment 경로로 명확히 알 수 있어 중복/누락을 방지한다.',
        'AI 드래프트로 TC 작성 시간을 절약하고, QA는 검토에 집중할 수 있다.',
        'Test Run과 Version 관리로 릴리즈별 테스트 범위를 정의하고 추적할 수 있다.',
      ],
    },
    techStack: ['Spring AI', 'Claude API', 'Adjacency List', 'Drag & Drop', 'Zustand', 'Cascading Dropdown'],
    architecture: [
      'Company: Partial Unique Index로 활성 회사 1개만 보장',
      'Segment: self-referencing FK 기반 Adjacency List 트리 구조',
      'TestCase: path(bigint[]) 배열로 Segment 경로 저장, Steps는 JSONB',
      'DnD: Segment 부모 변경 시 BFS로 순환 참조 검증',
      'AI Draft: Claude가 productId + path 기반으로 테스트 스텝 JSON 생성',
    ],
    apis: [
      { method: 'GET', path: '/api/companies', desc: '회사 목록' },
      { method: 'PATCH', path: '/api/companies/{id}/activate', desc: '회사 활성화 (1개만)' },
      { method: 'GET', path: '/api/products?companyId={id}', desc: '제품 목록' },
      { method: 'GET', path: '/api/segments?productId={id}', desc: '세그먼트 트리 조회' },
      { method: 'PATCH', path: '/api/segments/{id}/parent', desc: '부모 변경 (DnD)' },
      { method: 'GET', path: '/api/test-cases?productId={id}', desc: '테스트 케이스 목록' },
      { method: 'POST', path: '/api/test-cases/generate-draft', desc: 'AI 드래프트 생성' },
    ],
    schema: [
      { table: 'company', desc: '회사 (활성 1개 제한)', key: 'id, name, is_active, created_at' },
      { table: 'product', desc: '제품', key: 'id, company_id(FK), name, platform(ENUM)' },
      { table: 'segment', desc: '세그먼트 트리 (Adjacency List)', key: 'id, name, product_id(FK), parent_id(FK self-ref)' },
      { table: 'test_case', desc: '테스트 케이스', key: 'id, product_id(FK), path(bigint[]), title, steps(JSONB), priority, test_type, status' },
    ],
    testing: [
      { label: 'Service Unit', count: 25, detail: 'Company/Product/Segment/TestCase 서비스' },
      { label: 'Controller Unit', count: 20, detail: 'REST 엔드포인트 전체' },
      { label: 'E2E API', count: 46, detail: 'Company 6 + Product 10 + Segment 11 + TestCase 19' },
      { label: 'E2E UI', count: 16, detail: 'Company 7 + Product 4 + TestCase 5' },
    ],
    versions: [
      { version: 'v1', date: '2026-03-15', type: '기능 추가', title: 'Company + Product + Feature 초기 구조', highlights: ['3단계 드릴다운 기본 구조'] },
      { version: 'v2', date: '2026-03-18', type: '기능 개선', title: 'TestRail 스타일 4단계 드릴다운', highlights: ['Company → Product → Feature → TestCase'] },
      { version: 'v3', date: '2026-03-20', type: '기능 개선', title: 'Feature 제거, Segment 추가', highlights: ['3단계로 축소 (Company → Product → TestCase)', 'Segment Adjacency List 도입'] },
      { version: 'v4', date: '2026-03-22', type: '기능 개선', title: 'Segment 트리 뷰 + 경로 입력 UI', highlights: ['SegmentTreeView 컴포넌트', 'CascadingPathInput 드롭다운'] },
      { version: 'v5', date: '2026-03-25', type: '기능 개선', title: 'TestCase 모달 대규모 개선', highlights: ['ConfirmDialog 추가', 'Company/Product UX 개선'] },
      { version: 'v6', date: '2026-03-28', type: '기능 개선', title: 'TestCase 모달 다듬기', highlights: ['Description/Prompt Text 삭제', 'Status 기본값 ACTIVE'] },
      { version: 'v7', date: '2026-04-01', type: '기능 개선', title: 'Segment DnD 계층 변경', highlights: ['드래그 앤 드롭으로 Segment 부모 변경'] },
      { version: 'v8', date: '2026-04-03', type: '버그 수정', title: '순환 참조 검증 수정', highlights: ['BFS 방식 순환 참조 검증 쿼리'] },
      { version: 'v10', date: '2026-04-08', type: '기능 개선', title: 'UX 불편사항 개선', highlights: ['TestRun 선택, 버전 복사 등'] },
      { version: 'v17', date: '2026-04-17', type: '기능 추가', title: 'Release Readiness 통계', highlights: ['Version Phase별 통계', 'Go/No-Go 릴리즈 판단', 'Aging Bug + Blocked TC 리스트'] },
    ],
  },

  qa: {
    slug: 'qa',
    name: 'QA Strategy',
    tagline: '테스트 전략 & 자동화 파이프라인',
    description: [
      'Backend Unit(JUnit 5 + Mockito), Frontend Unit(Vitest), Integration(Testcontainers), E2E(Playwright) 4계층 테스트 피라미드를 구축했다.',
      '모든 PR은 CI에서 자동 테스트를 통과해야 머지되며, JaCoCo 70% 커버리지를 강제한다.',
    ],
    about: {
      why: [
        '코드 변경 시 "기존 기능이 깨지지 않았는가"를 사람이 매번 확인하는 것은 비현실적이다.',
        '4계층 테스트 피라미드를 구축하면 빠른 피드백(Unit)부터 실제 환경 검증(E2E)까지 커버된다.',
        'CI에서 자동 실행되므로 PR 머지 전에 품질이 보장된다.',
      ],
      what: [
        'Backend Unit(JUnit 5 + Mockito): 서비스 로직을 빠르게 검증한다.',
        'Integration(Testcontainers): 실제 PostgreSQL(pgvector) 환경에서 벡터 검색, PDF 파이프라인을 검증한다.',
        'E2E(Playwright): Docker Compose 풀스택 환경에서 API 65 + UI 33 = 98개 시나리오를 검증한다.',
      ],
      benefit: [
        '310개 자동화 테스트로 회귀 버그를 빠르게 발견한다.',
        'Testcontainers로 실제 DB 환경을 테스트하여 "로컬에서는 되는데 서버에서 안 돼요"를 방지한다.',
        '4-Agent Pipeline(코드→Unit→E2E→빌드)으로 구현부터 검증까지 자동화했다.',
      ],
    },
    techStack: ['JUnit 5', 'Mockito', 'Testcontainers', 'Vitest', 'React Testing Library', 'Playwright', 'JaCoCo', 'GitHub Actions'],
    architecture: [
      'Unit Test: 빠른 피드백, 서비스 로직 검증 (H2 인메모리 DB)',
      'Integration Test: Testcontainers(pgvector:pg15)로 실제 DB 환경 검증',
      'Frontend Unit: Vitest + React Testing Library — Hook/컴포넌트 단위 테스트',
      'E2E Test: Playwright — API 65 + UI 33, Docker Compose 풀스택 환경',
      'CI Pipeline: backend-ci(JaCoCo 70%) + frontend-ci(lint 0 warnings) + e2e(전체 실행)',
      '4-Agent Pipeline: 코드 구현(A) → Unit Test(B) → E2E Test(C) → 빌드/검증(D)',
    ],
    apis: [],
    schema: [],
    testing: [
      { label: 'Backend Unit', count: 179, detail: 'JUnit 5 + Mockito (Service + Controller 전 도메인)' },
      { label: 'Frontend Unit', count: 33, detail: 'Vitest + React Testing Library (Hook + 컴포넌트)' },
      { label: 'Integration', count: 18, detail: 'Testcontainers pgvector (Vector Search, PDF Pipeline)' },
      { label: 'E2E', count: 98, detail: 'Playwright (API 65 + UI 33)' },
    ],
    versions: [
      { version: 'v1', date: '2026-03-20', type: '기능 추가', title: '테스트 전략 초기 수립', highlights: ['4계층 테스트 피라미드 설계', '갭 분석 + 4-Phase 로드맵'] },
      { version: 'v2', date: '2026-03-25', type: '테스트 보강', title: 'Backend Unit 1차 확대', highlights: ['Senior Service/Controller 테스트', 'KB Service 테스트'] },
      { version: 'v3', date: '2026-03-28', type: '테스트 보강', title: 'E2E 테스트 프레임워크 구축', highlights: ['Playwright API + UI 테스트 기반', 'api-helpers.ts, features-page.ts'] },
      { version: 'v8', date: '2026-04-10', type: '테스트 보강', title: 'Integration 테스트 확대', highlights: ['Testcontainers pgvector 통합', 'Vector Search, PDF Pipeline 검증'] },
    ],
  },
}
