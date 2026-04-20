package com.myqaweb.monitoring;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * HTTP request logging filter for API access statistics.
 * Registered as a bean in SecurityConfig (not @Component) to avoid
 * being auto-scanned in @WebMvcTest contexts.
 */
@RequiredArgsConstructor
public class ApiAccessLogFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ApiAccessLogFilter.class);

    private static final Map<String, String> URI_FEATURE_MAP = Map.ofEntries(
            Map.entry("/api/senior", "SENIOR"),
            Map.entry("/api/kb", "KB"),
            Map.entry("/api/conventions", "CONVENTION"),
            Map.entry("/api/companies", "FEATURE"),
            Map.entry("/api/products", "FEATURE"),
            Map.entry("/api/segments", "FEATURE"),
            Map.entry("/api/test-cases", "FEATURE"),
            Map.entry("/api/test-runs", "FEATURE"),
            Map.entry("/api/test-results", "FEATURE"),
            Map.entry("/api/versions", "FEATURE"),
            Map.entry("/api/tickets", "FEATURE"),
            Map.entry("/api/test-studio", "TEST_STUDIO"),
            Map.entry("/api/auth", "AUTH"),
            Map.entry("/api/admin", "ADMIN")
    );

    private final ApiAccessLogRepository repository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        long startMs = System.currentTimeMillis();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMs = System.currentTimeMillis() - startMs;
            logAccessAsync(request, response, durationMs);
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        // Skip non-API, actuator, and SSE streaming endpoints (response already committed)
        return !uri.startsWith("/api/")
                || uri.startsWith("/actuator/")
                || uri.equals("/api/senior/chat");
    }

    private void logAccessAsync(HttpServletRequest request, HttpServletResponse response, long durationMs) {
        try {
            ApiAccessLogEntity entity = new ApiAccessLogEntity();
            entity.setMethod(request.getMethod());
            entity.setUri(truncateUri(request.getRequestURI()));
            entity.setFeature(resolveFeature(request.getRequestURI()));
            entity.setStatusCode(response.getStatus());
            entity.setDurationMs(durationMs);
            entity.setUsername(getCurrentUsername());
            entity.setCreatedAt(LocalDateTime.now());
            repository.save(entity);
        } catch (Exception e) {
            log.warn("Failed to log API access: {}", e.getMessage());
        }
    }

    private String resolveFeature(String uri) {
        for (Map.Entry<String, String> entry : URI_FEATURE_MAP.entrySet()) {
            if (uri.startsWith(entry.getKey())) {
                return entry.getValue();
            }
        }
        return null;
    }

    private String getCurrentUsername() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                return auth.getName();
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private String truncateUri(String uri) {
        return uri.length() <= 500 ? uri : uri.substring(0, 500);
    }
}
