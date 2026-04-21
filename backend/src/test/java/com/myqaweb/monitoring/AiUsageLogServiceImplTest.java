package com.myqaweb.monitoring;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.verify;

/**
 * Unit tests for {@link AiUsageLogServiceImpl}.
 *
 * Note: {@code @Async} is ignored in unit tests (no Spring context),
 * so calls execute synchronously on the same thread.
 */
@ExtendWith(MockitoExtension.class)
class AiUsageLogServiceImplTest {

    @Mock
    private AiUsageLogRepository repository;

    @InjectMocks
    private AiUsageLogServiceImpl service;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // --- ipAddress handling ---

    @Test
    @DisplayName("logUsage(..., ipAddress) — ipAddress 가 엔티티에 저장된다")
    void logUsage_withIpAddress_persistsIt() {
        service.logUsage(AiFeature.SENIOR_CHAT, "ANTHROPIC", "claude-haiku-4-5-20251001",
                100, 50, 1000L, true, null, "203.0.113.7");

        ArgumentCaptor<AiUsageLogEntity> captor = ArgumentCaptor.forClass(AiUsageLogEntity.class);
        verify(repository).save(captor.capture());
        assertEquals("203.0.113.7", captor.getValue().getIpAddress());
        assertEquals("SENIOR_CHAT", captor.getValue().getFeature());
    }

    @Test
    @DisplayName("logUsage(..., ipAddress=null) — null 허용, 에러 없음")
    void logUsage_withNullIpAddress_allowed() {
        service.logUsage(AiFeature.SENIOR_CHAT, "ANTHROPIC", "claude-haiku-4-5-20251001",
                100, 50, 1000L, true, null, null);

        ArgumentCaptor<AiUsageLogEntity> captor = ArgumentCaptor.forClass(AiUsageLogEntity.class);
        verify(repository).save(captor.capture());
        assertNull(captor.getValue().getIpAddress());
    }

    @Test
    @DisplayName("레거시 logUsage 오버로드 — ipAddress 를 null 로 설정")
    void logUsage_legacyOverload_setsNullIpAddress() {
        service.logUsage(AiFeature.EMBEDDING_SENIOR, "OPENAI", "text-embedding-3-small",
                500, null, 200L, true, null);

        ArgumentCaptor<AiUsageLogEntity> captor = ArgumentCaptor.forClass(AiUsageLogEntity.class);
        verify(repository).save(captor.capture());
        assertNull(captor.getValue().getIpAddress());
        assertEquals("EMBEDDING_SENIOR", captor.getValue().getFeature());
    }

    @Test
    @DisplayName("ipAddress 가 50자 초과이면 50자로 잘린다")
    void logUsage_ipAddressTooLong_truncated() {
        String longIp = "x".repeat(200);
        service.logUsage(AiFeature.SENIOR_CHAT, "ANTHROPIC", "claude-haiku-4-5-20251001",
                10, 5, 100L, true, null, longIp);

        ArgumentCaptor<AiUsageLogEntity> captor = ArgumentCaptor.forClass(AiUsageLogEntity.class);
        verify(repository).save(captor.capture());
        assertEquals(50, captor.getValue().getIpAddress().length());
    }

    // --- username handling (SecurityContext) ---

    @Test
    @DisplayName("인증 사용자 이름이 엔티티에 저장")
    void logUsage_authenticatedUser_setsUsername() {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "alice", "pwd", List.of(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContextHolder.getContext().setAuthentication(auth);

        service.logUsage(AiFeature.SENIOR_CHAT, "ANTHROPIC", "claude-haiku-4-5-20251001",
                10, 5, 100L, true, null, "1.1.1.1");

        ArgumentCaptor<AiUsageLogEntity> captor = ArgumentCaptor.forClass(AiUsageLogEntity.class);
        verify(repository).save(captor.capture());
        assertEquals("alice", captor.getValue().getUsername());
    }

    @Test
    @DisplayName("Anonymous 사용자면 username 은 null")
    void logUsage_anonymousUser_nullUsername() {
        AnonymousAuthenticationToken anon = new AnonymousAuthenticationToken(
                "key", "anonymousUser",
                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
        SecurityContextHolder.getContext().setAuthentication(anon);

        service.logUsage(AiFeature.SENIOR_CHAT, "ANTHROPIC", "claude-haiku-4-5-20251001",
                10, 5, 100L, true, null, "1.1.1.1");

        ArgumentCaptor<AiUsageLogEntity> captor = ArgumentCaptor.forClass(AiUsageLogEntity.class);
        verify(repository).save(captor.capture());
        assertNull(captor.getValue().getUsername(),
                "Anonymous 사용자의 username 은 null 로 저장되어야 한다");
    }

    // --- cost calculation stays intact ---

    @Test
    @DisplayName("Anthropic 모델의 토큰 비용이 계산되어 엔티티에 저장된다")
    void logUsage_calculatesAnthropicCost() {
        service.logUsage(AiFeature.SENIOR_CHAT, "ANTHROPIC", "claude-haiku-4-5-20251001",
                1_000_000, 0, 100L, true, null, "1.1.1.1");

        ArgumentCaptor<AiUsageLogEntity> captor = ArgumentCaptor.forClass(AiUsageLogEntity.class);
        verify(repository).save(captor.capture());
        BigDecimal cost = captor.getValue().getEstimatedCost();
        assertNotNull(cost);
        // 1M input tokens × $1.00 per 1M tokens = $1.00
        assertEquals(0, new BigDecimal("1.000000").compareTo(cost),
                "1M input tokens 이면 $1.00 가 계산되어야 한다 — 실제값: " + cost);
    }

    @Test
    @DisplayName("unknown 모델은 cost 가 ZERO")
    void logUsage_unknownModel_zeroCost() {
        service.logUsage(AiFeature.SENIOR_CHAT, "ANTHROPIC", "unknown-model",
                100, 50, 100L, true, null, null);

        ArgumentCaptor<AiUsageLogEntity> captor = ArgumentCaptor.forClass(AiUsageLogEntity.class);
        verify(repository).save(captor.capture());
        assertEquals(0, BigDecimal.ZERO.compareTo(captor.getValue().getEstimatedCost()));
    }

    @Test
    @DisplayName("success=false + errorMessage 전달 시 엔티티에 반영")
    void logUsage_failureWithErrorMessage_persisted() {
        service.logUsage(AiFeature.SENIOR_CHAT, "ANTHROPIC", "claude-haiku-4-5-20251001",
                null, null, 200L, false, "429 Too Many Requests", "1.1.1.1");

        ArgumentCaptor<AiUsageLogEntity> captor = ArgumentCaptor.forClass(AiUsageLogEntity.class);
        verify(repository).save(captor.capture());
        assertFalse(captor.getValue().getSuccess());
        assertEquals("429 Too Many Requests", captor.getValue().getErrorMessage());
    }
}
