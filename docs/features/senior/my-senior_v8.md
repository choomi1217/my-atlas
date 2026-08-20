# 요구사항
채팅을 통해 웹 사이트 내의 TestCase에 대한 피드백을 할 수 있어야해

### User Flow
1. 유저가 "Blah Blah~" 기능에 대한 Test Case를 같이 짜보자고 제안 ( 단, 어떤 회사인지, 어떤 프로덕트인지 꼭 선택을 해야함. )
2. AI가 해당 회사의 해당 프로덕트 속 TestCase에 대한 정보가 들어감 ( 없으면 TestCase 스타일을 어떻게 할지 질문. )
3. AI는 TestCase를 짜기 위해 충분한 정보가 다 모이면 TestCase 제작에 들어감 ( TestCase를 짜기 위한 충분한 정보 목록 필요. )
2. 유저가 해당 TestCase를 확인하고 Confirm 버튼 클릭
2. 유저가 Header > Product Test Suite > Company > Product > TestCases 에서 TC를 확인 할 수 있음

### 주의사항
1. AI가 제안한 제안에 대해 유저가 Confirm을 하기 전까진 반영 할 수 없어.
2. AI는 TestCase를 짜기 위한 충분한 정보가 모이기 전까진 TestCase를 제안하지 않아.

### 사전 개발사항
1. 유저가 TestCase 스타일을 선택할 수 있는 페이지가 필요해 ( 한 3개 정도의 TC 스타일을 같이 정해보자. )
2. 유저가 선택한 회사 > 프로덕트에 description이라는 컬럼이 있으니 이것도 AI Context로 주입 되어야해

