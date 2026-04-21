package com.myqaweb.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.myqaweb.common.ApiResponse;
import com.myqaweb.settings.SettingsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * IP-based fixed-window rate limiter for AI-heavy endpoints.
 * Only anonymous users are counted; authenticated users are exempt.
 */
public class AiRateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(AiRateLimitFilter.class);
    private static final String MESSAGE = "AI 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";

    private final SettingsService settingsService;
    private final ObjectMapper objectMapper;
    private final List<AntPathRequestMatcher> targets;

    private volatile int cachedWindowSeconds = -1;
    private volatile Cache<String, AtomicInteger> ipCounter;

    public AiRateLimitFilter(SettingsService settingsService, ObjectMapper objectMapper) {
        this.settingsService = settingsService;
        this.objectMapper = objectMapper;
        this.targets = List.of(
                new AntPathRequestMatcher("/api/senior/chat", HttpMethod.POST.name()),
                new AntPathRequestMatcher("/api/senior/sessions", HttpMethod.POST.name())
        );
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!isTarget(request) || isAuthenticatedUser()) {
            filterChain.doFilter(request, response);
            return;
        }

        int limit = settingsService.getAiRateLimitPerIp();
        int windowSeconds = settingsService.getAiRateLimitWindowSeconds();
        Cache<String, AtomicInteger> cache = getOrRebuildCache(windowSeconds);

        String ip = extractClientIp(request);
        AtomicInteger counter = cache.get(ip, k -> new AtomicInteger(0));
        int current = counter.incrementAndGet();

        if (current > limit) {
            writeRateLimitResponse(response, windowSeconds);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isTarget(HttpServletRequest request) {
        for (AntPathRequestMatcher matcher : targets) {
            if (matcher.matches(request)) {
                return true;
            }
        }
        return false;
    }

    private boolean isAuthenticatedUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        if (auth instanceof AnonymousAuthenticationToken) return false;
        // DynamicPublicAccessFilter injects a UsernamePasswordAuthenticationToken with
        // "anonymousUser" principal for public browsing — rate-limit those, not exempt.
        return !DynamicPublicAccessFilter.ANONYMOUS_PRINCIPAL.equals(auth.getPrincipal());
    }

    private Cache<String, AtomicInteger> getOrRebuildCache(int windowSeconds) {
        if (ipCounter == null || cachedWindowSeconds != windowSeconds) {
            synchronized (this) {
                if (ipCounter == null || cachedWindowSeconds != windowSeconds) {
                    ipCounter = Caffeine.newBuilder()
                            .expireAfterWrite(windowSeconds, TimeUnit.SECONDS)
                            .maximumSize(10_000)
                            .build();
                    cachedWindowSeconds = windowSeconds;
                }
            }
        }
        return ipCounter;
    }

    /**
     * Invalidates the counter cache. Called by SettingsService when rate limit config changes.
     */
    public synchronized void resetCounters() {
        if (ipCounter != null) {
            ipCounter.invalidateAll();
        }
        cachedWindowSeconds = -1;
    }

    private String extractClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
    }

    private void writeRateLimitResponse(HttpServletResponse response, int windowSeconds) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(windowSeconds));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        ApiResponse<Map<String, Integer>> body = new ApiResponse<>(
                false, MESSAGE, Map.of("retryAfterSeconds", windowSeconds));
        try {
            objectMapper.writeValue(response.getWriter(), body);
        } catch (IOException e) {
            log.warn("Failed to write rate-limit response", e);
            throw e;
        }
    }
}
