package com.myqaweb.feature;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 연결된 에이전트 워커 목록 (registry_v31). 워커가 10초마다 보내는 heartbeat를 메모리에 보관한다.
 * 마지막 heartbeat가 {@link #TTL} 이내인 워커만 "연결됨"으로 본다 — DB 저장 없음.
 */
// ponytail: in-memory single instance. 백엔드를 다중 인스턴스로 띄우면 공유 저장소로 옮길 것.
@Component
public class AgentWorkerRegistry {

    /** 마지막 heartbeat 이후 연결로 인정하는 시간. */
    public static final Duration TTL = Duration.ofSeconds(15);

    private final Map<String, AgentExecutionDto.WorkerStatus> workers = new ConcurrentHashMap<>();

    /** 워커의 최신 상태로 덮어쓴다 (lastSeenAt = 지금). */
    public void put(AgentExecutionDto.WorkerHeartbeatRequest request) {
        workers.put(request.workerId(), new AgentExecutionDto.WorkerStatus(
                request.workerId(), request.targetKind(), request.productId(),
                request.deviceName(), request.currentJobId(), LocalDateTime.now()));
    }

    /** TTL 이내의 워커 목록 (workerId 순). 만료된 항목은 이때 제거한다. */
    public List<AgentExecutionDto.WorkerStatus> listActive() {
        LocalDateTime threshold = LocalDateTime.now().minus(TTL);
        workers.values().removeIf(w -> w.lastSeenAt().isBefore(threshold));
        return workers.values().stream()
                .sorted(Comparator.comparing(AgentExecutionDto.WorkerStatus::workerId))
                .toList();
    }
}
