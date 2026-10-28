package com.myqaweb.feature;

import org.junit.jupiter.api.Test;

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
}
