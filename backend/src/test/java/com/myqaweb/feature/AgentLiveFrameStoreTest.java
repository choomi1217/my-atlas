package com.myqaweb.feature;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AgentLiveFrameStoreTest {

    private final AgentLiveFrameStore store = new AgentLiveFrameStore();

    @Test
    void put_thenGet_returnsSameFrame() {
        byte[] data = {1, 2, 3};

        store.put(1L, data, "image/png");

        assertThat(store.get(1L)).hasValueSatisfying(f -> {
            assertThat(f.data()).isEqualTo(data);
            assertThat(f.contentType()).isEqualTo("image/png");
        });
    }

    @Test
    void put_twice_keepsLatestOnly() {
        store.put(1L, new byte[] {1}, "image/png");
        store.put(1L, new byte[] {2}, "image/jpeg");

        assertThat(store.get(1L)).hasValueSatisfying(f -> {
            assertThat(f.data()).containsExactly(2);
            assertThat(f.contentType()).isEqualTo("image/jpeg");
        });
    }

    @Test
    void put_isolatedPerJob() {
        store.put(1L, new byte[] {1}, "image/png");
        store.put(2L, new byte[] {2}, "image/png");

        assertThat(store.get(1L)).hasValueSatisfying(f -> assertThat(f.data()).containsExactly(1));
        assertThat(store.get(2L)).hasValueSatisfying(f -> assertThat(f.data()).containsExactly(2));
    }

    @Test
    void clear_removesFrame() {
        store.put(1L, new byte[] {1}, "image/png");
        store.put(2L, new byte[] {2}, "image/png");

        store.clear(1L);

        assertThat(store.get(1L)).isEmpty();
        assertThat(store.get(2L)).isPresent();
    }

    @Test
    void get_unknownJob_returnsEmpty() {
        assertThat(store.get(42L)).isEmpty();
    }

    @Test
    void clear_unknownJob_isNoOp() {
        store.clear(42L);

        assertThat(store.get(42L)).isEmpty();
    }

    // --- progress (registry_v27) ---

    private AgentExecutionDto.LiveProgress progress(String title, Integer currentStep) {
        return new AgentExecutionDto.LiveProgress(
                10L, title, 1, 1, "ACTING",
                new AgentExecutionDto.LivePrecondition("로그인 화면", "DONE"),
                currentStep,
                List.of(new AgentExecutionDto.LiveStep(1, "클릭", "이동", "ACTING", null)));
    }

    @Test
    void putProgress_thenGet_returnsSameProgress() {
        var p = progress("로그인", 1);

        store.putProgress(1L, p);

        assertThat(store.getProgress(1L)).containsSame(p);
    }

    @Test
    void putProgress_twice_keepsLatestOnly() {
        store.putProgress(1L, progress("first", 1));
        var latest = progress("second", 2);
        store.putProgress(1L, latest);

        assertThat(store.getProgress(1L)).hasValueSatisfying(p -> {
            assertThat(p.testCaseTitle()).isEqualTo("second");
            assertThat(p.currentStep()).isEqualTo(2);
        });
    }

    @Test
    void clear_removesFrameAndProgress() {
        store.put(1L, new byte[] {1}, "image/png");
        store.putProgress(1L, progress("t", 1));
        store.putProgress(2L, progress("other", 1));

        store.clear(1L);

        assertThat(store.get(1L)).isEmpty();
        assertThat(store.getProgress(1L)).isEmpty();
        assertThat(store.getProgress(2L)).isPresent();
    }

    @Test
    void getProgress_unknownJob_returnsEmpty() {
        assertThat(store.getProgress(42L)).isEmpty();
    }
}
