package com.myqaweb.feature;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TestResultImportServiceImpl implements TestResultImportService {

    private static final Logger log = LoggerFactory.getLogger(TestResultImportServiceImpl.class);

    private final VersionPhaseRepository versionPhaseRepository;
    private final TestResultRepository testResultRepository;

    @Override
    @Transactional
    public TestResultImportDto.ImportResponse importJUnitXml(Long versionPhaseId, String junitXml) {
        VersionPhaseEntity phase = versionPhaseRepository.findById(versionPhaseId)
                .orElseThrow(() -> new EntityNotFoundException("VersionPhase not found: " + versionPhaseId));

        List<TestResultImportDto.ParsedCase> cases = parse(junitXml);

        // Phase의 TC 제목 → testCaseId 매핑 (Phase 생성 시 materialize된 test_result 기준)
        List<TestResultEntity> phaseResults = testResultRepository.findAllByVersionPhaseId(versionPhaseId);
        Map<String, TestResultEntity> byTitle = new HashMap<>();
        for (TestResultEntity r : phaseResults) {
            byTitle.put(normalize(r.getTestCase().getTitle()), r);
        }

        int matched = 0;
        int recorded = 0;
        List<String> unmatched = new ArrayList<>();
        for (TestResultImportDto.ParsedCase c : cases) {
            TestResultEntity tr = byTitle.get(normalize(c.name()));
            if (tr == null) {
                unmatched.add(c.name());
                continue;
            }
            matched++;
            tr.setStatus(c.status());
            tr.setExecutedBy(ExecutedBy.CI);
            tr.setExecutedAt(LocalDateTime.now());
            testResultRepository.save(tr);
            recorded++;
        }

        log.info("CI import: phase={}, cases={}, matched={}, recorded={}, unmatched={}",
                versionPhaseId, cases.size(), matched, recorded, unmatched.size());
        return new TestResultImportDto.ImportResponse(cases.size(), matched, recorded, unmatched);
    }

    private String normalize(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    /** JUnit testsuites/testcase 파싱. failure/error → FAIL, skipped → SKIPPED, else PASS. */
    private List<TestResultImportDto.ParsedCase> parse(String xml) {
        List<TestResultImportDto.ParsedCase> out = new ArrayList<>();
        try {
            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            // XXE 방지
            dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
            dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            dbf.setXIncludeAware(false);
            dbf.setExpandEntityReferences(false);
            DocumentBuilder db = dbf.newDocumentBuilder();
            Document doc = db.parse(new InputSource(new StringReader(xml)));

            NodeList cases = doc.getElementsByTagName("testcase");
            for (int i = 0; i < cases.getLength(); i++) {
                Element tc = (Element) cases.item(i);
                String name = tc.getAttribute("name");
                if (name == null || name.isBlank()) {
                    continue;
                }
                RunResultStatus status;
                if (tc.getElementsByTagName("failure").getLength() > 0
                        || tc.getElementsByTagName("error").getLength() > 0) {
                    status = RunResultStatus.FAIL;
                } else if (tc.getElementsByTagName("skipped").getLength() > 0) {
                    status = RunResultStatus.SKIPPED;
                } else {
                    status = RunResultStatus.PASS;
                }
                out.add(new TestResultImportDto.ParsedCase(name.trim(), status));
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("JUnit XML 파싱 실패: " + e.getMessage(), e);
        }
        return out;
    }
}
