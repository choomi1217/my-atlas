package com.myqaweb.feature;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

/**
 * Jira REST API v2 implementation.
 */
@Service
public class JiraServiceImpl implements JiraService {

    private static final Logger log = LoggerFactory.getLogger(JiraServiceImpl.class);

    private final JiraConfig config;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public JiraServiceImpl(JiraConfig config) {
        this.config = config;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public boolean isConfigured() {
        return StringUtils.hasText(config.getBaseUrl())
                && StringUtils.hasText(config.getEmail())
                && StringUtils.hasText(config.getApiKey());
    }

    @Override
    public JiraIssueInfo createIssue(String projectKey, String summary, String description) {
        String url = config.getBaseUrl() + "/rest/api/2/issue";

        Map<String, Object> body = Map.of(
                "fields", Map.of(
                        "project", Map.of("key", projectKey),
                        "summary", summary,
                        "description", description != null ? description : "",
                        "issuetype", Map.of("id", config.getIssueTypeId())
                )
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, createHeaders());
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, request, String.class);

        try {
            JsonNode node = objectMapper.readTree(response.getBody());
            String key = node.get("key").asText();
            String issueUrl = config.getBaseUrl() + "/browse/" + key;
            log.info("Jira issue created: {}", key);
            return new JiraIssueInfo(key, issueUrl);
        } catch (Exception e) {
            throw new RuntimeException("Jira 이슈 생성 응답 파싱 실패", e);
        }
    }

    @Override
    public String getIssueStatus(String jiraKey) {
        String url = config.getBaseUrl() + "/rest/api/2/issue/" + jiraKey + "?fields=status";

        HttpEntity<Void> request = new HttpEntity<>(createHeaders());
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);

        try {
            JsonNode node = objectMapper.readTree(response.getBody());
            return node.get("fields").get("status").get("name").asText();
        } catch (Exception e) {
            throw new RuntimeException("Jira 이슈 상태 조회 실패: " + jiraKey, e);
        }
    }

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String auth = config.getEmail() + ":" + config.getApiKey();
        String encoded = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
        headers.set("Authorization", "Basic " + encoded);
        return headers;
    }
}
