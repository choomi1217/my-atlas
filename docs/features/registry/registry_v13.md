# Path Hierarchy 개념 (가장 중요)
Test Case가 실제 제품의 어느 UI, 어느 위치에 해당하는지를 트리 구조로 표현합니다.
예시:
LNB > A 버튼 > A 페이지 > TC1. 기능 검증
└─────── Path (계층) ──────┘ └── Test Case ──┘

LNB, A 버튼, A 페이지는 Path Node (위치 정보)
TC1. 기능 검증은 실제 Test Case (실행 단위)


# 🖼️ 현재 UI 구조
Layout

2-column: 좌측 Path Tree / 우측 Test Case List
좌측: 카운트 배지가 붙은 트리 형태 (기본 모든 노드 펼침 상태)
우측: Test Case 카드 리스트 (제목 + 태그 + Edit/Delete 버튼)

Test Case 카드 구성 요소

제목 (예: Company → Product → TestCase 전체 흐름)
Priority 태그: HIGH / MEDIUM / LOW
Type 태그: E2E / FUNCTIONAL / UNIT 등
Status 태그: DRAFT / READY / DEPRECATED
액션 버튼: Edit / Delete


# ⚠️ 현재 문제점

1. 현재 위치(Breadcrumb) 부재
    - 좌측 트리에서 특정 Path를 클릭해도, 우측에 "지금 어느 Path를 보고 있는지" 표시가 없습니다.
    - Path hierarchy가 핵심 컨셉인데 정작 우측에서 사라집니다.
2. 좌측 트리의 정보 과부하
    - 모든 노드가 펼쳐져 있고 카운트 배지가 모든 레벨에 붙어 있어 시선이 분산됩니다.
3. Test Case 카드의 위계 부족
    - 제목과 태그(3개)가 모두 비슷한 무게감이라 "어떤 TC가 중요한지" 스캔이 어렵습니다.
    - 특히 HIGH/MEDIUM 같은 Priority가 시각적으로 강조되지 않습니다.
4. 과도한 우측 여백
    - Edit/Delete 버튼이 화면 끝에 붙어 있어 제목과의 거리가 너무 멉니다 (1440px+ 모니터 기준).
5. Add Test Case 버튼의 모호함
    - Path를 눌러야만 추가할 수 있습니다.
    - 기존의 컨셉을 위해 우측 클릭 혹은 Path hierarchy에 버튼을 표시해주세요.

