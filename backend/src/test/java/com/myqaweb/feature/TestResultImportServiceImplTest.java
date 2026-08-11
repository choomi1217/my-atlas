package com.myqaweb.feature;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TestResultImportServiceImplTest {

    @Mock private VersionPhaseRepository versionPhaseRepository;
    @Mock private TestResultRepository testResultRepository;

    @InjectMocks private TestResultImportServiceImpl service;

    private TestResultEntity resultWithTitle(String title, RunResultStatus status) {
        TestCaseEntity tc = new TestCaseEntity();
        tc.setTitle(title);
        TestResultEntity r = new TestResultEntity();
        r.setTestCase(tc);
        r.setStatus(status);
        return r;
    }

    private static final String XML = """
            <testsuites>
              <testsuite name="ui" tests="3" failures="1">
                <testcase name="로그인 성공" classname="ui.login" time="1.2"/>
                <testcase name="회사 삭제" classname="ui.company" time="0.5">
                  <failure message="expected true">assertion failed</failure>
                </testcase>
                <testcase name="건너뛴 케이스" classname="ui.skip">
                  <skipped/>
                </testcase>
              </testsuite>
            </testsuites>
            """;

    @Test
    void import_matchesByTitle_recordsAsCI_withMappedStatus() {
        when(versionPhaseRepository.findById(42L)).thenReturn(Optional.of(new VersionPhaseEntity()));
        TestResultEntity loginRow = resultWithTitle("로그인 성공", RunResultStatus.UNTESTED);
        TestResultEntity deleteRow = resultWithTitle("회사 삭제", RunResultStatus.UNTESTED);
        when(testResultRepository.findAllByVersionPhaseId(42L)).thenReturn(List.of(loginRow, deleteRow));

        var res = service.importJUnitXml(42L, XML);

        assertThat(res.totalCases()).isEqualTo(3);
        assertThat(res.matched()).isEqualTo(2);   // "로그인 성공", "회사 삭제" (skipped one unmatched)
        assertThat(res.recorded()).isEqualTo(2);
        assertThat(res.unmatched()).containsExactly("건너뛴 케이스");

        // PASS 매핑 + CI 주체 검증
        assertThat(loginRow.getStatus()).isEqualTo(RunResultStatus.PASS);
        assertThat(loginRow.getExecutedBy()).isEqualTo(ExecutedBy.CI);
        // FAIL 매핑
        assertThat(deleteRow.getStatus()).isEqualTo(RunResultStatus.FAIL);
        assertThat(deleteRow.getExecutedBy()).isEqualTo(ExecutedBy.CI);

        verify(testResultRepository, times(2)).save(any());
    }

    @Test
    void import_titleMatchIsCaseAndSpaceInsensitive() {
        when(versionPhaseRepository.findById(42L)).thenReturn(Optional.of(new VersionPhaseEntity()));
        // 저장된 제목은 공백/대소문자 차이
        TestResultEntity row = resultWithTitle("  로그인 성공  ", RunResultStatus.UNTESTED);
        when(testResultRepository.findAllByVersionPhaseId(42L)).thenReturn(List.of(row));

        var res = service.importJUnitXml(42L, XML);

        assertThat(res.matched()).isEqualTo(1);
        assertThat(row.getStatus()).isEqualTo(RunResultStatus.PASS);
    }

    @Test
    void import_noMatch_reportsAllUnmatched() {
        when(versionPhaseRepository.findById(42L)).thenReturn(Optional.of(new VersionPhaseEntity()));
        when(testResultRepository.findAllByVersionPhaseId(42L)).thenReturn(List.of(
                resultWithTitle("무관한 TC", RunResultStatus.UNTESTED)));

        var res = service.importJUnitXml(42L, XML);

        assertThat(res.matched()).isZero();
        assertThat(res.recorded()).isZero();
        assertThat(res.unmatched()).hasSize(3);
        verify(testResultRepository, never()).save(any());
    }

    @Test
    void import_malformedXml_throws() {
        when(versionPhaseRepository.findById(42L)).thenReturn(Optional.of(new VersionPhaseEntity()));
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                () -> service.importJUnitXml(42L, "<not-closed>"));
    }
}
