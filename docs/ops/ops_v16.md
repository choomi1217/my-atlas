> 변경 유형: 버그 수정  
> 작성일: 2026-04-16  
> 버전: v16  
> 상태: 완료

---

# DB Compose 프로젝트 완전 독립 분리

## 1. 배경

v11에서 `docker-compose.db.yml`로 DB를 별도 파일로 분리했으나, **실제로는 완전히 독립되지 않았다.**
`docker compose up/down`(app compose) 실행 시 DB 컨테이너가 영향을 받아 DBeaver에서 "Connection reset" 에러가 발생했고, 백엔드 재기동 시에도 DB 연결이 불안정했다.

### 증상

1. `docker compose up -d --build backend` 실행 시 경고 발생:
   ```
   Found orphan containers ([myqaweb-db]) for this project
   ```
2. DBeaver에서 `localhost:5432` 접속 시 "Connection reset" (DB 컨테이너는 healthy 상태)
3. `docker compose down && up` 후 백엔드가 DB 연결 실패 (`UnknownHostException: db`)

---

## 2. 근본 원인

### 원인 ①: 동일한 Docker Compose 프로젝트 이름

Docker Compose는 **프로젝트 이름**으로 서비스 그룹을 관리한다. 프로젝트 이름이 같으면 서로 다른 compose 파일이라도 **같은 프로젝트로 인식**한다.

```
# 두 compose 파일 모두 디렉토리명 "my-atlas"를 프로젝트 이름으로 사용
docker-compose.db.yml   → project: my-atlas (디렉토리명 자동 할당)
docker-compose.yml      → project: my-atlas (디렉토리명 자동 할당)
```

**결과:**
- `docker compose up/down`(app compose) 실행 시 Docker가 `my-atlas` 프로젝트 전체를 스캔
- DB 컨테이너(`myqaweb-db`)가 `docker-compose.yml`에 정의되지 않았으므로 **orphan으로 인식**
- 네트워크 재생성(`my-atlas_default`) 시 DB 컨테이너의 네트워크 연결이 일시적으로 끊김
- 이로 인해 DBeaver 등 외부 클라이언트의 TCP 연결이 reset됨

### 원인 ②: `.env`의 DB 접속 주소가 서비스명(`db`) 사용

v11 이전에는 DB가 app compose의 `db` 서비스로 정의되어 있었기 때문에, `.env`에 다음과 같이 설정되어 있었다:

```
SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/myqaweb
```

`db`는 Docker Compose 내부 DNS로 해석되는 **서비스명**이다. DB가 같은 compose 프로젝트에 있을 때만 동작한다. DB가 별도 프로젝트로 분리되면 `db` 호스트를 해석할 수 없어 `UnknownHostException: db`가 발생한다.

### v11에서 불완전했던 부분

v11은 다음을 수행했다:
- ✅ `docker-compose.db.yml`로 DB 서비스를 별도 파일로 분리
- ✅ `docker-compose.yml`에서 `db` 서비스 제거
- ✅ 백엔드 default URL을 `host.docker.internal`로 변경

하지만 다음이 누락되었다:
- ❌ Compose 프로젝트 이름 분리 (두 파일이 같은 `my-atlas` 프로젝트로 인식됨)
- ❌ `.env`의 `SPRING_DATASOURCE_URL`이 여전히 `db:5432` (default를 override)

`docker-compose.yml`의 default는 `host.docker.internal`이었지만, `.env`가 `db:5432`로 override하고 있어서 실제로는 옛날 설정이 사용되었다.

---

## 3. 해결

### 3-1. `docker-compose.db.yml`에 프로젝트 이름 지정

```yaml
# Before
version: "3.9"

services:
  db:
    ...

# After
name: myatlas-db    # ← 별도 프로젝트 이름 지정

services:
  db:
    ...
```

`name: myatlas-db`를 지정하면 `docker compose -f docker-compose.db.yml up/down` 시 `myatlas-db` 프로젝트로 관리된다. app compose(`my-atlas`)와 완전히 분리되므로:
- app compose가 DB를 orphan으로 인식하지 않음
- app compose의 네트워크 재생성이 DB에 영향 안 줌
- `docker compose down`이 DB 컨테이너를 건드리지 않음

### 3-2. 볼륨을 `external: true`로 변경

```yaml
volumes:
  pgdata:
    name: my-atlas_pgdata
    external: true          # ← 기존 볼륨을 외부 참조
```

프로젝트 이름이 변경되면 Docker가 볼륨을 새로 만들려고 시도한다. `external: true`로 설정하면 기존 볼륨(`my-atlas_pgdata`)을 그대로 참조하여 **데이터 유실 없이** 프로젝트를 전환할 수 있다.

### 3-3. `.env`의 DB 접속 주소 변경

```bash
# Before — 같은 compose 네트워크의 서비스명
SPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/myqaweb

# After — 호스트 머신 경유 (프로젝트 무관하게 접속 가능)
SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/myqaweb
```

`host.docker.internal`은 Docker Desktop이 제공하는 호스트 머신 주소로, Docker 네트워크/프로젝트에 무관하게 호스트의 5432 포트로 접속한다. DB가 어느 프로젝트에 있든 포트만 열려 있으면 연결된다.

### 3-4. 적용 절차

```bash
# 1. 기존 DB 컨테이너 정지 + 제거 (볼륨은 유지됨)
docker stop myqaweb-db && docker rm myqaweb-db

# 2. 새 프로젝트로 DB 시작
docker compose -f docker-compose.db.yml up -d

# 3. App 재시작 (새 .env 반영)
docker compose down && docker compose up -d
```

---

## 4. Before / After 비교

### Before (v11~v15)

```
[my-atlas 프로젝트] ← 동일 프로젝트
├── docker-compose.db.yml → myqaweb-db (서비스: db)
└── docker-compose.yml    → myqaweb-backend, myqaweb-frontend

문제:
- docker compose down → my-atlas_default 네트워크 삭제 → DB 연결 끊김
- docker compose up   → orphan 경고, 네트워크 재생성 → DB 일시적 Connection reset
- .env: db:5432       → 같은 네트워크 아니면 UnknownHostException
```

### After (v16)

```
[myatlas-db 프로젝트]         ← 독립 프로젝트
└── docker-compose.db.yml → myqaweb-db (포트 5432 노출)

[my-atlas 프로젝트]           ← 별도 프로젝트
└── docker-compose.yml    → myqaweb-backend (host.docker.internal:5432)
                          → myqaweb-frontend

특징:
- docker compose down → my-atlas 프로젝트만 영향, DB 무관
- docker compose up   → orphan 경고 없음, DB 안정적
- .env: host.docker.internal:5432 → 프로젝트 무관하게 접속
```

---

## 5. 변경 파일

| 파일 | 변경 |
|------|------|
| `docker-compose.db.yml` | `name: myatlas-db` 추가, `version: "3.9"` 제거, `external: true` 추가 |
| `.env` | `SPRING_DATASOURCE_URL`을 `db:5432` → `host.docker.internal:5432`로 변경 |

---

## 6. 검증

- [x] `docker compose -f docker-compose.db.yml up -d` → DB 정상 기동
- [x] `docker exec myqaweb-db psql -U myqaweb -d myqaweb -c "SELECT count(*) FROM knowledge_base"` → 72건 (데이터 유실 없음)
- [x] `docker compose down && docker compose up -d` → orphan 경고 없음
- [x] `curl localhost:8080/actuator/health` → 200 OK
- [x] `curl localhost:5173` → 200 OK
- [x] DBeaver `localhost:5432` 연결 성공

---

## [최종 요약]

v11에서 `docker-compose.db.yml`로 파일만 분리했지만, Docker Compose 프로젝트 이름이 동일하여 실제로는 같은 프로젝트로 관리되었다. app compose 실행 시 DB 네트워크가 영향받아 연결이 불안정했다. `name: myatlas-db`로 프로젝트 이름을 분리하고, `.env`의 DB 접속 주소를 `host.docker.internal`로 변경하여 완전한 독립을 달성했다.
