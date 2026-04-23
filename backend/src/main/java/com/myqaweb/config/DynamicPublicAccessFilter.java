package com.myqaweb.config;

import com.myqaweb.settings.SettingsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Runtime-configurable public access filter ("demo mode" toggle).
 *
 * When login_required=false AND the request has no authentication, injects a
 * UsernamePasswordAuthenticationToken with principal "anonymousUser" for any
 * /api/** request so that Spring Security's .authenticated() rule passes.
 *
 * ADMIN-only paths remain protected because SecurityConfig declares explicit
 * .hasRole("ADMIN") for /api/settings/**, /api/admin/**, /api/auth/register
 * BEFORE the generic .authenticated() rule — those matchers reject the
 * ROLE_ANONYMOUS authority regardless of this injection.
 *
 * Note: AnonymousAuthenticationToken would be rejected by .authenticated()
 * in Spring Security 6 (trustResolver flags it as anonymous), so we use
 * UsernamePasswordAuthenticationToken which is treated as fully authenticated.
 */
public class DynamicPublicAccessFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(DynamicPublicAccessFilter.class);

    public static final String ANONYMOUS_PRINCIPAL = "anonymousUser";

    private static final List<SimpleGrantedAuthority> ANON_AUTHORITIES =
            List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"));

    private final SettingsService settingsService;

    public DynamicPublicAccessFilter(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Only gate /api/** — static assets, actuator, and SPA routes don't need anonymous injection.
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        Authentication existing = SecurityContextHolder.getContext().getAuthentication();
        boolean unauthenticated = existing == null || existing instanceof AnonymousAuthenticationToken;

        if (unauthenticated && !resolveLoginRequiredSafely()) {
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
}
