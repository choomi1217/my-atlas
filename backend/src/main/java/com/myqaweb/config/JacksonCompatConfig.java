package com.myqaweb.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Spring Boot 4 auto-configures a Jackson 3 mapper as the primary JSON bean and no
 * longer registers a Jackson 2 {@code com.fasterxml.jackson.databind.ObjectMapper} bean.
 *
 * <p>Several services here still depend on Jackson 2's {@code ObjectMapper} via constructor
 * injection — notably the LLM-response parsers ({@code TestStudioGenerator},
 * {@code KbContentCleanupService}, {@code TestCaseServiceImpl}) with truncation-recovery
 * logic, plus {@code SlackNotifierService} and {@code AiRateLimitFilter}. Registering an
 * explicit Jackson 2 mapper keeps those injections resolving while Spring MVC uses the
 * Boot 4 Jackson 3 mapper for HTTP message conversion (Jackson 2/3 coexistence).
 *
 * <p>The mapper mirrors Spring Boot's historical Jackson 2 defaults: auto-registered
 * modules (incl. {@code jackson-datatype-jsr310} for {@code java.time}) and ISO-8601
 * dates instead of numeric timestamps.
 */
@Configuration
public class JacksonCompatConfig {

    @Bean
    public ObjectMapper jackson2ObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.findAndRegisterModules();
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }
}
