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
 * "Demo mode" semantics: when login_required=false, any unauthenticated /api/**
 * request gets anonymous authentication injected so downstream .authenticated()
 * passes. ADMIN-only protections (/api/settings/**, /api/admin/**,
 * /api/auth/register) remain in force via SecurityConfig's role matchers —
 * those are tested at the SecurityConfig / integration level, not here.
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
    @DisplayName("login_required=true 이면 어떤 경로라도 Anonymous 주입하지 않는다")
    void loginRequiredTrue_doesNotInjectAnonymous() throws Exception {
        when(settingsService.isLoginRequired()).thenReturn(true);
        configureRequest("GET", "/api/companies");

        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                "login_required=true 일 때는 어떠한 authentication도 주입되지 않아야 한다");
        assertSame(request, chain.getRequest(), "filterChain.doFilter는 항상 호출되어야 한다");
    }

    // --- login_required=false: all /api/** methods get anonymous injected ---

    @Test
    @DisplayName("login_required=false + 비인증 + GET /api/companies → Anonymous 주입")
    void loginRequiredFalse_getBrowse_injectsAnonymous() throws Exception {
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
    @DisplayName("login_required=false + POST /api/convention-images (이미지 등록) → Anonymous 주입")
    void loginRequiredFalse_writePost_injectsAnonymous() throws Exception {
        // Demo mode 에서는 이미지 업로드 같은 write 엔드포인트도 익명 허용해야 한다
        when(settingsService.isLoginRequired()).thenReturn(false);
        configureRequest("POST", "/api/convention-images");

        filter.doFilter(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth);
        assertInstanceOf(UsernamePasswordAuthenticationToken.class, auth);
        assertTrue(auth.isAuthenticated());
        assertEquals("anonymousUser", auth.getPrincipal());
    }

    @Test
    @DisplayName("login_required=false + 이미 인증된 사용자는 기존 authentication 유지, settingsService 호출도 안 함")
    void loginRequiredFalse_alreadyAuthenticated_doesNotReplace() throws Exception {
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
    @DisplayName("기존 AnonymousAuthenticationToken 이 있으면 새 anonymousUser 토큰으로 대체")
    void existingAnonymousToken_replacedByDemoAnonymous() throws Exception {
        Authentication existing = new AnonymousAuthenticationToken(
                "other-key", "someAnon",
                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
        SecurityContextHolder.getContext().setAuthentication(existing);
        when(settingsService.isLoginRequired()).thenReturn(false);
        configureRequest("GET", "/api/companies");

        filter.doFilter(request, response, chain);

        Authentication resulting = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(resulting);
        assertInstanceOf(UsernamePasswordAuthenticationToken.class, resulting);
        assertEquals("anonymousUser", resulting.getPrincipal());
    }

    @Test
    @DisplayName("isLoginRequired() 가 예외를 던져도 500 으로 전파되지 않고 login_required=true 로 폴백한다")
    void isLoginRequiredThrows_fallsBackToTrueAndDoesNotThrow() throws Exception {
        when(settingsService.isLoginRequired())
                .thenThrow(new RuntimeException("DB connection glitch"));
        configureRequest("GET", "/api/companies");

        // 예외가 전파되면 여기서 테스트가 실패한다 — 체인까지 통과해야 함
        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                "폴백은 login_required=true 이므로 Anonymous 주입이 일어나면 안 된다");
        assertSame(request, chain.getRequest(),
                "예외가 발생해도 filterChain 은 계속 진행되어야 한다");
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

    // --- non-/api paths: filter skipped via shouldNotFilter ---

    @Test
    @DisplayName("/api 외 경로는 shouldNotFilter 로 필터 자체 스킵 — Anonymous 주입 안 함")
    void nonApiPath_skippedViaShouldNotFilter() throws Exception {
        configureRequest("GET", "/favicon.svg");

        assertTrue(filter.shouldNotFilter(request),
                "/api 외 경로는 필터가 스킵되어야 한다");
    }

    // --- Parameterized: any /api/** method injects anonymous under demo mode ---

    @ParameterizedTest(name = "[{index}] {0} {1} → Anonymous 주입 (demo mode)")
    @CsvSource({
            // reads
            "GET, /api/companies",
            "GET, /api/products/42",
            "GET, /api/test-cases/7",
            "GET, /api/kb",
            "GET, /api/conventions/1",
            "GET, /api/senior/faq",
            // writes — previously whitelist-blocked, now allowed in demo mode
            "POST, /api/companies",
            "PUT, /api/companies/1",
            "DELETE, /api/companies/1",
            "POST, /api/products",
            "POST, /api/kb",
            "PUT, /api/kb/1",
            "DELETE, /api/kb/1",
            "POST, /api/conventions",
            "POST, /api/convention-images",
            "POST, /api/feature-images",
            "POST, /api/kb/images",
            "POST, /api/senior/chat",
            "POST, /api/senior/sessions",
            "POST, /api/test-cases",
            "PATCH, /api/segments/1/parent",
            // uploads that spend budget
            "POST, /api/kb/upload-pdf"
    })
    void anyApiPath_getsAnonymousInjectedInDemoMode(String method, String uri) throws Exception {
        when(settingsService.isLoginRequired()).thenReturn(false);
        configureRequest(method, uri);

        filter.doFilter(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(auth, method + " " + uri + " 는 demo mode 에서 익명 허용이어야 한다");
        assertInstanceOf(UsernamePasswordAuthenticationToken.class, auth);
        assertTrue(auth.isAuthenticated(), "인증된 토큰이어야 /api/** authenticated() 규칙을 통과");
        assertEquals("anonymousUser", auth.getPrincipal());
    }

    // --- Parameterized: login_required=true reverts to standard behavior ---

    @ParameterizedTest(name = "[{index}] {0} {1} → 주입 없음 (login_required=true)")
    @CsvSource({
            "GET, /api/companies",
            "POST, /api/companies",
            "POST, /api/convention-images",
            "GET, /api/settings",
            "PATCH, /api/settings"
    })
    void loginRequiredTrue_noInjectionRegardlessOfPath(String method, String uri) throws Exception {
        when(settingsService.isLoginRequired()).thenReturn(true);
        configureRequest(method, uri);

        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                "login_required=true 에서는 어떤 경로도 익명 주입 금지");
    }
}
