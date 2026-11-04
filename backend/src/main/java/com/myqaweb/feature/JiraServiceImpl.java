package com.myqaweb.feature;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.common.ExternalServiceException;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Jira REST API v2 implementation.
 */
@Service
public class JiraServiceImpl implements JiraService {

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
    public String getIssueStatus(String jiraKey) {
        String url = config.getBaseUrl() + "/rest/api/2/issue/" + jiraKey + "?fields=status";

        HttpEntity<Void> request = new HttpEntity<>(createHeaders());
        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
            JsonNode node = objectMapper.readTree(response.getBody());
            return node.get("fields").get("status").get("name").asText();
        } catch (HttpStatusCodeException e) {
            throw new ExternalServiceException("Jira 연동 실패: HTTP " + e.getStatusCode().value());
        } catch (RestClientException e) {
            throw new ExternalServiceException("Jira 연동 실패: " + e.getClass().getSimpleName());
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
