# my-atlas

Personal QA web application for accumulating QA know-how, terminology conventions,
company feature information, and AI-assisted ticket reviewing.

## Tech Stack

| Layer       | Technology                              |
|-------------|-----------------------------------------|
| Frontend    | React 18 + Vite + TypeScript + Tailwind |
| Backend     | Spring Boot 3.x (Java 21) + Spring AI   |
| Database    | PostgreSQL 15 + pgvector                |
| Dev Infra   | Docker Compose                          |

## Project Structure

```
my-atlas/
├── frontend/   React + Vite app
├── backend/    Spring Boot app
└── docker-compose.yml
```

## Getting Started

### Prerequisites
- Java 21
- Node.js 20+
- Docker + Docker Compose

### 1. Set up environment variables

```bash
cp .env.example .env
# Edit .env and fill in your actual values
```

### 2. Start infrastructure (DB)

```bash
docker-compose up -d db
```

### 3. Start backend

```bash
cd backend
./gradlew bootRun
```

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Start everything via Docker Compose

```bash
docker-compose up --build
```

## Features (Planned)

- **My Senior** (`/`) — AI chatbot for QA guidance
- **Knowledge Base** (`/kb`) — Accumulated QA know-how
- **Word Conventions** (`/conventions`) — Terminology standards
- **Company Features** (`/features`) — Product feature registry
- **Ticket Reviewer** (`/ticket`) — AI-assisted ticket review
