> 변경 유형: 환경 개선  
> 작성일: 2026-04-16  
> 버전: v17  
> 상태: 완료

---

# 커스텀 도메인 + HTTPS 프로덕션 배포

## 1. 배경

포트폴리오 제출 마감(2026-04-19)에 맞춰, 커스텀 도메인과 HTTPS를 적용하여 프로덕션 배포를 완성한다.

### 현재 상태

| 항목 | 현재 | 목표 |
|------|------|------|
| 프론트엔드 | `d1tr7ozyf0jrsl.cloudfront.net` (HTTPS) | `https://youngmi.works` |
| 백엔드 API | `http://3.34.154.147:8080` (HTTP, IP 직접 노출) | `https://api.youngmi.works` |
| SSL 인증서 | CloudFront 기본만 | ACM 와일드카드 (`*.youngmi.works`) |
| 도메인 | 없음 | `youngmi.works` (Route 53) |

### 이전 작업 (70% 완료, 2026-04-02 기준)

ALB + HTTPS 설정이 Step 7까지 완료된 상태. 도메인 미구매가 유일한 차단 요소였다.

| 리소스 | 상태 | 상세 |
|--------|------|------|
| ALB | Active | `my-atlas-alb` (DNS: `my-atlas-alb-296897507.ap-northeast-2.elb.amazonaws.com`) |
| Target Group | Healthy | `my-atlas-backend` (EC2:8080 등록됨) |
| Route 53 Zone | 생성됨 | `Z0216169199GCYL1ETQ3X` (myatlas.io용 — 삭제 예정) |
| ACM 인증서 | PENDING | `58585e27-...` (myatlas.io용 — 새로 발급 필요) |
| Subnet 2개 | 구성됨 | 2a + 2b (ALB 필수) |
| Security Group | 구성됨 | EC2:8080 → ALB SG만 허용 |

---

## 2. Target Architecture

```
[사용자 브라우저]
  │
  ├─ https://youngmi.works
  │     → Route 53 (A Alias)
  │     → CloudFront (EVMWQ4ZH85AXV)
  │     → S3 (my-atlas-frontend)
  │
  └─ https://api.youngmi.works
        → Route 53 (A Alias)
        → ALB (my-atlas-alb, HTTPS:443)
        → EC2:8080 (Spring Boot Docker)
              └── PostgreSQL (Docker, 내부 5432)
```

**Two-Domain 방식 선택 이유:**
- SSE 스트리밍(시니어 채팅)이 CloudFront 경유 시 버퍼링 이슈 가능
- ALB는 SSE를 네이티브 지원 (idle timeout 60초)
- CORS 분리가 명확하고 디버깅 용이

---

## 3. 구현 계획

### Phase 0: Route 53 도메인 구매 (User 직접)

#### AWS Console 구매 절차

1. AWS Console → **Route 53** → **Registered domains** → **Register domains**
2. `youngmi.works` 검색 → **Select** → **Proceed to checkout**
3. 연락처 입력:
   - Contact type: Person
   - First/Last Name: Youngmi / Cho
   - Email: (본인 이메일)
   - Phone: +82.10XXXXXXXX
   - Country: KR, 주소 입력
4. **Privacy protection**: Enable
5. **Auto-renew**: Enable
6. 결제 (~$12/년) → **이메일 인증 클릭 필수**

> Route 53 도메인 등록은 us-east-1 전용. 콘솔이 자동 처리하므로 리전 변경 불필요.
> 등록 완료(~15분) 시 **새 Hosted Zone 자동 생성**됨.

#### 만약 Route 53에서 구매 불가 시 (Free Tier 제한)

1. Namecheap 등에서 `youngmi.works` 구매
2. Route 53 → Create hosted zone: `youngmi.works`
3. 생성된 NS 레코드 4개를 Namecheap DNS에 입력
4. 이후 단계는 동일

#### 기존 리소스 정리

- Hosted Zone `Z0216169199GCYL1ETQ3X` (myatlas.io용) → 삭제
- ACM 인증서 `58585e27-...` (myatlas.io용) → 삭제

---

### Phase 1: ACM 인증서 발급

**2개 리전에 각각 필요:**
- `us-east-1` — CloudFront용 (CloudFront는 us-east-1 인증서만 허용)
- `ap-northeast-2` — ALB용

#### Step 1-1: us-east-1 인증서

```bash
aws acm request-certificate \
  --domain-name youngmi.works \
  --subject-alternative-names "*.youngmi.works" \
  --validation-method DNS \
  --region us-east-1
```

#### Step 1-2: ap-northeast-2 인증서

```bash
aws acm request-certificate \
  --domain-name youngmi.works \
  --subject-alternative-names "*.youngmi.works" \
  --validation-method DNS \
  --region ap-northeast-2
```

#### Step 1-3: DNS 검증

ACM 콘솔 → **"Create records in Route 53"** 클릭.
와일드카드 포함이므로 CNAME 1개로 양쪽 인증서 모두 검증됨.

**대기**: 5~30분 후 상태 `ISSUED` 확인.

```bash
aws acm describe-certificate \
  --certificate-arn <CERT_ARN> \
  --region us-east-1 \
  --query 'Certificate.Status'
```

---

### Phase 2: ALB HTTPS 리스너 추가

기존 ALB `my-atlas-alb`에 HTTPS 리스너를 추가한다.

#### Step 2-1: 현재 상태 확인

```bash
# 리스너 확인
aws elbv2 describe-listeners \
  --load-balancer-arn $(aws elbv2 describe-load-balancers --names my-atlas-alb \
    --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Target Group 헬스 확인
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups --names my-atlas-backend \
    --query 'TargetGroups[0].TargetGroupArn' --output text)
```

#### Step 2-2: HTTPS:443 리스너 생성

```bash
ALB_ARN=$(aws elbv2 describe-load-balancers --names my-atlas-alb \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)
TG_ARN=$(aws elbv2 describe-target-groups --names my-atlas-backend \
  --query 'TargetGroups[0].TargetGroupArn' --output text)
CERT_ARN=<ap-northeast-2 인증서 ARN>

aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN \
  --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06
```

#### Step 2-3: HTTP:80 → HTTPS 리다이렉트

```bash
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions 'Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'
```

#### Step 2-4: ALB 보안 그룹에 443 허용

```bash
ALB_SG=$(aws elbv2 describe-load-balancers --names my-atlas-alb \
  --query 'LoadBalancers[0].SecurityGroups[0]' --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
```

---

### Phase 3: DNS 레코드 설정

#### Step 3-1: `api.youngmi.works` → ALB

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id <NEW_HOSTED_ZONE_ID> \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.youngmi.works",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "ZWKZPGTI48KDX",
          "DNSName": "my-atlas-alb-296897507.ap-northeast-2.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

> `ZWKZPGTI48KDX`는 ap-northeast-2 ALB 고정 Hosted Zone ID.

#### Step 3-2: `youngmi.works` → CloudFront

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id <NEW_HOSTED_ZONE_ID> \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "youngmi.works",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d1tr7ozyf0jrsl.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

> `Z2FDTNDATAQYW2`는 CloudFront 전역 고정 Hosted Zone ID.

---

### Phase 4: CloudFront 커스텀 도메인 연결

AWS Console → CloudFront → `EVMWQ4ZH85AXV` → Edit:

1. **Alternate domain name (CNAME)**: `youngmi.works` 추가
2. **Custom SSL certificate**: us-east-1 ACM 인증서 선택
3. **SSL support method**: SNI (무료)
4. **Minimum protocol version**: TLSv1.2_2021
5. **Save changes**

> 배포 업데이트에 5~15분 소요.

---

### Phase 5: 코드 변경

#### 5-1. `frontend/src/api/client.ts` (line 4)

```typescript
// Before
const API_BASE_URL = '';

// After
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
```

로컬: 빈 문자열 → Vite proxy 사용 (기존과 동일).
프로덕션: `VITE_API_BASE_URL=https://api.youngmi.works` 주입.

#### 5-2. `frontend/src/api/senior.ts` (line 6)

```typescript
// Before
const API_BASE_URL = '';

// After
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
```

#### 5-3. `frontend/.env.production`

```bash
# Before
VITE_API_BASE_URL=http://3.34.154.147:8080

# After
VITE_API_BASE_URL=https://api.youngmi.works
```

#### 5-4. `backend/src/main/resources/application.yml` (line 71)

```yaml
# Before
allowed-origin-patterns: ${CORS_ALLOWED_ORIGIN_PATTERNS:http://localhost:*,http://127.0.0.1:*,https://*.cloudfront.net}

# After
allowed-origin-patterns: ${CORS_ALLOWED_ORIGIN_PATTERNS:http://localhost:*,http://127.0.0.1:*,https://*.cloudfront.net,https://youngmi.works}
```

#### 5-5. GitHub Secret 업데이트 (User 직접)

| Secret | 현재 값 | 변경 값 |
|--------|---------|---------|
| `BACKEND_API_URL` | `http://3.34.154.147:8080` (추정) | `https://api.youngmi.works` |

GitHub → Repository → Settings → Secrets and variables → Actions에서 변경.

---

### Phase 6: 배포 + 검증

#### 6-1: 배포 경로

코드 변경 커밋 → feature/ops-env → develop PR → main PR → CI/CD 자동 배포

#### 6-2: 검증 체크리스트

```bash
# 1. DNS 해석
dig youngmi.works
dig api.youngmi.works

# 2. HTTPS 인증서 확인
curl -vI https://youngmi.works 2>&1 | grep "SSL certificate"
curl -vI https://api.youngmi.works 2>&1 | grep "SSL certificate"

# 3. 백엔드 헬스체크 (ALB 경유)
curl https://api.youngmi.works/actuator/health

# 4. 프론트엔드 로드
curl -s https://youngmi.works | head -20

# 5. CORS 프리플라이트
curl -X OPTIONS https://api.youngmi.works/api/kb \
  -H "Origin: https://youngmi.works" \
  -H "Access-Control-Request-Method: GET" -v

# 6. 브라우저 테스트
# - https://youngmi.works 접속
# - 로그인
# - My Senior 채팅 (SSE 스트리밍 동작 확인)
# - Knowledge Base CRUD
# - Feature Registry 드릴다운
```

---

## 4. 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `frontend/src/api/client.ts:4` | `''` → `import.meta.env.VITE_API_BASE_URL \|\| ''` |
| `frontend/src/api/senior.ts:6` | `''` → `import.meta.env.VITE_API_BASE_URL \|\| ''` |
| `frontend/.env.production` | `http://3.34.154.147:8080` → `https://api.youngmi.works` |
| `backend/src/main/resources/application.yml:71` | CORS에 `https://youngmi.works` 추가 |
| `docs/ops/aws-deployment-architecture.md` | DEPRECATED 표시 |
| `docs/ops/deployment-strategy-analysis.md` | DEPRECATED 표시 |

## 5. AWS 작업 요약 (User 직접)

| 작업 | 도구 | 소요 |
|------|------|------|
| 도메인 구매 `youngmi.works` | Route 53 콘솔 | 10분 + 15분 대기 |
| ACM 인증서 2개 발급 | ACM 콘솔 / CLI | 15분 + 30분 대기 |
| ALB HTTPS:443 리스너 | AWS CLI / 콘솔 | 10분 |
| Route 53 DNS A 레코드 2개 | AWS CLI / 콘솔 | 5분 |
| CloudFront CNAME + 인증서 | CloudFront 콘솔 | 10분 |
| GitHub Secret 업데이트 | GitHub Settings | 2분 |
| 기존 리소스 정리 | Route 53 / ACM 콘솔 | 5분 |

## 6. 리스크 & 주의사항

1. **`.dev` TLD는 HSTS 강제** — 인증서 `ISSUED` 확인 후에만 DNS 연결. 인증서 없이 브라우저 접속 불가
2. **SSE 스트리밍** — ALB는 SSE 네이티브 지원. idle timeout 60초 (기본값, 충분)
3. **기존 myatlas.io 리소스** — Hosted Zone + ACM 인증서 삭제하여 혼선 방지
4. **비용 추가**: ALB ~$16/월 (이미 생성됨), 도메인 ~$12/년
5. **프론트엔드 코드 핵심 이슈**: `client.ts`와 `senior.ts`에서 `API_BASE_URL = ''` 하드코딩 → 환경변수 무시됨. 반드시 수정 필요

## 7. 타임라인

| 시점 | 작업 | 소요 |
|------|------|------|
| 목(04-16) | Phase 0~1: 도메인 구매 + 인증서 | 30분 (대기 포함) |
| 목(04-16) | Phase 2~4: ALB + DNS + CloudFront | 30분 |
| 목(04-16) | Phase 5: 코드 변경 | 15분 |
| 목(04-16) | Phase 6: 배포 + 검증 | 20분 |
| 금~토 | 버퍼 (문제 발생 시 디버깅) | — |
| 일(04-19) | 포트폴리오 제출 | 완료 |

---

## Steps

- [x] Phase 0: Route 53 도메인 구매 (`youngmi.works`)
- [x] Phase 1: ACM 인증서 발급 (us-east-1 + ap-northeast-2)
- [x] Phase 2: ALB HTTPS 리스너 추가
- [x] Phase 3: Route 53 DNS 레코드 설정
- [x] Phase 4: CloudFront 커스텀 도메인 연결
- [x] Phase 5: 코드 변경 (4개 파일)
- [x] Phase 6: 배포 + 검증
- [x] 문서 업데이트 (ops.md 버전 히스토리, ops-issues.md)

---

## [최종 요약]

`youngmi.works` 도메인을 Route 53에서 구매하고, ACM 와일드카드 인증서를 us-east-1(CloudFront용) + ap-northeast-2(ALB용)에 발급했다. ALB에 HTTPS:443 리스너를 추가하고 HTTP→HTTPS 리다이렉트를 설정했다. Route 53에 `youngmi.works` → CloudFront, `api.youngmi.works` → ALB A 레코드를 등록했다. 프론트엔드 API URL을 환경변수화하고 CORS에 `youngmi.works`를 추가하여 배포 완료. 프로덕션에서 HTTPS로 프론트엔드/백엔드 모두 정상 동작 확인됨.
