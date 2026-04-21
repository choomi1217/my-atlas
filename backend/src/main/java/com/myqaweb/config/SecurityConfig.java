package com.myqaweb.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.auth.JwtAuthenticationFilter;
import com.myqaweb.auth.JwtProvider;
import com.myqaweb.monitoring.ApiAccessLogFilter;
import com.myqaweb.monitoring.ApiAccessLogRepository;
import com.myqaweb.settings.SettingsService;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter(JwtProvider jwtProvider) {
        return new JwtAuthenticationFilter(jwtProvider);
    }

    @Bean
    public ApiAccessLogFilter apiAccessLogFilter(ApiAccessLogRepository repository) {
        return new ApiAccessLogFilter(repository);
    }

    @Bean
    public DynamicPublicAccessFilter dynamicPublicAccessFilter(SettingsService settingsService) {
        return new DynamicPublicAccessFilter(settingsService);
    }

    @Bean
    public AiRateLimitFilter aiRateLimitFilter(SettingsService settingsService, ObjectMapper objectMapper) {
        return new AiRateLimitFilter(settingsService, objectMapper);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           JwtAuthenticationFilter jwtAuthenticationFilter,
                                           ApiAccessLogFilter apiAccessLogFilter,
                                           DynamicPublicAccessFilter dynamicPublicAccessFilter,
                                           AiRateLimitFilter aiRateLimitFilter) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // SSE/async 재dispatch는 원본 요청이 이미 인가를 통과했으므로 통과
                        // (그렇지 않으면 Senior Chat SSE 완료 시 AccessDeniedException 스택 트레이스가 반복 로깅됨)
                        .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR, DispatcherType.FORWARD, DispatcherType.INCLUDE).permitAll()
                        // 로그인은 누구나 접근 가능
                        .requestMatchers("/api/auth/login").permitAll()
                        // 공개 설정 조회 (loginRequired 플래그만)
                        .requestMatchers("/api/settings/public").permitAll()
                        // Actuator 헬스체크
                        .requestMatchers("/actuator/**").permitAll()
                        // 계정 생성은 ADMIN만
                        .requestMatchers("/api/auth/register").hasRole("ADMIN")
                        // 모니터링 API는 ADMIN만
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        // Settings는 ADMIN 전용
                        .requestMatchers("/api/settings/**").hasRole("ADMIN")
                        // 그 외 모든 API는 인증된 사용자 (ADMIN + USER 모두 CRUD 가능)
                        .requestMatchers("/api/**").authenticated()
                        // 나머지는 인증 필요
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(dynamicPublicAccessFilter, JwtAuthenticationFilter.class)
                .addFilterAfter(aiRateLimitFilter, DynamicPublicAccessFilter.class)
                .addFilterAfter(apiAccessLogFilter, AiRateLimitFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
