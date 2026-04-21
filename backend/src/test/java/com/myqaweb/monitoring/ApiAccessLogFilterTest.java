package com.myqaweb.monitoring;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.verify;

/**
 * Tests for {@link ApiAccessLogFilter} — focused on ip_address extraction
 * and entity population behavior.
 */
@ExtendWith(MockitoExtension.class)
class ApiAccessLogFilterTest {

    @Mock
    private ApiAccessLogRepository repository;

    private ApiAccessLogFilter filter;

    @BeforeEach
    void setUp() {
        filter = new ApiAccessLogFilter(repository);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // --- extractClientIp (static) ---

    @Test
    @DisplayName("X-Forwarded-For 없음 → remoteAddr 사용")
    void extractClientIp_noForwardedHeader_returnsRemoteAddr() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");

        String ip = ApiAccessLogFilter.extractClientIp(request);

        assertEquals("127.0.0.1", ip);
    }

    @Test
    @DisplayName("X-Forwarded-For 단일 IP → 그 값을 반환")
    void extractClientIp_singleForwardedIp_returnsIt() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("172.16.0.1");
        request.addHeader("X-Forwarded-For", "203.0.113.5");

        String ip = ApiAccessLogFilter.extractClientIp(request);

        assertEquals("203.0.113.5", ip);
    }

    @Test
    @DisplayName("X-Forwarded-For 다중 IP → 첫 번째 (client) IP 반환")
    void extractClientIp_multipleForwardedIps_returnsFirst() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("172.16.0.1");
        request.addHeader("X-Forwarded-For", "198.51.100.1, 10.0.0.5, 172.16.0.1");

        String ip = ApiAccessLogFilter.extractClientIp(request);

        assertEquals("198.51.100.1", ip);
    }

    @Test
    @DisplayName("X-Forwarded-For 공백 포함 → trim 후 반환")
    void extractClientIp_trimsWhitespace() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("172.16.0.1");
        request.addHeader("X-Forwarded-For", "  203.0.113.50  ,  10.0.0.1");

        String ip = ApiAccessLogFilter.extractClientIp(request);

        assertEquals("203.0.113.50", ip);
    }

    @Test
    @DisplayName("X-Forwarded-For 빈 문자열 → remoteAddr 사용")
    void extractClientIp_blankForwardedHeader_returnsRemoteAddr() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        request.addHeader("X-Forwarded-For", "");

        String ip = ApiAccessLogFilter.extractClientIp(request);

        assertEquals("127.0.0.1", ip);
    }

    @Test
    @DisplayName("50자 초과 IP 문자열 → 50자로 잘림")
    void extractClientIp_truncatesIfTooLong() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        String longIp = "a".repeat(200); // 의도적으로 긴 값
        request.setRemoteAddr(longIp);

        String ip = ApiAccessLogFilter.extractClientIp(request);

        assertNotNull(ip);
        assertTrue(ip.length() <= 50, "IP 길이는 50자 이하로 잘려야 한다");
    }

    // --- full filter: ip_address is persisted ---

    @Test
    @DisplayName("필터 실행 후 저장된 엔티티에 ip_address 포함")
    void filter_savesIpAddressOnEntity_fromRemoteAddr() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setMethod("GET");
        request.setRequestURI("/api/companies");
        request.setServletPath("/api/companies");
        request.setRemoteAddr("192.0.2.1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        ArgumentCaptor<ApiAccessLogEntity> captor = ArgumentCaptor.forClass(ApiAccessLogEntity.class);
        verify(repository).save(captor.capture());
        ApiAccessLogEntity saved = captor.getValue();
        assertEquals("192.0.2.1", saved.getIpAddress());
        assertEquals("GET", saved.getMethod());
        assertEquals("/api/companies", saved.getUri());
    }

    @Test
    @DisplayName("필터 실행 후 저장된 엔티티의 ip_address 는 X-Forwarded-For 첫 번째 IP")
    void filter_savesIpAddressOnEntity_fromForwardedHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setMethod("GET");
        request.setRequestURI("/api/kb");
        request.setServletPath("/api/kb");
        request.setRemoteAddr("172.16.0.1");
        request.addHeader("X-Forwarded-For", "203.0.113.99, 10.0.0.5");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        ArgumentCaptor<ApiAccessLogEntity> captor = ArgumentCaptor.forClass(ApiAccessLogEntity.class);
        verify(repository).save(captor.capture());
        assertEquals("203.0.113.99", captor.getValue().getIpAddress());
    }
}
