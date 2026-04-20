package com.myqaweb.config;

import com.myqaweb.auth.JwtAuthenticationFilter;
import com.myqaweb.auth.JwtProvider;
import com.myqaweb.monitoring.ApiAccessLogFilter;
import com.myqaweb.monitoring.ApiAccessLogRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           JwtAuthenticationFilter jwtAuthenticationFilter,
                                           ApiAccessLogFilter apiAccessLogFilter) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // 로그인은 누구나 접근 가능
                        .requestMatchers("/api/auth/login").permitAll()
                        // Actuator 헬스체크
                        .requestMatchers("/actuator/**").permitAll()
                        // 계정 생성은 ADMIN만
                        .requestMatchers("/api/auth/register").hasRole("ADMIN")
                        // 모니터링 API는 ADMIN만
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        // 이미지는 S3+CloudFront에서 서빙 (백엔드 GET 엔드포인트 제거됨)
                        // GET 요청은 ADMIN, USER 모두 허용
                        .requestMatchers(HttpMethod.GET, "/api/**").authenticated()
                        // 쓰기 요청(POST/PUT/PATCH/DELETE)은 ADMIN만
                        .requestMatchers(HttpMethod.POST, "/api/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/**").hasRole("ADMIN")
                        // 나머지는 인증 필요
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(apiAccessLogFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
