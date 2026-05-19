export default function WorkExpTab() {
  return (
    <div>
      {/* QA Experience */}
      <section id="exp-studio-xid" className="mb-16">
        <div className="flex items-center gap-4 mb-10">
          <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">
            QA Experience
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-10 mb-12">
          {/* 회사 정보 */}
          <div className="mb-4 md:mb-0 pt-0.5">
            <div className="text-3xl font-bold tracking-tight">
              Studio XID<span className="text-violet-500">.</span>
            </div>
            <div className="text-base text-gray-600 font-medium">Test Engineer</div>
            <div className="font-mono text-sm text-gray-400">2025.03 — 2026.03</div>
          </div>

          {/* 프로젝트 목록 */}
          <div>
            {/* 타임라인 */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl py-1 mb-3">
              <div className="flex gap-3.5 items-start px-5 py-3.5">
                <span className="font-mono text-xs font-medium text-violet-500 bg-violet-50 px-3 py-1 rounded shrink-0">
                  2025.03 — 2026.03
                </span>
                <span className="text-sm text-gray-600 pt-0.5">ProtoPie Cloud QA</span>
              </div>
            </div>

            {/* User Testing — 다양한 기기 소켓 테스트 */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-xl font-bold mb-4 tracking-tight">User Testing - 다양한 기기 소켓 테스트</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  네트워크 불안정 테스트
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  모바일 백그라운드 복구 테스트
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  소켓 세션 복구 테스트
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  멀티 유저 소켓 안정성 테스트
                </span>
              </div>
              <div className="mt-3">
                <span className="inline-block text-sm font-bold text-violet-800 bg-violet-100 px-4 py-1.5 rounded-lg">
                  다양한 환경, 엣지케이스에서 소켓 세션 복구 검증
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">iOS, Android, Mac OS, Windows, Galaxy Watch Test</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">소켓 테스트</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">socket network debugging</span>
              </div>
            </div>

            {/* AI 응답 검증 자동화 */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-xl font-bold mb-4 tracking-tight">AI 응답 검증 자동화</div>

              <div className="font-mono text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2.5">
                Problem
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  AI 기능 테스으로 600개 이상의 QnA 품질 검증 테스트
                </span>
              </div>

              <div className="font-mono text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-4 mb-2.5">
                Solution
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  질문을 Map 형태로 가공 후, API 요청 후 datastream Response 수집 [3시간 소요]
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  수집된 Response를 Javascript를 이용해 CSV로 저장 후, Claude Prompt 엔지니어링을 통해 자동 채점
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  자동 채점 결과가 만족스럽지 않은 경우, 수동으로 검증 함으로써 품질 개선 [3시간 소요]
                </span>
              </div>

              <div className="mt-3">
                <span className="inline-block text-sm font-bold text-violet-800 bg-violet-100 px-4 py-1.5 rounded-lg">
                  테스트 예상 일정 일주일에서 이틀로 단축
                </span>
              </div>
              <div className="flex gap-2.5 items-start mt-3">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  이후, 3시간씩 걸리던 API 요청 &amp; 응답 수집 작업을 병렬 처리로 1시간 내로 단축 개선
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
              <div className="text-xl font-bold mb-4 tracking-tight">API 스크립트 자동화</div>

              <div className="font-mono text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2.5">
                Problem
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  반복적으로 버튼을 눌러야 하는 작업들에 대해 스크립트로 자동화
                </span>
              </div>

              <div className="font-mono text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-4 mb-2.5">
                Solution
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  대량 테스트 데이터가 필요한 경우 반복적인 API 호출로 자동화
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">JavaScript</span>
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">API 자동화</span>
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">DevTools</span>
              </div>
            </div>

            {/* reCaptcha v2 테스트 */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-xl font-bold mb-4 tracking-tight">reCaptcha v2 테스트</div>

              <div className="font-mono text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2.5">
                Problem
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  Email Abusing → reCaptcha v2 테스트 필요
                </span>
              </div>

              <div className="font-mono text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-4 mb-2.5">
                Solution
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  Playwright로 Email 전송 기능 테스트 후, 응답값에서 reCaptcha v2 점수 확인
                </span>
              </div>

              <div className="mt-3">
                <span className="inline-block text-sm font-bold text-violet-800 bg-violet-100 px-4 py-1.5 rounded-lg">
                  Email Abusing 재발 차단 확인
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">Playwright</span>
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">reCaptcha v2</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">보안 QA</span>
              </div>
            </div>

            {/* Shift-Left QA를 위한 개발-QA Sprint 병렬 운영 체계 */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-xl font-bold mb-4 tracking-tight">Shift-Left QA를 위한 개발-QA Sprint 병렬 운영 체계 설계 및 도입</div>

              <div className="font-mono text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2.5">
                Problem
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  개발 완료 후 QA가 통합 테스트 → 대량 버그 발견 (설계버그 &amp; 개발버그) → 다시 재개발 및 재설계 → 팀 피로도 증가
                </span>
              </div>

              <div className="font-mono text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-4 mb-2.5">
                Solution
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  개발-QA Sprint를 설계하고 6개월간 운영을 주도하여, Shift-Left Testing 실천
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  개발 Sprint 계획 단계에서 공유된 ticket을 기반으로 QA Sprint 계획을 병렬 수립
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  개발 Done 처리된 ticket 단위로 순차 테스트를 진행하여, 개발팀의 다음 Sprint 진행과 QA 테스트를 병렬 수행
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  큰 프로젝트일 경우 여러번 Sprint를 거쳐 자잘하게 테스트 통과 이로 인해 통합 테스트 부담이 분산됨
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-block text-sm font-bold text-violet-800 bg-violet-100 px-4 py-1.5 rounded-lg">
                  통합 테스트 단계에서 발견되는 결함 수가 유의미하게 감소
                </span>
                <span className="inline-block text-sm font-bold text-violet-800 bg-violet-100 px-4 py-1.5 rounded-lg">
                  UserTesting 프로젝트가 일찍 끝나 사내 Open Beta Test를 진행할 수 있었습니다.
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">Jira</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Sprint</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Jira Automation</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">Agile</span>
              </div>
            </div>

            {/* Playwright Test Architecture Design */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-xl font-bold mb-4 tracking-tight">Playwright Test Architecture Design</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  Account, Membership, Role, Plan을 관리하는 테스트 환경 설계
                </span>
              </div>
              <div className="mt-3">
                <span className="inline-block text-sm font-bold text-violet-800 bg-violet-100 px-4 py-1.5 rounded-lg">
                  계정·권한 매트릭스 자동화 환경 구축
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-violet-500 bg-violet-50 px-3 py-1 rounded">Playwright</span>
              </div>
            </div>

            {/* Test Case 설계 */}
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-xl font-bold mb-4 tracking-tight">Test Case 설계</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  경계값 테스트 — 경계 이하·경계·경계 초과 케이스로 파일 용량 제한(1GB) 검증
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  상태 전이 조합 전수 검증
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  권한(역할·플랜·멤버십)에 따른 기능 접근 시나리오 설계
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  ISTQB 및 테스트 방법론 기반 Test Case 설계
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-violet-200">
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">경계값 분석</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">상태 전이 테스트</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">권한 기반 테스트</span>
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">ISTQB</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Side Project */}
      <section id="exp-side-project" className="mb-16">
        <div className="flex items-center gap-4 mb-10">
          <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">
            Side Project
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-10">
          <div className="mb-4 md:mb-0 pt-0.5">
            <div className="text-3xl font-bold tracking-tight">
              my-atlas<span className="text-violet-500">.</span>
            </div>
            <div className="text-base text-gray-600 font-medium">개인 프로젝트</div>
            <div className="font-mono text-sm text-gray-400">2026.02 — 현재</div>
          </div>
          <div>
            <div className="bg-violet-50/50 border border-violet-200 border-t-[3px] border-t-violet-500 rounded-b-xl px-6 py-5">
              <div className="text-xl font-bold mb-1 tracking-tight">
                QA를 위한 통합 서비스
              </div>
              <div className="font-mono text-xs text-gray-400 mb-4">
                <a href="https://youngmi.works" target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:underline">youngmi.works</a>
                {' · '}
                github.com/choomi1217/my-atlas
              </div>

              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  QA 업무 효율화를 위해 직접 설계 및 개발 중인 서비스
                </span>
              </div>

              <div className="font-mono text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-4 mb-2.5">
                제공되는 기능
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  <strong>My Senior</strong> — 사용자가 직접 AI가 참고할 QA 지식을 컨텍스트로 주입, Claude API 답변 생성함으로써 AI의 할루시네이션을 줄인 QA Chat 개발
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  <strong>Knowledge Base</strong> — PDF 업로드 및 사용자가 직접 AI가 참고할 QA 문서를 작성할 수 있는 게시판 개발
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <div className="text-base text-gray-600 leading-relaxed">
                  <strong>Product Test Suites</strong> — TestCase부터 결과 통계까지 이어지는 QA 통합 사이클
                  <ol className="list-none mt-2.5 space-y-1.5">
                    {[
                      'TestCase 작성',
                      '이번 배포 Version 작성',
                      'Test Phase 설정 (1차 통합테스트, 2차 통합테스트, Regression Test 등)',
                      '테스트 수행',
                      '테스트 결과 Jira 연동 (FAIL 시 자동 티켓 생성)',
                      '테스트 결과 통계',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <span className="font-mono text-[11px] font-medium text-violet-500 bg-violet-50 px-2 py-0.5 rounded shrink-0 min-w-[24px] text-center mt-0.5">
                          {i + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  <strong>Test Studio</strong> — Figma, PRD, Notion 문서 제공 → Knowledge Base, Word Convention, Product Test Suites를 참고해 AI가 TestCase 자동 생성
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  <strong>Word Conventions</strong> — 팀 용어 표준화를 위한 용어 백과사전
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  <strong>기타</strong> — 프로젝트 모니터링, PlayWright E2E 테스트
                </span>
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
                <span className="font-mono text-xs text-gray-600 bg-violet-50/80 px-3 py-1 rounded">AWS</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Development Experience */}
      <section id="exp-dev" className="mb-16">
        <div className="flex items-center gap-4 mb-10">
          <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">
            Development Experience
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        {/* NFLUX */}
        <div id="exp-nflux" className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-10 mb-12">
          <div className="mb-4 md:mb-0 pt-0.5">
            <div className="text-3xl font-bold tracking-tight">
              NFLUX<span className="text-violet-500">.</span>
            </div>
            <div className="text-base text-gray-600 font-medium">Java 백엔드 개발자</div>
            <div className="font-mono text-sm text-gray-400">2024.01 — 2024.10</div>
          </div>
          <div>
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-xl font-bold mb-4 tracking-tight">부산교통공사 지하철 관리 시스템</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  JPA 실무 활용 및 DB·인덱스 설계 경험
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  DB 중복 적재 버그를 Scheduler Lock으로 해결
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  JPA N+1 문제 진단 및 QueryDSL 개선 — 성능 이슈 탐지 경험
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  테스트 서버(WAS 1대) vs 운영 서버(WAS 2대) 환경 차이 문제 해결
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  CI/CD, Slack 알림 봇 구축
                </span>
              </div>
              <div className="mt-3">
                <span className="inline-block text-sm font-bold text-violet-800 bg-violet-100 px-4 py-1.5 rounded-lg">
                  JPA 실무 활용 · DB / 인덱스 설계
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
            <div className="text-3xl font-bold tracking-tight">
              도로명주소단<span className="text-violet-500">.</span>
            </div>
            <div className="text-base text-gray-600 font-medium">Java 백엔드 개발자</div>
            <div className="font-mono text-sm text-gray-400">2020.12 — 2023.03</div>
          </div>
          <div>
            <div className="bg-violet-50/50 border border-violet-200 rounded-xl px-5 py-5 mb-3">
              <div className="text-xl font-bold mb-4 tracking-tight">GIS 기반 도로명주소 웹 애플리케이션</div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  Test Code(JUnit + Mockito) 사용 — 테스트 자동화 필요성을 직접 경험하고 주도한 계기
                </span>
              </div>
              <div className="flex gap-2.5 items-start mb-2">
                <div className="w-1 h-1 rounded-full bg-violet-500 mt-2.5 shrink-0" />
                <span className="text-base text-gray-600 leading-relaxed">
                  Apache Solr API, GeoServer, Spring Scheduler 등 다양한 기술 스택 실무 경험
                </span>
              </div>
              <div className="mt-3">
                <span className="inline-block text-sm font-bold text-violet-800 bg-violet-100 px-4 py-1.5 rounded-lg">
                  테스트 자동화 실무 도입
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

      {/* Skills */}
      <section className="mb-16">
        <div className="flex items-center gap-4 mb-10">
          <span className="text-sm font-semibold uppercase tracking-widest text-gray-900">
            Skills
          </span>
          <div className="flex-1 h-px bg-violet-200" />
        </div>

        <div className="bg-violet-50/50 border border-violet-200 rounded-xl overflow-hidden">
          <div className="flex flex-col md:flex-row items-start gap-4 md:gap-8 px-6 py-4 border-b border-violet-200">
            <div className="text-sm font-bold text-violet-500 min-w-[160px] shrink-0 pt-0.5">Test Automation</div>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Playwright</span>
              <span className="text-sm text-gray-600 bg-white border border-violet-200 px-4 py-1.5 rounded-full">Postman</span>
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

      <div className="flex items-center justify-center gap-6 mt-20 pt-10 border-t border-violet-200">
        <a
          href="/resume/조영미_경력기술서.pdf"
          download
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-violet-500 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
        >
          ⬇ PDF 다운로드
        </a>
        <span className="font-mono text-sm text-gray-400">whdudal1217@naver.com</span>
      </div>
    </div>
  )
}
