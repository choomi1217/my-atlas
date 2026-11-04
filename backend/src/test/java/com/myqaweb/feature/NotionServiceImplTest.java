package com.myqaweb.feature;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.myqaweb.common.ExternalServiceException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

/**
 * NotionServiceImpl against a mocked Notion API (MockRestServiceServer bound to the service's own RestTemplate).
 */
class NotionServiceImplTest {

    private static final String TOKEN = "secret_notion_token_abc123";
    private static final String DB_ID = "prd-db-123";
    private static final String PAGES_URL = "https://api.notion.com/v1/pages";
    private static final String CREATED = "{\"id\":\"page-1\",\"url\":\"https://www.notion.so/page-1\"}";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private NotionConfig config;
    private NotionServiceImpl service;
    private MockRestServiceServer server;

    @BeforeEach
    void setUp() {
        config = new NotionConfig();
        config.setApiKey(TOKEN);
        config.setBugDatabaseId(DB_ID);
        service = new NotionServiceImpl(config);
        RestTemplate restTemplate = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        server = MockRestServiceServer.bindTo(restTemplate).build();
    }

    private NotionService.BugReport fullReport(TicketPriority priority) {
        return new NotionService.BugReport(
                "Login fails",
                priority,
                Arrays.asList("로그인 페이지 진입", "", null, "계정 보유"),
                "https://atlas.example.com/phases/10",
                List.of("Company : Acme", "Product : Shop", "Version : v1.0", "Phase : 1차", "TC : T42 로그인"),
                List.of("ID 입력 → 입력됨", "로그인 클릭"),
                List.of("메인 화면 이동"),
                List.of("[AI FAIL] #2 FAIL: 버튼 없음"),
                "재현 메모");
    }

    private NotionService.BugReport emptyReport() {
        return new NotionService.BugReport("Bug", TicketPriority.MEDIUM,
                null, null, List.of(), Arrays.asList(" ", null), null, List.of(""), "  ");
    }

    /** Runs createBugPage against a successful response and returns the parsed request body. */
    private JsonNode createAndCaptureBody(NotionService.BugReport report) throws IOException {
        AtomicReference<String> body = new AtomicReference<>();
        server.expect(requestTo(PAGES_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer " + TOKEN))
                .andExpect(header("Notion-Version", "2022-06-28"))
                .andExpect(request -> body.set(((MockClientHttpRequest) request).getBodyAsString()))
                .andRespond(withSuccess(CREATED, MediaType.APPLICATION_JSON));

        service.createBugPage(report);

        server.verify();
        return objectMapper.readTree(body.get());
    }

    /** "type:content" for each child block. */
    private List<String> blocks(JsonNode body) {
        List<String> out = new ArrayList<>();
        for (JsonNode block : body.path("children")) {
            String type = block.path("type").asText();
            out.add(type + ":" + richText(block).path("text").path("content").asText());
        }
        return out;
    }

    private JsonNode richText(JsonNode block) {
        return block.path(block.path("type").asText()).path("rich_text").get(0);
    }

    // --- createBugPage: request ---

    @Test
    void testCreateBugPage_ParentPropertiesAndIcon() throws IOException {
        JsonNode body = createAndCaptureBody(fullReport(TicketPriority.HIGH));

        assertEquals(DB_ID, body.path("parent").path("database_id").asText());
        assertEquals("emoji", body.path("icon").path("type").asText());
        assertEquals("🐞", body.path("icon").path("emoji").asText());

        JsonNode props = body.path("properties");
        assertEquals("Login fails",
                props.path("무엇을 개발할 것인가").path("title").get(0).path("text").path("content").asText());
        assertEquals("Bug", props.path("Scope").path("select").path("name").asText());
        assertEquals("Waiting...", props.path("Status").path("select").path("name").asText());
        assertEquals("High", props.path("우선순위").path("select").path("name").asText());
    }

    @ParameterizedTest
    @CsvSource({"HIGHEST,Highest", "HIGH,High", "MEDIUM,Mid", "LOW,Low", "LOWEST,Low"})
    void testCreateBugPage_PriorityMapping(TicketPriority priority, String notionPriority) throws IOException {
        JsonNode body = createAndCaptureBody(fullReport(priority));

        assertEquals(notionPriority, body.path("properties").path("우선순위").path("select").path("name").asText());
    }

    @Test
    void testCreateBugPage_BodySectionsInOrder() throws IOException {
        JsonNode body = createAndCaptureBody(fullReport(TicketPriority.HIGH));

        assertEquals(List.of(
                "heading_3:PreCondition",
                "bulleted_list_item:로그인 페이지 진입",
                "bulleted_list_item:계정 보유",
                "heading_3:Test Data",
                "bulleted_list_item:Company : Acme",
                "bulleted_list_item:Product : Shop",
                "bulleted_list_item:Version : v1.0",
                "bulleted_list_item:Phase : 1차",
                "bulleted_list_item:TC : T42 로그인",
                "heading_3:Steps",
                "numbered_list_item:ID 입력 → 입력됨",
                "numbered_list_item:로그인 클릭",
                "heading_3:Expected Result",
                "bulleted_list_item:메인 화면 이동",
                "heading_3:Actual Result",
                "bulleted_list_item:[AI FAIL] #2 FAIL: 버튼 없음",
                "heading_3:Memo",
                "paragraph:재현 메모"), blocks(body));
        for (JsonNode block : body.path("children")) {
            assertEquals("block", block.path("object").asText());
        }
    }

    @Test
    void testCreateBugPage_OnlyFirstTestDataItemLinked() throws IOException {
        JsonNode children = createAndCaptureBody(fullReport(TicketPriority.HIGH)).path("children");

        // index 3 = "Test Data" heading, 4 = first item, 5 = second item
        assertEquals("https://atlas.example.com/phases/10",
                richText(children.get(4)).path("text").path("link").path("url").asText());
        assertFalse(richText(children.get(5)).path("text").has("link"));
        assertFalse(richText(children.get(1)).path("text").has("link"));
        assertFalse(richText(children.get(3)).path("text").has("link"));
    }

    @Test
    void testCreateBugPage_EmptySectionsGetDash() throws IOException {
        JsonNode body = createAndCaptureBody(emptyReport());

        assertEquals(List.of(
                "heading_3:PreCondition",
                "bulleted_list_item:-",
                "heading_3:Test Data",
                "bulleted_list_item:-",
                "heading_3:Steps",
                "numbered_list_item:-",
                "heading_3:Expected Result",
                "bulleted_list_item:-",
                "heading_3:Actual Result",
                "bulleted_list_item:-",
                "heading_3:Memo",
                "paragraph:-"), blocks(body));
    }

    @Test
    void testCreateBugPage_EmptyTestDataWithLink_DashHasNoLink() throws IOException {
        NotionService.BugReport report = new NotionService.BugReport("Bug", TicketPriority.LOW,
                List.of(), "https://atlas.example.com/x", List.of(), List.of(), List.of(), List.of(), null);

        JsonNode children = createAndCaptureBody(report).path("children");

        assertEquals("-", richText(children.get(3)).path("text").path("content").asText());
        assertFalse(richText(children.get(3)).path("text").has("link"));
    }

    @Test
    void testCreateBugPage_TextTruncatedTo2000Chars() throws IOException {
        NotionService.BugReport report = new NotionService.BugReport("a".repeat(2500), TicketPriority.LOW,
                List.of(), null, List.of(), List.of("b".repeat(3000)), List.of(), List.of(), null);

        JsonNode body = createAndCaptureBody(report);

        String title = body.path("properties").path("무엇을 개발할 것인가").path("title").get(0)
                .path("text").path("content").asText();
        assertEquals(2000, title.length());
        String step = richText(body.path("children").get(5)).path("text").path("content").asText();
        assertEquals("b".repeat(2000), step);
    }

    @Test
    void testCreateBugPage_TruncationDoesNotSplitSurrogatePair() throws IOException {
        String text = "a".repeat(1999) + "😀" + "tail";
        NotionService.BugReport report = new NotionService.BugReport(text, TicketPriority.LOW,
                List.of(), null, List.of(), List.of(), List.of(), List.of(), null);

        JsonNode body = createAndCaptureBody(report);

        String title = body.path("properties").path("무엇을 개발할 것인가").path("title").get(0)
                .path("text").path("content").asText();
        assertEquals("a".repeat(1999), title);
    }

    @Test
    void testCreateBugPage_LongSectionIsCappedAndLaterSectionsSurvive() throws IOException {
        List<String> manySteps = IntStream.rangeClosed(1, 150).mapToObj(i -> "step " + i).toList();
        NotionService.BugReport report = new NotionService.BugReport("Bug", TicketPriority.LOW,
                List.of("pre"), null, List.of("data"), manySteps, List.of("exp"), List.of("act"), "memo");

        List<String> blocks = blocks(createAndCaptureBody(report));

        // 5 short sections (heading + 1) + Steps (heading + 14 steps + overflow line)
        assertEquals(26, blocks.size());
        assertTrue(blocks.contains("numbered_list_item:step 14"));
        assertFalse(blocks.contains("numbered_list_item:step 15"));
        assertTrue(blocks.contains("numbered_list_item:… 외 136개"));
        assertTrue(blocks.contains("bulleted_list_item:act"));
        assertTrue(blocks.contains("heading_3:Memo"));
    }

    // --- createBugPage: response ---

    @Test
    void testCreateBugPage_ReturnsIdAndUrl() {
        server.expect(requestTo(PAGES_URL))
                .andRespond(withSuccess(CREATED, MediaType.APPLICATION_JSON));

        NotionService.NotionPage page = service.createBugPage(fullReport(TicketPriority.HIGH));

        assertEquals("page-1", page.id());
        // id-based link, not the response url (which embeds a title slug)
        assertEquals("https://www.notion.so/page1", page.url());
    }

    @Test
    void testCreateBugPage_ResponseWithoutId_Throws() {
        server.expect(requestTo(PAGES_URL))
                .andRespond(withSuccess("{\"object\":\"page\"}", MediaType.APPLICATION_JSON));

        ExternalServiceException ex = assertThrows(ExternalServiceException.class,
                () -> service.createBugPage(fullReport(TicketPriority.HIGH)));
        assertTrue(ex.getMessage().startsWith("Notion 연동 실패: "));
    }

    @Test
    void testCreateBugPage_404_MessageHasStatusAndNotionMessageButNoToken() {
        server.expect(requestTo(PAGES_URL))
                .andRespond(withStatus(HttpStatus.NOT_FOUND)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"object\":\"error\",\"status\":404,\"code\":\"object_not_found\","
                                + "\"message\":\"Could not find database\"}"));

        ExternalServiceException ex = assertThrows(ExternalServiceException.class,
                () -> service.createBugPage(fullReport(TicketPriority.HIGH)));

        assertEquals("Notion 연동 실패: HTTP 404 — Could not find database", ex.getMessage());
        assertFalse(ex.getMessage().contains(TOKEN));
    }

    @Test
    void testCreateBugPage_500NonJsonBody_StatusOnly() {
        server.expect(requestTo(PAGES_URL))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR).body("<html>oops</html>"));

        ExternalServiceException ex = assertThrows(ExternalServiceException.class,
                () -> service.createBugPage(fullReport(TicketPriority.HIGH)));

        assertEquals("Notion 연동 실패: HTTP 500", ex.getMessage());
    }

    @Test
    void testCreateBugPage_NetworkError_NoTokenInMessage() {
        server.expect(requestTo(PAGES_URL))
                .andRespond(withException(new IOException("Connection refused " + TOKEN)));

        ExternalServiceException ex = assertThrows(ExternalServiceException.class,
                () -> service.createBugPage(fullReport(TicketPriority.HIGH)));

        assertTrue(ex.getMessage().startsWith("Notion 연동 실패: "));
        assertFalse(ex.getMessage().contains(TOKEN));
    }

    // --- getStatus ---

    @Test
    void testGetStatus_ReturnsStatusSelectName() {
        server.expect(requestTo(PAGES_URL + "/page-1"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("Authorization", "Bearer " + TOKEN))
                .andExpect(header("Notion-Version", "2022-06-28"))
                .andRespond(withSuccess("{\"properties\":{\"Status\":{\"type\":\"select\",\"select\":{\"name\":\"Done\"}}}}",
                        MediaType.APPLICATION_JSON));

        assertEquals("Done", service.getStatus("page-1"));
        server.verify();
    }

    @Test
    void testGetStatus_MissingStatus_Throws() {
        server.expect(requestTo(PAGES_URL + "/page-1"))
                .andRespond(withSuccess("{\"properties\":{}}", MediaType.APPLICATION_JSON));

        assertThrows(ExternalServiceException.class, () -> service.getStatus("page-1"));
    }

    @Test
    void testGetStatus_401_NoTokenInMessage() {
        server.expect(requestTo(PAGES_URL + "/page-1"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"message\":\"API token is invalid.\"}"));

        ExternalServiceException ex = assertThrows(ExternalServiceException.class, () -> service.getStatus("page-1"));

        assertEquals("Notion 연동 실패: HTTP 401 — API token is invalid.", ex.getMessage());
        assertFalse(ex.getMessage().contains(TOKEN));
    }

    // --- isConfigured ---

    @Test
    void testIsConfigured_BothSet_True() {
        assertTrue(service.isConfigured());
    }

    @Test
    void testIsConfigured_BlankApiKey_False() {
        config.setApiKey(" ");
        assertFalse(service.isConfigured());
    }

    @Test
    void testIsConfigured_MissingDatabaseId_False() {
        config.setBugDatabaseId(null);
        assertFalse(service.isConfigured());
    }
}
