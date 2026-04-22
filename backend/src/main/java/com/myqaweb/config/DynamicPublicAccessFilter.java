package com.myqaweb.config;

import com.myqaweb.settings.SettingsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Runtime-configurable public access filter.
 * When login_required=false AND current context has no authentication AND the request
 * matches a read-only whitelist, injects a UsernamePasswordAuthenticationToken with
 * principal "anonymousUser" so the downstream `/api/**` authenticated() rule passes.
 * Note: AnonymousAuthenticationToken would be rejected by .authenticated() — we need
 * a token type that Spring Security treats as fully authenticated.
 */
public class DynamicPublicAccessFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(DynamicPublicAccessFilter.class);

    public static final String ANONYMOUS_PRINCIPAL = "anonymousUser";

    private static final List<SimpleGrantedAuthority> ANON_AUTHORITIES =
            List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"));

    private final SettingsService settingsService;
    private final List<AntPathRequestMatcher> whitelist;

    public DynamicPublicAccessFilter(SettingsService settingsService) {
        this.settingsService = settingsService;
        this.whitelist = List.of(
                // GET — read-only browsing
                new AntPathRequestMatcher("/api/companies/**", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/companies", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/products/**", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/products", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/segments/**", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/segments", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/test-cases/**", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/test-cases", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/versions/**", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/versions", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/version-phases/**", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/version-phases", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/test-runs/**", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/test-runs", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/test-results/**", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/test-results", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/tickets/**", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/tickets", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/kb/**", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/kb", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/conventions/**", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/conventions", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/senior/faq", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/senior/sessions/**", HttpMethod.GET.name()),
                new AntPathRequestMatcher("/api/senior/sessions", HttpMethod.GET.name()),
                // POST — AI try-out (rate limited downstream)
                new AntPathRequestMatcher("/api/senior/chat", HttpMethod.POST.name()),
                new AntPathRequestMatcher("/api/senior/sessions", HttpMethod.POST.name())
        );
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        Authentication existing = SecurityContextHolder.getContext().getAuthentication();
        boolean unauthenticated = existing == null || existing instanceof AnonymousAuthenticationToken;

        if (unauthenticated && !resolveLoginRequiredSafely() && matchesWhitelist(request)) {
            UsernamePasswordAuthenticationToken anonymous =
                    new UsernamePasswordAuthenticationToken(ANONYMOUS_PRINCIPAL, "N/A", ANON_AUTHORITIES);
            SecurityContextHolder.getContext().setAuthentication(anonymous);
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Reads login_required with a safe fallback. If the settings lookup throws (e.g. DB
     * connection glitch, Hibernate transaction issue during filter-chain execution), we
     * treat the app as "login required" so the request falls through to the standard
     * authenticated() rule instead of surfacing a 500 to the browser.
     */
    private boolean resolveLoginRequiredSafely() {
        try {
            return settingsService.isLoginRequired();
        } catch (Exception ex) {
            log.warn("isLoginRequired() failed — defaulting to true", ex);
            return true;
        }
    }

    private boolean matchesWhitelist(HttpServletRequest request) {
        for (AntPathRequestMatcher matcher : whitelist) {
            if (matcher.matches(request)) {
                return true;
            }
        }
        return false;
    }
}
