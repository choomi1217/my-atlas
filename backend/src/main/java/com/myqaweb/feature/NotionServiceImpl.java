package com.myqaweb.feature;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.common.ExternalServiceException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Notion REST API implementation. Never logs or reports the token or request headers.
 */
@Service
public class NotionServiceImpl implements NotionService {

    private static final String BASE_URL = "https://api.notion.com/v1";
    private static final String NOTION_VERSION = "2022-06-28";
    private static final String FAILURE_PREFIX = "Notion 연동 실패: ";

    private static final String PROP_TITLE = "무엇을 개발할 것인가";
    private static final String PROP_SCOPE = "Scope";
    private static final String PROP_STATUS = "Status";
    private static final String PROP_PRIORITY = "우선순위";
    private static final String SCOPE_BUG = "Bug";
    private static final String ICON_BUG = "🐞";

    private static final String BLOCK_HEADING = "heading_3";
    private static final String BLOCK_BULLET = "bulleted_list_item";
    private static final String BLOCK_NUMBERED = "numbered_list_item";
    private static final String BLOCK_PARAGRAPH = "paragraph";
    private static final String EMPTY_ITEM = "-";

    private static final String PAGE_URL_PREFIX = "https://www.notion.so/";

    private static final int MAX_TEXT_LENGTH = 2000;
    // 6 sections x (heading + 15 items) = 96 blocks, under Notion's 100-children limit, so no section is dropped
    private static final int MAX_SECTION_ITEMS = 15;

    private final NotionConfig config;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public NotionServiceImpl(NotionConfig config) {
        this.config = config;
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public boolean isConfigured() {
        return StringUtils.hasText(config.getApiKey())
                && StringUtils.hasText(config.getBugDatabaseId());
    }

    @Override
    public NotionPage createBugPage(BugReport report) {
        Map<String, Object> body = Map.of(
                "parent", Map.of("database_id", config.getBugDatabaseId()),
                "icon", Map.of("type", "emoji", "emoji", ICON_BUG),
                "properties", Map.of(
                        PROP_TITLE, Map.of("title", List.of(text(report.title(), null))),
                        PROP_SCOPE, select(SCOPE_BUG),
                        PROP_STATUS, select(STATUS_WAITING),
                        PROP_PRIORITY, select(toNotionPriority(report.priority()))),
                "children", buildBlocks(report));

        JsonNode node = call(BASE_URL + "/pages", HttpMethod.POST, body);
        String id = node.path("id").asText();
        if (!StringUtils.hasText(id)) {
            throw new ExternalServiceException(FAILURE_PREFIX + "응답에 페이지 정보가 없습니다");
        }
        // The response url embeds a title slug and can outgrow ticket.issue_url (500); an id link is short and stable
        return new NotionPage(id, PAGE_URL_PREFIX + id.replace("-", ""));
    }

    @Override
    public String getStatus(String pageId) {
        JsonNode node = call(BASE_URL + "/pages/" + pageId, HttpMethod.GET, null);
        String status = node.path("properties").path(PROP_STATUS).path("select").path("name").asText();
        if (!StringUtils.hasText(status)) {
            throw new ExternalServiceException(FAILURE_PREFIX + "Status 속성을 읽을 수 없습니다");
        }
        return status;
    }

    private JsonNode call(String url, HttpMethod method, Map<String, Object> body) {
        try {
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, createHeaders());
            ResponseEntity<String> response = restTemplate.exchange(url, method, request, String.class);
            return objectMapper.readTree(response.getBody());
        } catch (HttpStatusCodeException e) {
            throw new ExternalServiceException(FAILURE_PREFIX + "HTTP " + e.getStatusCode().value() + notionMessage(e));
        } catch (RestClientException e) {
            throw new ExternalServiceException(FAILURE_PREFIX + e.getClass().getSimpleName());
        } catch (JsonProcessingException e) {
            throw new ExternalServiceException(FAILURE_PREFIX + "응답 파싱 실패");
        }
    }

    /** Notion's error message (no secrets) — shows setup problems such as a DB not shared with the integration. */
    private String notionMessage(HttpStatusCodeException e) {
        try {
            String message = objectMapper.readTree(e.getResponseBodyAsString()).path("message").asText();
            return StringUtils.hasText(message) ? " — " + message : "";
        } catch (JsonProcessingException ignored) {
            return "";
        }
    }

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(config.getApiKey());
        headers.set("Notion-Version", NOTION_VERSION);
        return headers;
    }

    private List<Map<String, Object>> buildBlocks(BugReport report) {
        List<Map<String, Object>> blocks = new ArrayList<>();
        addSection(blocks, "PreCondition", BLOCK_BULLET, report.preconditions(), null);
        addSection(blocks, "Test Data", BLOCK_BULLET, report.testData(), report.testDataLink());
        addSection(blocks, "Steps", BLOCK_NUMBERED, report.steps(), null);
        addSection(blocks, "Expected Result", BLOCK_BULLET, report.expected(), null);
        addSection(blocks, "Actual Result", BLOCK_BULLET, report.actual(), null);
        List<String> memo = StringUtils.hasText(report.memo()) ? List.of(report.memo()) : List.of();
        addSection(blocks, "Memo", BLOCK_PARAGRAPH, memo, null);
        return blocks;
    }

    /** Adds a heading_3 followed by one block per non-blank item ("-" when none); the first item links to firstItemLink. */
    private void addSection(List<Map<String, Object>> blocks, String heading, String itemType,
                            List<String> rawItems, String firstItemLink) {
        blocks.add(block(BLOCK_HEADING, text(heading, null)));
        List<String> items = rawItems == null ? List.of() : rawItems.stream().filter(StringUtils::hasText).toList();
        if (items.size() > MAX_SECTION_ITEMS) {
            List<String> kept = new ArrayList<>(items.subList(0, MAX_SECTION_ITEMS - 1));
            kept.add("… 외 " + (items.size() - kept.size()) + "개");
            items = kept;
        }
        if (items.isEmpty()) {
            blocks.add(block(itemType, text(EMPTY_ITEM, null)));
            return;
        }
        for (int i = 0; i < items.size(); i++) {
            blocks.add(block(itemType, text(items.get(i), i == 0 ? firstItemLink : null)));
        }
    }

    private Map<String, Object> block(String type, Map<String, Object> richText) {
        return Map.of("object", "block", "type", type, type, Map.of("rich_text", List.of(richText)));
    }

    private Map<String, Object> text(String content, String link) {
        String value = truncate(content);
        Map<String, Object> text = link == null
                ? Map.of("content", value)
                : Map.of("content", value, "link", Map.of("url", link));
        return Map.of("type", "text", "text", text);
    }

    private String truncate(String content) {
        if (content.length() <= MAX_TEXT_LENGTH) return content;
        int end = Character.isHighSurrogate(content.charAt(MAX_TEXT_LENGTH - 1))
                ? MAX_TEXT_LENGTH - 1 : MAX_TEXT_LENGTH;
        return content.substring(0, end);
    }

    private Map<String, Object> select(String name) {
        return Map.of("select", Map.of("name", name));
    }

    private String toNotionPriority(TicketPriority priority) {
        return switch (priority) {
            case HIGHEST -> "Highest";
            case HIGH -> "High";
            case MEDIUM -> "Mid";
            case LOW, LOWEST -> "Low";
        };
    }
}
