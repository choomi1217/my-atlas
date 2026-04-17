> 변경 유형: 버그 수정  
> 작성일: 2026-04-17  
> 버전: v19  
> 상태: 완료

---

# Deploy Backend Health Check 재시도 방식 전환

## 1. 배경

v18에서 S3 SDK 의존성을 추가한 후, EC2 백엔드 부팅 시간이 ~15초 → ~21초로 증가했다. 기존 `e2e.yml`의 deploy-backend 스크립트가 `sleep 15` 후 단 1회 health check를 수행하므로, 부팅이 15초를 초과하면 배포가 실패로 판정된다.

### 증상

```
curl: (52) Empty reply from server
Process exited with status 1
```

백엔드는 실제로 정상 기동되었지만, health check 시점에 아직 준비되지 않아 빈 응답이 반환됨.

---

## 2. 해결

### Before (고정 대기)

```bash
docker compose up -d --build backend
sleep 15
curl -f http://localhost:8080/actuator/health || exit 1
```

- 15초 안에 안 뜨면 무조건 실패
- 10초에 떠도 15초를 다 기다림

### After (재시도 루프)

```bash
docker compose up -d --build backend
for i in 1 2 3 4 5 6; do
  sleep 10
  if curl -sf http://localhost:8080/actuator/health > /dev/null 2>&1; then
    echo "Backend deployed successfully!"
    exit 0
  fi
  echo "Attempt $i: backend not ready yet..."
done
echo "Backend failed to start within 60s"
docker logs myqaweb-backend --tail 30
exit 1
```

- 10초 간격으로 최대 6회(60초) 재시도
- 뜨는 즉시 성공 처리 (불필요한 대기 없음)
- 60초 안에 안 뜨면 컨테이너 로그를 출력하고 실패 → 디버깅 용이

---

## 3. 변경 파일

| 파일 | 변경 |
|------|------|
| `.github/workflows/e2e.yml` | deploy-backend의 health check를 재시도 루프로 변경 |

---

## [최종 요약]

S3 SDK 추가로 백엔드 부팅 시간이 증가하여 CI 배포가 실패. `sleep 15` + 단 1회 health check를 10초 간격 최대 60초 재시도 루프로 변경하여 해결. 실패 시 컨테이너 로그도 출력되어 디버깅이 용이해짐.
