# Platform — Feature 상세 페이지 스크린샷 + Notion MCP (v7)

> 변경 유형: 기능 개선  
> 작성일: 2026-04-17  
> 버전: v7  
> 상태: 진행 중

---

## 요구사항

### [FEAT-3] Feature 상세 페이지에 운영서버 스크린샷 삽입
v6에서 About(왜/무엇/QA이점) 섹션을 추가했으나, 이미지가 없어 시각적 임팩트가 부족하다.
운영서버(youngmi.works)에서 각 기능의 실제 UI를 캡처하여 상세 페이지에 삽입한다.

### [FEAT-2] Notion MCP 연결 (v6에서 이월)
Resume과 자기소개서 내용을 Notion에 옮겨 적어야 한다.

---

## 설계

### FEAT-3: 스크린샷 캡처 및 삽입

**캡처 대상:**

| Feature | URL | 캡처 포인트 |
|---------|-----|------------|
| My Senior | youngmi.works/senior | FAQ 카드뷰 + Chat SSE 스트리밍 화면 |
| Knowledge Base | youngmi.works/kb | KB 목록 + Markdown 에디터 |
| Word Conventions | youngmi.works/conventions | 용어 카드 그리드 + 이미지 첨부 |
| Product Test Suite | youngmi.works/features | Company → Product → TestCase 드릴다운 |
| QA Strategy | — | 테스트 파이프라인 다이어그램 (직접 제작 또는 CI 결과 캡처) |

**저장 위치:** `frontend/public/screenshots/{slug}.png`

**삽입 위치:** FeatureDetailPage의 About 섹션 하단 (`feature.about.screenshot` 필드)

**구현:**
1. Playwright 스크립트로 youngmi.works 각 페이지 스크린샷 캡처
2. `frontend/public/screenshots/`에 저장
3. `featureDetails.ts`의 각 feature에 `screenshot: '/screenshots/{slug}.png'` 추가
4. FeatureDetailPage에서 이미지 렌더링 (이미 구현됨, 데이터만 추가하면 됨)

### FEAT-2: Notion MCP

Claude 세션에서 Notion MCP 도구를 사용하여:
1. Resume 컴포넌트 텍스트 추출
2. 자기소개서 컴포넌트 텍스트 추출
3. Notion 페이지 생성/업데이트

---

## 구현 순서

| Step | 작업 | 파일 |
|------|------|------|
| 1 | Playwright로 youngmi.works 스크린샷 캡처 | `frontend/public/screenshots/*.png` |
| 2 | featureDetails.ts에 screenshot 경로 추가 | `frontend/src/data/featureDetails.ts` |
| 3 | Notion MCP 동기화 | — (코드 변경 없음) |

---

### Step 1 — 스크린샷 캡처

- [ ] youngmi.works 배포 확인
- [ ] Playwright 스크립트로 5개 페이지 캡처
- [ ] `frontend/public/screenshots/`에 저장

### Step 2 — 데이터 연결

- [ ] featureDetails.ts 각 feature에 `screenshot` 경로 추가
- [ ] Docker 빌드 + 확인

### Step 3 — Notion MCP 동기화

- [ ] Notion MCP API 개요 확인
- [ ] Resume/자기소개서 Notion 페이지 생성

---

## [최종 요약]

(모든 Step 완료 후 작성)
