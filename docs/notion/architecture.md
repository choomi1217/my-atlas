# My QA Web 

## 프로젝트 개요
어떤 회사를 가서도 사용할 수 있는 나만의 QA 웹.
회사가 바뀌어도 나의 QA 노하우, 용어 컨벤션, 회사 기능 정보를 
누적·관리하고 AI가 이를 참조해 업무를 보조해준다.

## 핵심 기능 목록
1. **My Senior          - AI 기반 QA 시니어 챗봇 (최우선)**
2. Knowledge Base       - 지식 저장소
3. Words Conventions    - 팀 용어 컨벤션 DB
4. **Product Test Suite   - Test Case (최우선)**

## 기술 스택
- Frontend: React 18 + Vite + TypeScript
- Backend: Spring Boot 3.x (Java 21) + Spring AI
- DB: PostgreSQL 15 + pgvector 확장
- 인프라: Docker Compose (로컬 개발), AWS (추후 배포)
- 빌드: Gradle

## 요구 사항
my-atlas/
├── docs
	├── features
		├── feature-registry    # Product Test Suite
		├── my-senior           # My Senior
		├── knowlege-base       # Knowledge Base
		├── word-conventions    # Words Conventions

### 디렉토리 구조 (모노레포)
my-atlas/
├── frontend/        # React + Vite
├── backend/         # Spring Boot
├── docker-compose.yml
└── README.md

### docker-compose.yml
- postgres:15 이미지 사용
- pgvector 익스텐션 자동 활성화 (init.sql 포함)
- 포트: PostgreSQL 5432, Backend 8080, Frontend 5173

### Backend 초기 세팅
- Spring Boot 3.x, Java 21, Gradle
- 의존성: Spring Web, Spring Data JPA, Spring AI (anthropic),
  PostgreSQL Driver, Flyway, Lombok
- application.yml: 환경변수로 DB, Claude API Key 분리
  (SPRING_DATASOURCE_URL, ANTHROPIC_API_KEY)
- 패키지 구조: com.myqaweb
  ├── senior/          # My Senior 챗봇
  ├── knowledgebase/   # Knowledge Base
  ├── convention/      # Words Conventions
  ├── feature/         # Company Features
  └── common/

### Frontend 초기 세팅
- React 18 + Vite + TypeScript
- 의존성: react-router-dom, axios, tailwindcss
- 페이지 라우팅 기본 구조만 잡기
  /senior        → My Senior (Chat)
  /kb            → Knowledge Base
  /conventions   → Words Conventions
  /features      → Product Test Suite