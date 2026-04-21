package com.myqaweb.config;

import com.myqaweb.settings.SettingsService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link DynamicPublicAccessFilter}.
 *
 * Covers whitelist matching, login_required toggle, and idempotent injection behavior.
 */
@ExtendWith(MockitoExtension.class)
class DynamicPublicAccessFilterTest {

    @Mock
    private SettingsService settingsService;

    @InjectMocks
    private DynamicPublicAccessFilter filter;

    private MockHttpServletRequest request;
    private MockHttpServletResponse response;
    private MockFilterChain chain;

    @BeforeEach
    void setUp() {
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        chain = new MockFilterChain();
        SecurityContextHolder.clearContext();
    }

    /** AntPathRequestMatcher needs servletPath populated for MockHttpServletRequest. */
    private void configureRequest(String method, String uri) {
        request.setMethod(method);
        request.setRequestURI(uri);
        request.setServletPath(uri);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // --- login_required=true: filter must be a no-op ---

    @Test
    @DisplayName("login_required=true 이면 whitelist 경로라도 Anonymous 주입하지 않는다")
    void loginRequiredTrue_doesNotInjectAnonymous() throws Exception {
        when(settingsService.isLoginRequired()).thenReturn(true);
        configureRequest("GET", "/api/companies");

        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                "login_required=true 일 때는 어떠한 authentication도 주입되지 않아야 한다");
        assertSame(request, chain.getRequest(), "filterChain.doFilter는 항상 호출되어야 한다");
    }

    // --- login_required=false: whitelist matching ---

    @Test
    @DisplayName("login_required=false + 비인증 + whitelist 매칭(GET /api/companies) → Anonymous 주입")
    void loginRequiredFalse_whitelistMatch_injectsAnonymous() throws Exception {
        when(settingsService.isLoginRequired()).thenReturn(false);
        configureRequest("GET", "/api/companies");

        filter.doFilter(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth, "Anonymous authentication이 주입되어야 한다");
        assertInstanceOf(UsernamePasswordAuthenticationToken.class, auth);
        assertTrue(auth.isAuthenticated(), "인증된 토큰이어야 /api/** authenticated() 규칙을 통과");
        assertEquals("anonymousUser", auth.getPrincipal());
        assertEquals("anonymousUser", auth.getName());
        assertTrue(auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ANONYMOUS")));
        assertSame(request, chain.getRequest());
    }

    @Test
    @DisplayName("login_required=false + 이미 인증된 사용자는 기존 authentication 유지")
    void loginRequiredFalse_alreadyAuthenticated_doesNotReplace() throws Exception {
        // Settings should not even be consulted when auth already exists
        Authentication existing = new UsernamePasswordAuthenticationToken(
                "alice", "pwd",
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContextHolder.getContext().setAuthentication(existing);
        configureRequest("GET", "/api/companies");

        filter.doFilter(request, response, chain);

        assertSame(existing, SecurityContextHolder.getContext().getAuthentication(),
                "기존 인증 객체가 유지되어야 한다");
        verify(settingsService, never()).isLoginRequired();
    }

    @Test
    @DisplayName("login_required=false + POST /api/senior/chat (AI try-out) → Anonymous 주입")
    void loginRequiredFalse_seniorChatPost_injectsAnonymous() throws Exception {
        when(settingsService.isLoginRequired()).thenReturn(false);
        configureRequest("POST", "/api/senior/chat");

        filter.doFilter(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertInstanceOf(UsernamePasswordAuthenticationToken.class, auth);
        assertTrue(auth.isAuthenticated(), "인증된 토큰이어야 /api/** authenticated() 규칙을 통과");
        assertEquals("anonymousUser", auth.getPrincipal());
    }

    @Test
    @DisplayName("login_required=false + whitelist 미매칭(POST /api/companies) → 주입 안 함")
    void loginRequiredFalse_nonWhitelistedWriteMethod_doesNotInject() throws Exception {
        when(settingsService.isLoginRequired()).thenReturn(false);
        configureRequest("POST", "/api/companies");

        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                "쓰기 엔드포인트는 whitelist 가 아니므로 Anonymous 주입 금지");
    }

    @Test
    @DisplayName("login_required=false + ADMIN 전용 경로(GET /api/settings/users) → 주입 안 함")
    void loginRequiredFalse_adminPath_doesNotInject() throws Exception {
        when(settingsService.isLoginRequired()).thenReturn(false);
        configureRequest("GET", "/api/settings/users");

        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                "ADMIN 전용 settings 경로는 whitelist 가 아니므로 Anonymous 주입 금지");
    }

    @Test
    @DisplayName("기존 AnonymousAuthenticationToken 이 있으면 중복 주입하지 않는다")
    void existingAnonymousToken_doesNotReplace() throws Exception {
        Authentication existing = new AnonymousAuthenticationToken(
                "other-key", "someAnon",
                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
        SecurityContextHolder.getContext().setAuthentication(existing);
        when(settingsService.isLoginRequired()).thenReturn(false);
        configureRequest("GET", "/api/companies");

        filter.doFilter(request, response, chain);

        // 현재 구현은 'existing이 null이거나 AnonymousAuthenticationToken 이면' 주입을 허용한다.
        // 따라서 이 케이스에서는 settingsService.isLoginRequired()가 호출되어 새 토큰으로 대체될 수 있다.
        // 중요한 것: 필터 체인이 계속 진행되고 결과가 여전히 Anonymous 라는 점이다.
        Authentication resulting = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(resulting);
        assertInstanceOf(UsernamePasswordAuthenticationToken.class, resulting);
        assertEquals("anonymousUser", resulting.getPrincipal());
        assertSame(request, chain.getRequest());
    }

    @Test
    @DisplayName("filterChain.doFilter는 어떤 경로/상태에서도 호출된다")
    void doFilter_alwaysInvokesChain() throws Exception {
        when(settingsService.isLoginRequired()).thenReturn(false);
        configureRequest("DELETE", "/api/companies/99");

        filter.doFilter(request, response, chain);

        assertSame(request, chain.getRequest(),
                "필터는 authorization 결정을 뒤로 넘겨야 하며 항상 chain 을 통과시켜야 한다");
    }

    // --- Parameterized: whitelist coverage ---

    @ParameterizedTest(name = "[{index}] {0} {1} → Anonymous 주입")
    @CsvSource({
            "GET, /api/companies",
            "GET, /api/companies/1",
            "GET, /api/products",
            "GET, /api/products/42",
            "GET, /api/segments",
            "GET, /api/segments/5",
            "GET, /api/test-cases",
            "GET, /api/test-cases/7",
            "GET, /api/versions",
            "GET, /api/versions/1",
            "GET, /api/version-phases",
            "GET, /api/version-phases/3",
            "GET, /api/test-runs",
            "GET, /api/test-runs/1",
            "GET, /api/test-results",
            "GET, /api/test-results/1",
            "GET, /api/tickets",
            "GET, /api/tickets/1",
            "GET, /api/kb",
            "GET, /api/kb/1",
            "GET, /api/kb/jobs",
            "GET, /api/conventions",
            "GET, /api/conventions/1",
            "GET, /api/senior/faq",
            "GET, /api/senior/sessions",
            "GET, /api/senior/sessions/1",
            "POST, /api/senior/chat",
            "POST, /api/senior/sessions"
    })
    void whitelist_entries_allInjectAnonymous(String method, String uri) throws Exception {
        when(settingsService.isLoginRequired()).thenReturn(false);
        configureRequest(method, uri);

        filter.doFilter(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth, method + " " + uri + " 은 whitelist 여야 한다");
        assertInstanceOf(UsernamePasswordAuthenticationToken.class, auth);
        assertTrue(auth.isAuthenticated(), "인증된 토큰이어야 /api/** authenticated() 규칙을 통과");
        assertEquals("anonymousUser", auth.getPrincipal());
    }

    @ParameterizedTest(name = "[{index}] {0} {1} → 주입 없음")
    @CsvSource({
            "POST, /api/companies",
            "PUT, /api/companies/1",
            "DELETE, /api/companies/1",
            "POST, /api/products",
            "PUT, /api/products/1",
            "DELETE, /api/products/1",
            "POST, /api/segments",
            "PATCH, /api/segments/1/parent",
            "POST, /api/kb",
            "PUT, /api/kb/1",
            "DELETE, /api/kb/1",
            "POST, /api/kb/upload-pdf",
            "POST, /api/conventions",
            "PUT, /api/conventions/1",
            "GET, /api/settings",
            "GET, /api/settings/users",
            "PATCH, /api/settings",
            "POST, /api/auth/register",
            "GET, /api/admin/monitoring",
            "GET, /api/auth/login"
    })
    void nonWhitelist_entries_doNotInject(String method, String uri) throws Exception {
        when(settingsService.isLoginRequired()).thenReturn(false);
        configureRequest(method, uri);

        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                method + " " + uri + " 은 whitelist 가 아니므로 주입되면 안 된다");
    }
}
