## 기능 개요
TestCase 입력 페이지에서 "Path" 필드를 개선한다.
기존 자유 문자열 입력 방식 대신, 세그먼트 기반 Cascading Input을 구현하고
두 가지 뷰 모드(입력 뷰 / 목차 뷰)를 지원한다.

---

## 전체 테이블 관계

Company (1)
  └── Product (N)
        ├── Segment (N)     ← Product에 종속
        └── TestCase (M)    ← Product와 N:M
              └── path = Segment ID 배열로 참조

---

## DB 설계

### Segment 테이블
- id
- name
- product_id    ← 반드시 Product에 종속 (다른 Product의 "Main"과 격리)
- parent_id     ← 계층 구조를 위한 자기 참조 (NULL이면 최상위 노드)

### TestCase-Path 관계
- Path는 문자열이 아닌 Segment ID 배열로 저장한다.
- 같은 Product에 속한 Segment ID만 참조할 수 있다.

### 문자열 저장 방식을 사용하지 않는 이유
- Segment 이름 수정 시 연관된 모든 TestCase를 대량 UPDATE해야 함
- depth가 다른 동명 Segment를 구분할 수 없어 정합성 보장 불가
- Segment ID 참조 방식은 Segment 테이블 1행 UPDATE만으로 전파 가능

---

## Path 구조
- Path는 `>` 로 구분되는 계층형 세그먼트로 구성된다.
  예시) Main > Personal Space > Pie List
- 각 세그먼트는 독립적으로 관리되며, 사용자가 자유롭게 추가할 수 있다.
- 자동완성 후보는 현재 선택된 Product의 Segment만 표시된다.

---

## Frontend — 1. 입력 뷰 (Cascading Autocomplete Input)

### 동작 방식
- Path 입력 필드는 세그먼트 단위로 분리된 Combobox들로 구성된다.
  [ Main ▾ ] > [ Personal Space ▾ ] > [ Pie List ▾ ] [+]
- 각 Combobox는 현재 Product에 속한 해당 depth의 Segment를 자동완성 후보로 제공한다.
- 자동완성 목록에 없는 새 값도 자유롭게 타이핑하여 추가할 수 있다. (Creatable Combobox)
- 새 Segment를 입력하면 즉시 Segment 테이블에 저장되고 자동완성 후보에 누적된다.
- [+] 버튼으로 세그먼트 depth를 늘릴 수 있다.
- 각 세그먼트 옆 [x] 버튼으로 해당 depth 이하를 제거할 수 있다.
- 부모 세그먼트가 바뀌면 자식 세그먼트 필드는 초기화된다.

---

## Frontend — 2. 목차 뷰 (Tree View)

### 동작 방식
- 현재 Product에 속한 모든 Segment를 계층형 트리 구조로 시각화한다.
- 각 노드는 펼치기/접기가 가능하다.
- 말단 노드(Leaf)를 클릭하면 해당 Path가 입력 필드에 자동으로 세팅된다.
- 각 노드에 해당 Path를 사용하는 TestCase 수를 뱃지로 표시한다.
  예시)
  📁 Main (12)
    📁 Personal Space (5)
      📄 Pie List (3)
      📄 Project List (2)

---

## 뷰 전환
- 입력 필드 우측 상단에 뷰 전환 토글 버튼을 배치한다.
  [입력 뷰] / [목차 뷰]
- 뷰 상태는 페이지 내에서 유지된다.