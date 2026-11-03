package com.myqaweb.feature;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AgentWorkerRegistryTest {

    private final AgentWorkerRegistry registry = new AgentWorkerRegistry();

    private AgentExecutionDto.WorkerHeartbeatRequest beat(String workerId, Long currentJobId) {
        return new AgentExecutionDto.WorkerHeartbeatRequest(workerId, ExecTargetKind.WEB, 10L, null, currentJobId);
    }

    /** 레지스트리는 now()를 직접 호출해 시계를 주입할 수 없으므로, 오래된 heartbeat는 내부 맵에 직접 넣는다. */
    @SuppressWarnings("unchecked")
    private Map<String, AgentExecutionDto.WorkerStatus> workers() {
        return (Map<String, AgentExecutionDto.WorkerStatus>) ReflectionTestUtils.getField(registry, "workers");
    }

    private void seedLastSeen(String workerId, LocalDateTime lastSeenAt) {
        workers().put(workerId, new AgentExecutionDto.WorkerStatus(
                workerId, ExecTargetKind.WEB, null, null, null, lastSeenAt));
    }

    @Test
    void put_thenListActive_returnsWorkerWithRequestFields() {
        LocalDateTime before = LocalDateTime.now();

        registry.put(new AgentExecutionDto.WorkerHeartbeatRequest(
                "host:emulator-5554", ExecTargetKind.ANDROID, 10L, "emulator-5554", 3L));

        assertThat(registry.listActive()).singleElement().satisfies(w -> {
            assertThat(w.workerId()).isEqualTo("host:emulator-5554");
            assertThat(w.targetKind()).isEqualTo(ExecTargetKind.ANDROID);
            assertThat(w.productId()).isEqualTo(10L);
            assertThat(w.deviceName()).isEqualTo("emulator-5554");
            assertThat(w.currentJobId()).isEqualTo(3L);
            assertThat(w.lastSeenAt()).isAfterOrEqualTo(before);
        });
    }

    @Test
    void put_sameWorker_keepsLatestOnly() {
        registry.put(beat("a", 1L));
        registry.put(beat("a", 2L));

        assertThat(registry.listActive()).singleElement()
                .satisfies(w -> assertThat(w.currentJobId()).isEqualTo(2L));
    }

    @Test
    void listActive_sortsByWorkerId() {
        registry.put(beat("b", null));
        registry.put(beat("a", null));

        assertThat(registry.listActive())
                .extracting(AgentExecutionDto.WorkerStatus::workerId)
                .containsExactly("a", "b");
    }

    @Test
    void listActive_noWorkers_returnsEmpty() {
        assertThat(registry.listActive()).isEmpty();
    }

    @Test
    void listActive_dropsEntriesOlderThanTtl() {
        registry.put(beat("fresh", null));
        seedLastSeen("stale", LocalDateTime.now().minus(AgentWorkerRegistry.TTL).minusSeconds(1));

        assertThat(registry.listActive())
                .extracting(AgentExecutionDto.WorkerStatus::workerId)
                .containsExactly("fresh");
        assertThat(workers()).doesNotContainKey("stale");
    }

    @Test
    void listActive_keepsEntriesWithinTtl() {
        seedLastSeen("recent", LocalDateTime.now().minus(AgentWorkerRegistry.TTL).plusSeconds(5));

        assertThat(registry.listActive())
                .extracting(AgentExecutionDto.WorkerStatus::workerId)
                .containsExactly("recent");
    }

    @Test
    void put_afterExpiry_reconnectsWorker() {
        seedLastSeen("a", LocalDateTime.now().minus(AgentWorkerRegistry.TTL).minusSeconds(1));
        assertThat(registry.listActive()).isEmpty();

        registry.put(beat("a", null));

        assertThat(registry.listActive()).hasSize(1);
    }
}
