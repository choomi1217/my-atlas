export default function WorkExpTab() {
  return (
    <div>
      {/* QA Experience */}
      <section id="exp-studio-xid" className="mb-14">
        <div className="flex items-center gap-3.5 mb-8">
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-gray-900">
            QA Experience
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-10 mb-12">
          {/* 회사 정보 */}
          <div className="mb-4 md:mb-0 pt-0.5">
            <div className="text-2xl font-bold tracking-tight">
              Studio XID<span className="text-violet-500">.</span>
            </div>
            <div className="text-base text-gray-600 font-medium">Test Engineer</div>
            <div className="font-mono text-sm text-gray-400">2025.03 — 2026.03</div>
          </div>

          {/* 프로젝트 목록 */}
          <div>
            {/* 타임라인 */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl py-1 mb-3">
              <div className="flex gap-3.5 items-start px-5 py-3.5 border-b border-violet-200">
                <span className="font-mono text-xs font-medium text-violet-500 bg-violet-50 px-3 py-1 rounded shrink-0">
                  2025.03 — 2025.10
                </span>
                <span className="text-sm text-gray-600 pt-0.5">ProtoPie Cloud QA</span>
              </div>
              <div className="flex gap-3.5 items-start px-5 py-3.5">
                <span className="font-mono text-xs font-medium text-violet-500 bg-violet-50 px-3 py-1 rounded shrink-0">
                  2025.11 — 2026.03
                </span>
                <span className="text-sm text-gray-600 pt-0.5">User Testing QA</span>
              </div>
            </div>

            {/* User Testing — 소켓 안정성 검증 */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-lg font-bold mb-4 tracking-tight">User Testing — 소켓 안정성 검증</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  Moderator / Participant / Observer / Mobile(Android·iOS) / Windows 등 8명 동시 참가 시나리오에서 소켓 연결 안정성 테스트
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  Chrome DevTools Throttling, 실제 네트워크 차단, 모바일 앱 백그라운드 전환으로 네트워크 불안정 환경 테스트
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  iOS / Android 백그라운드 전환 후 재접속 정상 여부, Participant 이탈 후 10분 세션 유지 및 자동 종료, 10분 내 재접속 시 세션 복구 테스트
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">WebSocket Test</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Android · iOS</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">네트워크 불안정</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">세션 관리</span>
              </div>
            </div>

            {/* AI 응답 검증 자동화 */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-lg font-bold mb-4 tracking-tight">AI 응답 검증 자동화</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  Studio AI 채팅 기능 출시 전, 600개 이상의 질의에 대한 응답 품질 전수 테스트
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  엑셀 내용을 스크립트로 자동으로 응답 수집
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  수집한 응답을 <strong>질문 | AI 응답 | 기대 응답 | Claude 판단 점수</strong> 형식의 CSV로 가공, Claude에 채점 기준을 Prompt로 정의하여 응답 품질 자동 평가
                </span>
              </div>
              <div className="mt-3">
                <span className="inline-block text-xs font-medium text-violet-800 bg-violet-100 px-3 py-1 rounded">
                  예상 테스트 완료 일주일 → 하루로 단축
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">JavaScript</span>
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">Prompt Engineering</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">CSV</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Claude.ai</span>
              </div>
            </div>

            {/* API 스크립트 자동화 */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-lg font-bold mb-4 tracking-tight">API 스크립트 자동화</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  네트워크 요청·JSON 응답 구조 분석, 팀의 반복 작업을 API 스크립트로 해결
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  페이지네이션 등 대량 데이터 필요 시 API 반복 호출로 테스트 데이터 자동 생성
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  다수 유저 팀 이동 등 운영팀이 수동 처리 불가한 작업을 스크립트로 대체 처리
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">JavaScript</span>
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">API 자동화</span>
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">DevTools</span>
              </div>
            </div>

            {/* reCAPTCHA v2 QA */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-lg font-bold mb-4 tracking-tight">reCAPTCHA v2 QA</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  Email Abusing 대응 reCAPTCHA v2 도입, 자동화 도구로 CAPTCHA 테스트
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">Playwright</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">보안 QA</span>
              </div>
            </div>

            {/* Test Case 설계 */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-lg font-bold mb-4 tracking-tight">Test Case 설계</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  경계값 테스트 — 경계 이하·경계·경계 초과 케이스로 파일 용량 제한(1GB) 검증
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  상태 전이 조합 전수 검증
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  권한(역할·플랜·멤버십)에 따른 기능 접근 시나리오 설계
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">경계값 분석</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">상태 전이 테스트</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">권한 기반 테스트</span>
              </div>
            </div>

            {/* QA Sprint 설계 및 운영 */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-lg font-bold mb-4 tracking-tight">QA Sprint 설계 및 운영</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  개발팀 Sprint 주기에 맞춰 QA팀 Sprint 보드 설계 및 운영
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  테스트 일정, 워크플로우, Jira Automation 구성
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">Jira</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Sprint Board</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Jira Automation</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">TestRail</span>
              </div>
            </div>

            {/* Playwright Test Architecture Design */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-lg font-bold mb-4 tracking-tight">Playwright Test Architecture Design</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  Account, Membership, Role, Plan을 관리하는 테스트 환경 설계
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">Playwright</span>
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">JSON Manifest</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">GitHub Actions</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">AWS</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Development Experience */}
      <section id="exp-dev" className="mb-14">
        <div className="flex items-center gap-3.5 mb-8">
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-gray-900">
            Development Experience
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        {/* NFLUX */}
        <div id="exp-nflux" className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-10 mb-12">
          <div className="mb-4 md:mb-0 pt-0.5">
            <div className="text-2xl font-bold tracking-tight">
              NFLUX<span className="text-violet-500">.</span>
            </div>
            <div className="text-base text-gray-600 font-medium">Java 백엔드 개발자</div>
            <div className="font-mono text-sm text-gray-400">2024.01 — 2024.10</div>
          </div>
          <div>
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-lg font-bold mb-4 tracking-tight">부산교통공사 지하철 관리 시스템</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  DB 중복 적재 버그를 Scheduler Lock으로 해결
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  JPA N+1 문제 진단 및 QueryDSL 개선 — 성능 이슈 탐지 경험
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  테스트 서버(WAS 1대) vs 운영 서버(WAS 2대) 환경 차이 문제 해결
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  CI/CD, Slack 알림 봇 구축
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Java</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Spring Boot</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">PostgreSQL</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Kafka</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">ElasticSearch</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Docker</span>
              </div>
            </div>
          </div>
        </div>

        {/* 도로명주소단 */}
        <div id="exp-doromyeong" className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-10">
          <div className="mb-4 md:mb-0 pt-0.5">
            <div className="text-2xl font-bold tracking-tight">
              도로명주소단<span className="text-violet-500">.</span>
            </div>
            <div className="text-base text-gray-600 font-medium">Java 백엔드 개발자</div>
            <div className="font-mono text-sm text-gray-400">2020.12 — 2023.03</div>
          </div>
          <div>
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-lg font-bold mb-4 tracking-tight">GIS 기반 도로명주소 웹 애플리케이션</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  Test Code(JUnit + Mockito) 사용 — 테스트 자동화 필요성을 직접 경험하고 주도한 계기
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  Apache Solr API, GeoServer, Spring Scheduler 등 다양한 기술 스택 실무 경험
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  지도 이미지 재생성 백오피스 — 알고리즘 설계부터 구현까지 단독 수행
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Java</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Spring Framework</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">PostgreSQL</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Oracle</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Apache Solr</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">GeoServer</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Side Project */}
      <section id="exp-side-project" className="mb-14">
        <div className="flex items-center gap-3.5 mb-8">
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-gray-900">
            Side Project
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-10">
          <div className="mb-4 md:mb-0 pt-0.5">
            <div className="text-2xl font-bold tracking-tight">
              my-atlas<span className="text-violet-500">.</span>
            </div>
            <div className="text-base text-gray-600 font-medium">개인 프로젝트</div>
            <div className="font-mono text-sm text-gray-400">2026.02 — 현재</div>
          </div>
          <div>
            <div className="bg-violet-50/50 border border-violet-200 border-t-[3px] border-t-violet-500 rounded-b-xl px-6 py-5">
              <div className="text-base font-bold mb-1 tracking-tight">
                QA 지식 관리 &amp; AI 테스트 자동화 웹 애플리케이션
              </div>
              <div className="font-mono text-xs text-gray-400 mb-4">github.com/choomi1217/my-atlas</div>

              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  QA 업무 효율화를 위해 직접 설계·개발 중인 풀스택 웹 서비스.
                  Spring Boot + React + PostgreSQL(pgvector) 기반
                </span>
              </div>

              <div className="font-mono text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-4 mb-2.5">
                구현 완료 기능
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  <strong>My Senior (AI QA 챗봇)</strong> — 사용자 질문을 임베딩하여 pgvector 코사인 유사도 검색으로 관련 QA 지식을 컨텍스트로 주입, Claude API로 SSE 스트리밍 답변 생성. RAG 파이프라인 완성
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  <strong>Company Feature (TC 관리)</strong> — Company → Product → TestCase 3단계 드릴다운, Segment 기반 계층형 경로 관리, AI가 Feature 설명 기반으로 테스트 케이스 초안 자동 생성
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-[15px] text-gray-600 leading-relaxed">
                  <strong>Knowledge Base (진행 중)</strong> — PDF 도서 업로드 시 자동 청킹·임베딩 파이프라인 구현, @Async self-invocation 버그 직접 분석·해결, Rate Limit 대응 retry 로직 추가
                </span>
              </div>

              <div className="font-mono text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-4 mb-2.5">
                테스트 커버리지
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="font-mono text-xs font-medium text-violet-800 bg-violet-100 px-2.5 py-1 rounded">Backend Unit 161개 통과</span>
                <span className="font-mono text-xs font-medium text-violet-800 bg-violet-100 px-2.5 py-1 rounded">Frontend Unit 33개 통과</span>
                <span className="font-mono text-xs font-medium text-violet-800 bg-violet-100 px-2.5 py-1 rounded">E2E Playwright 60개 통과</span>
                <span className="font-mono text-xs font-medium text-violet-800 bg-violet-100 px-2.5 py-1 rounded">Testcontainers pgvector Integration Test</span>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">Spring Boot 3</span>
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">Java 21</span>
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">Spring AI</span>
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">React + TypeScript</span>
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">pgvector</span>
                <span className="font-mono text-xs text-violet-800 bg-violet-100 px-3 py-1 rounded">Playwright</span>
                <span className="font-mono text-xs text-violet-800 bg-violet-100 px-3 py-1 rounded">Testcontainers</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Docker Compose</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Claude API</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Skills */}
      <section className="mb-14">
        <div className="flex items-center gap-3.5 mb-8">
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-gray-900">
            Skills
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-xl overflow-hidden">
          <div className="flex flex-col md:flex-row items-start gap-4 md:gap-8 px-6 py-4 border-b border-violet-200">
            <div className="text-sm font-bold text-violet-500 min-w-[160px] shrink-0 pt-0.5">Test Automation</div>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Playwright</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Testcontainers</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">JUnit</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Mockito</span>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-start gap-4 md:gap-8 px-6 py-4 border-b border-violet-200">
            <div className="text-sm font-bold text-violet-500 min-w-[160px] shrink-0 pt-0.5">AI / Tools</div>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Jira</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">TestRail</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Claude.ai</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Prompt Engineering</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">RAG</span>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-start gap-4 md:gap-8 px-6 py-4 border-b border-violet-200">
            <div className="text-sm font-bold text-violet-500 min-w-[160px] shrink-0 pt-0.5">Languages</div>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Java</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">SQL / SQLD</span>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-start gap-4 md:gap-8 px-6 py-4 border-b border-violet-200">
            <div className="text-sm font-bold text-violet-500 min-w-[160px] shrink-0 pt-0.5">Frameworks</div>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Spring Boot</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Spring AI</span>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-start gap-4 md:gap-8 px-6 py-4">
            <div className="text-sm font-bold text-violet-500 min-w-[160px] shrink-0 pt-0.5">Infrastructure</div>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">AWS</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Docker</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Jenkins</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">GitHub Actions</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">PostgreSQL</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Oracle</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Terraform</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Linux</span>
            </div>
          </div>
        </div>
      </section>

      <div className="text-center font-mono text-xs text-gray-400 mt-16 pt-8 border-t border-violet-200">
        choomi1217@gmail.com
      </div>
    </div>
  )
}
