package com.myqaweb.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.settings.SettingsService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AiRateLimitFilter}.
 *
 * Covers:
 * - Target endpoint matching vs non-target bypass
 * - Authenticated users are exempted from rate limiting
 * - Anonymous IP-based counting (per-IP isolation, X-Forwarded-For handling)
 * - 429 response body shape (ApiResponse JSON + Retry-After header)
 * - Window seconds change triggering cache rebuild
 */
@ExtendWith(MockitoExtension.class)
class AiRateLimitFilterTest {

    @Mock
    private SettingsService settingsService;

    private ObjectMapper objectMapper;
    private AiRateLimitFilter filter;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        filter = new AiRateLimitFilter(settingsService, objectMapper);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // --- helper ---

    private MockHttpServletRequest chatRequest(String remoteAddr) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setMethod("POST");
        req.setRequestURI("/api/senior/chat");
        req.setServletPath("/api/senior/chat");
        req.setRemoteAddr(remoteAddr);
        return req;
    }

    private MockHttpServletRequest sessionsRequest(String remoteAddr) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setMethod("POST");
        req.setRequestURI("/api/senior/sessions");
        req.setServletPath("/api/senior/sessions");
        req.setRemoteAddr(remoteAddr);
        return req;
    }

    private void setAuthenticated(String role) {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "alice", "pwd",
                List.of(new SimpleGrantedAuthority(role)));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private void setAnonymous() {
        AnonymousAuthenticationToken anon = new AnonymousAuthenticationToken(
                "key", "anonymousUser",
                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
        SecurityContextHolder.getContext().setAuthentication(anon);
    }

    // --- non-target paths ---

    @Test
    @DisplayName("비대상 경로(GET /api/companies)는 그대로 통과, SettingsService 조회 없음")
    void nonTargetPath_passesThrough() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setMethod("GET");
        request.setRequestURI("/api/companies");
        request.setServletPath("/api/companies");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(200, response.getStatus(), "기본 응답 상태 유지");
        assertSame(request, chain.getRequest(), "체인으로 위임되어야 한다");
    }

    @Test
    @DisplayName("비대상 GET /api/senior/sessions 은 카운팅 대상이 아니다 (GET 은 whitelist)")
    void nonTargetGetSessions_passesThrough() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setMethod("GET");
        request.setRequestURI("/api/senior/sessions");
        request.setServletPath("/api/senior/sessions");
        request.setRemoteAddr("1.2.3.4");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(200, response.getStatus());
        assertSame(request, chain.getRequest());
    }

    // --- authenticated users are exempt ---

    @Test
    @DisplayName("인증된 USER 는 AI rate limit 적용 대상이 아니다 (limit=1 이어도 여러 번 통과)")
    void authenticatedUser_isExempt() throws Exception {
        setAuthenticated("ROLE_USER");
        // limit 설정이 매우 작아도 — 인증된 사용자는 건드리지 않음
        // service는 호출되더라도 값이 영향 없음. (mock lenient 처리 위해 stub 하지 않음)

        for (int i = 0; i < 3; i++) {
            MockHttpServletRequest request = chatRequest("9.9.9.9");
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            assertEquals(200, response.getStatus(), "인증 사용자는 429 가 발생하지 않아야 한다");
            assertSame(request, chain.getRequest());
        }
    }

    @Test
    @DisplayName("인증된 ADMIN 도 면제")
    void authenticatedAdmin_isExempt() throws Exception {
        setAuthenticated("ROLE_ADMIN");

        for (int i = 0; i < 3; i++) {
            MockHttpServletRequest request = chatRequest("9.9.9.9");
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            assertEquals(200, response.getStatus());
        }
    }

    // --- Anonymous counting ---

    @Test
    @DisplayName("Anonymous + 제한 이내 → 통과")
    void anonymous_withinLimit_passes() throws Exception {
        setAnonymous();
        when(settingsService.getAiRateLimitPerIp()).thenReturn(3);
        when(settingsService.getAiRateLimitWindowSeconds()).thenReturn(60);

        for (int i = 1; i <= 3; i++) {
            MockHttpServletRequest request = chatRequest("10.0.0.1");
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            assertEquals(200, response.getStatus(), i + "번째 요청은 limit 이내");
            assertSame(request, chain.getRequest());
        }
    }

    @Test
    @DisplayName("Anonymous + limit 초과 → 429 + Retry-After + ApiResponse JSON")
    void anonymous_overLimit_returns429() throws Exception {
        setAnonymous();
        when(settingsService.getAiRateLimitPerIp()).thenReturn(2);
        when(settingsService.getAiRateLimitWindowSeconds()).thenReturn(120);

        // 2회는 통과
        for (int i = 0; i < 2; i++) {
            MockHttpServletRequest req = chatRequest("10.0.0.2");
            MockHttpServletResponse resp = new MockHttpServletResponse();
            filter.doFilter(req, resp, new MockFilterChain());
            assertEquals(200, resp.getStatus());
        }

        // 3회째는 429
        MockHttpServletRequest blocked = chatRequest("10.0.0.2");
        MockHttpServletResponse blockedResp = new MockHttpServletResponse();
        MockFilterChain blockedChain = new MockFilterChain();
        filter.doFilter(blocked, blockedResp, blockedChain);

        assertEquals(429, blockedResp.getStatus());
        assertEquals("120", blockedResp.getHeader("Retry-After"));
        assertTrue(blockedResp.getContentType().startsWith("application/json"));
        assertNull(blockedChain.getRequest(), "429 시 체인은 실행되지 않아야 한다");

        JsonNode body = objectMapper.readTree(blockedResp.getContentAsString());
        assertFalse(body.get("success").asBoolean());
        assertTrue(body.get("message").asText().length() > 0);
        assertEquals(120, body.get("data").get("retryAfterSeconds").asInt());
    }

    @Test
    @DisplayName("429 응답 메시지는 한국어")
    void rateLimitResponse_messageIsKorean() throws Exception {
        setAnonymous();
        when(settingsService.getAiRateLimitPerIp()).thenReturn(0); // 즉시 초과
        when(settingsService.getAiRateLimitWindowSeconds()).thenReturn(60);

        MockHttpServletRequest req = chatRequest("10.0.0.3");
        MockHttpServletResponse resp = new MockHttpServletResponse();
        filter.doFilter(req, resp, new MockFilterChain());

        assertEquals(429, resp.getStatus());
        JsonNode body = objectMapper.readTree(resp.getContentAsString());
        String message = body.get("message").asText();
        assertTrue(message.contains("AI") || message.contains("한도") || message.contains("잠시"),
                "한국어 안내 메시지 포함: " + message);
    }

    @Test
    @DisplayName("서로 다른 IP 는 카운터가 독립된다")
    void distinctIps_haveSeparateBuckets() throws Exception {
        setAnonymous();
        when(settingsService.getAiRateLimitPerIp()).thenReturn(1);
        when(settingsService.getAiRateLimitWindowSeconds()).thenReturn(60);

        // 1.1.1.1: 1회 통과
        MockHttpServletResponse r1 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("1.1.1.1"), r1, new MockFilterChain());
        assertEquals(200, r1.getStatus());

        // 2.2.2.2: 다른 IP — 여전히 1회 통과
        MockHttpServletResponse r2 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("2.2.2.2"), r2, new MockFilterChain());
        assertEquals(200, r2.getStatus());

        // 1.1.1.1: 2회째 → 429
        MockHttpServletResponse r3 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("1.1.1.1"), r3, new MockFilterChain());
        assertEquals(429, r3.getStatus());
    }

    @Test
    @DisplayName("X-Forwarded-For 헤더가 있으면 첫 번째 IP 로 카운팅")
    void xForwardedFor_usesFirstIp() throws Exception {
        setAnonymous();
        when(settingsService.getAiRateLimitPerIp()).thenReturn(1);
        when(settingsService.getAiRateLimitWindowSeconds()).thenReturn(60);

        // remoteAddr 은 ALB 내부 IP 로 설정하고, X-Forwarded-For 로 client IP 를 전달
        MockHttpServletRequest req1 = chatRequest("172.16.0.1");
        req1.addHeader("X-Forwarded-For", "203.0.113.5, 172.16.0.1");
        MockHttpServletResponse r1 = new MockHttpServletResponse();
        filter.doFilter(req1, r1, new MockFilterChain());
        assertEquals(200, r1.getStatus());

        // 동일 X-Forwarded-For 첫 번째 IP(203.0.113.5) → 두 번째 요청 차단
        MockHttpServletRequest req2 = chatRequest("172.16.0.2"); // remoteAddr 다름
        req2.addHeader("X-Forwarded-For", "203.0.113.5, 172.16.0.99");
        MockHttpServletResponse r2 = new MockHttpServletResponse();
        filter.doFilter(req2, r2, new MockFilterChain());
        assertEquals(429, r2.getStatus(),
                "X-Forwarded-For 의 첫 번째 IP 가 동일하면 같은 버킷으로 집계되어야 한다");
    }

    @Test
    @DisplayName("X-Forwarded-For 가 없으면 remoteAddr 사용")
    void noXForwardedFor_usesRemoteAddr() throws Exception {
        setAnonymous();
        when(settingsService.getAiRateLimitPerIp()).thenReturn(1);
        when(settingsService.getAiRateLimitWindowSeconds()).thenReturn(60);

        MockHttpServletResponse r1 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("198.51.100.7"), r1, new MockFilterChain());
        assertEquals(200, r1.getStatus());

        MockHttpServletResponse r2 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("198.51.100.7"), r2, new MockFilterChain());
        assertEquals(429, r2.getStatus(), "remoteAddr 기준으로 같은 IP 는 동일 버킷");
    }

    @Test
    @DisplayName("X-Forwarded-For 단일 IP (쉼표 없음) 도 정상 파싱")
    void xForwardedFor_singleIp_parsesCorrectly() throws Exception {
        setAnonymous();
        when(settingsService.getAiRateLimitPerIp()).thenReturn(1);
        when(settingsService.getAiRateLimitWindowSeconds()).thenReturn(60);

        MockHttpServletRequest req1 = chatRequest("172.16.0.1");
        req1.addHeader("X-Forwarded-For", "203.0.113.10");
        MockHttpServletResponse r1 = new MockHttpServletResponse();
        filter.doFilter(req1, r1, new MockFilterChain());
        assertEquals(200, r1.getStatus());

        MockHttpServletRequest req2 = chatRequest("172.16.0.2");
        req2.addHeader("X-Forwarded-For", "203.0.113.10");
        MockHttpServletResponse r2 = new MockHttpServletResponse();
        filter.doFilter(req2, r2, new MockFilterChain());
        assertEquals(429, r2.getStatus());
    }

    @Test
    @DisplayName("POST /api/senior/sessions 도 대상 경로로 인식")
    void sessionsPostIsAlsoRateLimited() throws Exception {
        setAnonymous();
        when(settingsService.getAiRateLimitPerIp()).thenReturn(1);
        when(settingsService.getAiRateLimitWindowSeconds()).thenReturn(60);

        MockHttpServletResponse r1 = new MockHttpServletResponse();
        filter.doFilter(sessionsRequest("10.0.0.10"), r1, new MockFilterChain());
        assertEquals(200, r1.getStatus());

        MockHttpServletResponse r2 = new MockHttpServletResponse();
        filter.doFilter(sessionsRequest("10.0.0.10"), r2, new MockFilterChain());
        assertEquals(429, r2.getStatus());
    }

    @Test
    @DisplayName("같은 IP 의 /chat 과 /sessions POST 는 같은 버킷으로 합산된다")
    void chatAndSessions_shareSameIpBucket() throws Exception {
        setAnonymous();
        when(settingsService.getAiRateLimitPerIp()).thenReturn(1);
        when(settingsService.getAiRateLimitWindowSeconds()).thenReturn(60);

        // /chat 1회 통과
        MockHttpServletResponse r1 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("10.0.0.20"), r1, new MockFilterChain());
        assertEquals(200, r1.getStatus());

        // /sessions 같은 IP → 429 (같은 버킷 합산)
        MockHttpServletResponse r2 = new MockHttpServletResponse();
        filter.doFilter(sessionsRequest("10.0.0.20"), r2, new MockFilterChain());
        assertEquals(429, r2.getStatus(),
                "같은 Anonymous IP 는 대상 경로 전체에 대해 단일 버킷으로 관리된다");
    }

    // --- window seconds rebuild ---

    @Test
    @DisplayName("windowSeconds 변경 시 캐시가 재구성되어 카운터 초기화")
    void windowSecondsChange_rebuildsCacheAndResetsCounters() throws Exception {
        setAnonymous();
        when(settingsService.getAiRateLimitPerIp()).thenReturn(1);
        when(settingsService.getAiRateLimitWindowSeconds()).thenReturn(60);

        // 첫 요청 (window=60) → 통과
        MockHttpServletResponse r1 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("10.0.0.30"), r1, new MockFilterChain());
        assertEquals(200, r1.getStatus());

        // 두 번째 (window=60) → 429
        MockHttpServletResponse r2 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("10.0.0.30"), r2, new MockFilterChain());
        assertEquals(429, r2.getStatus());

        // windowSeconds 를 바꾸면 lazy rebuild → 카운터 초기화, 다음 요청 통과
        when(settingsService.getAiRateLimitWindowSeconds()).thenReturn(120);
        MockHttpServletResponse r3 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("10.0.0.30"), r3, new MockFilterChain());
        assertEquals(200, r3.getStatus(), "window 변경 후에는 카운터가 초기화되어 통과");

        // 동일 IP 다시 → 429 (새 window 기준 한도 1 도달)
        MockHttpServletResponse r4 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("10.0.0.30"), r4, new MockFilterChain());
        assertEquals(429, r4.getStatus());
    }

    @Test
    @DisplayName("resetCounters() 호출 시 이후 요청은 통과")
    void resetCounters_allowsSubsequentRequests() throws Exception {
        setAnonymous();
        when(settingsService.getAiRateLimitPerIp()).thenReturn(1);
        when(settingsService.getAiRateLimitWindowSeconds()).thenReturn(60);

        // 1회 통과, 2회째 429
        MockHttpServletResponse r1 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("10.0.0.40"), r1, new MockFilterChain());
        assertEquals(200, r1.getStatus());

        MockHttpServletResponse r2 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("10.0.0.40"), r2, new MockFilterChain());
        assertEquals(429, r2.getStatus());

        // 수동 리셋 후 → 통과
        filter.resetCounters();
        MockHttpServletResponse r3 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("10.0.0.40"), r3, new MockFilterChain());
        assertEquals(200, r3.getStatus());
    }

    @Test
    @DisplayName("SecurityContext 가 비어있는 요청은 Anonymous 로 간주되어 카운팅")
    void emptySecurityContext_isCountedAsAnonymous() throws Exception {
        // 명시적으로 clear — 비인증 상태
        SecurityContextHolder.clearContext();
        when(settingsService.getAiRateLimitPerIp()).thenReturn(1);
        when(settingsService.getAiRateLimitWindowSeconds()).thenReturn(60);

        MockHttpServletResponse r1 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("10.0.0.50"), r1, new MockFilterChain());
        assertEquals(200, r1.getStatus());

        MockHttpServletResponse r2 = new MockHttpServletResponse();
        filter.doFilter(chatRequest("10.0.0.50"), r2, new MockFilterChain());
        assertEquals(429, r2.getStatus(),
                "비인증(null authentication) 요청도 Anonymous 와 동일하게 카운팅되어야 한다");
    }
}
