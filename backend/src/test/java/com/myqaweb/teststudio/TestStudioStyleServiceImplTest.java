package com.myqaweb.teststudio;

import com.myqaweb.feature.CompanyRepository;
import com.myqaweb.feature.Priority;
import com.myqaweb.feature.TestStep;
import com.myqaweb.feature.TestType;
import com.myqaweb.teststudio.TestStudioConfigDto.ConfigRequest;
import com.myqaweb.teststudio.TestStudioConfigDto.ConfigResponse;
import com.myqaweb.teststudio.TestStudioStyleExampleDto.ExampleRequest;
import com.myqaweb.teststudio.TestStudioStyleExampleDto.ExampleResponse;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.CreateRequest;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.ProfileResponse;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.RenameRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link TestStudioStyleServiceImpl}.
 * Covers 세트/예시 CRUD, config upsert+선택, 기본값 fallback, active-example 해석(Sample fallback).
 */
@ExtendWith(MockitoExtension.class)
class TestStudioStyleServiceImplTest {

    @Mock
    private TestStudioStyleProfileRepository profileRepository;
    @Mock
    private TestStudioStyleExampleRepository exampleRepository;
    @Mock
    private TestStudioConfigRepository configRepository;
    @Mock
    private CompanyRepository companyRepository;

    @InjectMocks
    private TestStudioStyleServiceImpl service;

    // --- fixtures ---

    private TestStudioStyleProfileEntity profile(Long id, Long companyId, String name) {
        TestStudioStyleProfileEntity p = new TestStudioStyleProfileEntity();
        p.setId(id);
        p.setCompanyId(companyId);
        p.setName(name);
        p.setCreatedAt(LocalDateTime.now());
        p.setUpdatedAt(LocalDateTime.now());
        return p;
    }

    private TestStudioStyleExampleEntity example(Long id, Long profileId, String title) {
        TestStudioStyleExampleEntity e = new TestStudioStyleExampleEntity();
        e.setId(id);
        e.setProfileId(profileId);
        e.setTitle(title);
        e.setSteps(List.of(new TestStep(1, "action", "expected")));
        e.setExpectedResults(List.of("ok"));
        e.setPriority(Priority.HIGH);
        e.setTestType(TestType.FUNCTIONAL);
        e.setSortOrder(0);
        e.setCreatedAt(LocalDateTime.now());
        e.setUpdatedAt(LocalDateTime.now());
        return e;
    }

    private ExampleRequest exampleRequest(String title) {
        return new ExampleRequest(title, "precond",
                List.of(new TestStep(1, "a", "e")), List.of("r"),
                Priority.MEDIUM, TestType.SMOKE, null);
    }

    // --- 세트(프로필) ---

    @Test
    void listProfiles_mapsWithExampleCount() {
        when(profileRepository.findAllByCompanyIdOrderByCreatedAtAsc(5L))
                .thenReturn(List.of(profile(1L, 5L, "세트A")));
        when(exampleRepository.countByProfileId(1L)).thenReturn(3L);

        List<ProfileResponse> result = service.listProfiles(5L);

        assertEquals(1, result.size());
        assertEquals("세트A", result.get(0).name());
        assertEquals(3L, result.get(0).exampleCount());
    }

    @Test
    void listProfiles_nullCompanyId_throws() {
        assertThrows(IllegalArgumentException.class, () -> service.listProfiles(null));
    }

    @Test
    void createProfile_success() {
        when(companyRepository.existsById(5L)).thenReturn(true);
        when(profileRepository.countByCompanyId(5L)).thenReturn(0L);
        when(profileRepository.save(any())).thenAnswer(inv -> {
            TestStudioStyleProfileEntity e = inv.getArgument(0);
            e.setId(1L);
            return e;
        });
        when(exampleRepository.countByProfileId(1L)).thenReturn(0L);

        ProfileResponse resp = service.createProfile(new CreateRequest(5L, "결제팀 스타일"));

        assertEquals(1L, resp.id());
        assertEquals("결제팀 스타일", resp.name());
        assertEquals(0L, resp.exampleCount());
    }

    @Test
    void createProfile_companyNotFound_throws() {
        when(companyRepository.existsById(99L)).thenReturn(false);
        assertThrows(IllegalArgumentException.class,
                () -> service.createProfile(new CreateRequest(99L, "x")));
        verify(profileRepository, never()).save(any());
    }

    @Test
    void createProfile_capExceeded_throws() {
        when(companyRepository.existsById(5L)).thenReturn(true);
        when(profileRepository.countByCompanyId(5L))
                .thenReturn((long) TestStudioStyleServiceImpl.MAX_PROFILES_PER_COMPANY);
        assertThrows(IllegalArgumentException.class,
                () -> service.createProfile(new CreateRequest(5L, "x")));
        verify(profileRepository, never()).save(any());
    }

    @Test
    void renameProfile_success() {
        when(profileRepository.findById(1L)).thenReturn(Optional.of(profile(1L, 5L, "old")));
        when(profileRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(exampleRepository.countByProfileId(1L)).thenReturn(0L);

        ProfileResponse resp = service.renameProfile(1L, new RenameRequest("new"));

        assertEquals("new", resp.name());
    }

    @Test
    void renameProfile_notFound_throws() {
        when(profileRepository.findById(9L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class,
                () -> service.renameProfile(9L, new RenameRequest("x")));
    }

    @Test
    void deleteProfile_success() {
        when(profileRepository.existsById(1L)).thenReturn(true);
        service.deleteProfile(1L);
        verify(profileRepository).deleteById(1L);
    }

    @Test
    void deleteProfile_notFound_throws() {
        when(profileRepository.existsById(9L)).thenReturn(false);
        assertThrows(IllegalArgumentException.class, () -> service.deleteProfile(9L));
        verify(profileRepository, never()).deleteById(any());
    }

    // --- 예시 TC ---

    @Test
    void listExamples_success() {
        when(profileRepository.findById(1L)).thenReturn(Optional.of(profile(1L, 5L, "s")));
        when(exampleRepository.findAllByProfileIdOrderBySortOrderAsc(1L))
                .thenReturn(List.of(example(10L, 1L, "예시1")));

        List<ExampleResponse> result = service.listExamples(1L);

        assertEquals(1, result.size());
        assertEquals("예시1", result.get(0).title());
        assertEquals(1L, result.get(0).profileId());
    }

    @Test
    void addExample_success() {
        when(profileRepository.findById(1L)).thenReturn(Optional.of(profile(1L, 5L, "s")));
        when(exampleRepository.countByProfileId(1L)).thenReturn(0L);
        when(exampleRepository.save(any())).thenAnswer(inv -> {
            TestStudioStyleExampleEntity e = inv.getArgument(0);
            e.setId(10L);
            return e;
        });

        ExampleResponse resp = service.addExample(1L, exampleRequest("[로그인] 성공"));

        assertEquals(10L, resp.id());
        assertEquals(1L, resp.profileId());
        assertEquals("[로그인] 성공", resp.title());
        assertEquals(0, resp.sortOrder(), "null sortOrder defaults to 0");
    }

    @Test
    void addExample_profileNotFound_throws() {
        when(profileRepository.findById(9L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class,
                () -> service.addExample(9L, exampleRequest("x")));
        verify(exampleRepository, never()).save(any());
    }

    @Test
    void addExample_capExceeded_throws() {
        when(profileRepository.findById(1L)).thenReturn(Optional.of(profile(1L, 5L, "s")));
        when(exampleRepository.countByProfileId(1L))
                .thenReturn((long) TestStudioStyleServiceImpl.MAX_EXAMPLES_PER_PROFILE);
        assertThrows(IllegalArgumentException.class,
                () -> service.addExample(1L, exampleRequest("x")));
        verify(exampleRepository, never()).save(any());
    }

    @Test
    void updateExample_success() {
        when(exampleRepository.findById(10L)).thenReturn(Optional.of(example(10L, 1L, "old")));
        when(exampleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ExampleResponse resp = service.updateExample(10L, exampleRequest("new title"));

        assertEquals("new title", resp.title());
    }

    @Test
    void updateExample_notFound_throws() {
        when(exampleRepository.findById(9L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class,
                () -> service.updateExample(9L, exampleRequest("x")));
    }

    @Test
    void deleteExample_notFound_throws() {
        when(exampleRepository.existsById(9L)).thenReturn(false);
        assertThrows(IllegalArgumentException.class, () -> service.deleteExample(9L));
        verify(exampleRepository, never()).deleteById(any());
    }

    // --- config ---

    @Test
    void getConfig_existing_maps() {
        TestStudioConfigEntity cfg = new TestStudioConfigEntity();
        cfg.setCompanyId(5L);
        cfg.setSelectedProfileId(1L);
        cfg.setStepFormat(StepFormat.GIVEN_WHEN_THEN);
        cfg.setDetailLevel(DetailLevel.DETAILED);
        cfg.setTone(Tone.FORMAL);
        when(configRepository.findByCompanyId(5L)).thenReturn(Optional.of(cfg));

        ConfigResponse resp = service.getConfig(5L);

        assertEquals(1L, resp.selectedProfileId());
        assertEquals(StepFormat.GIVEN_WHEN_THEN, resp.stepFormat());
        assertEquals(Tone.FORMAL, resp.tone());
    }

    @Test
    void getConfig_missing_returnsDefault() {
        when(configRepository.findByCompanyId(5L)).thenReturn(Optional.empty());

        ConfigResponse resp = service.getConfig(5L);

        assertNull(resp.selectedProfileId(), "default has no selected profile (=Sample)");
        assertEquals(StepFormat.ACTION_EXPECTED, resp.stepFormat());
        assertEquals(DetailLevel.STANDARD, resp.detailLevel());
        assertEquals(Tone.PLAIN, resp.tone());
    }

    @Test
    void upsertConfig_insertNew_withValidProfile() {
        when(companyRepository.existsById(5L)).thenReturn(true);
        when(profileRepository.findById(1L)).thenReturn(Optional.of(profile(1L, 5L, "s")));
        when(configRepository.findByCompanyId(5L)).thenReturn(Optional.empty());
        when(configRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ConfigResponse resp = service.upsertConfig(
                new ConfigRequest(5L, 1L, StepFormat.NARRATIVE, DetailLevel.CONCISE, Tone.BULLET));

        assertEquals(1L, resp.selectedProfileId());
        assertEquals(StepFormat.NARRATIVE, resp.stepFormat());
        assertEquals(Tone.BULLET, resp.tone());
    }

    @Test
    void upsertConfig_selectedProfileNotFound_throws() {
        when(companyRepository.existsById(5L)).thenReturn(true);
        when(profileRepository.findById(9L)).thenReturn(Optional.empty());
        assertThrows(IllegalArgumentException.class, () -> service.upsertConfig(
                new ConfigRequest(5L, 9L, null, null, null)));
        verify(configRepository, never()).save(any());
    }

    @Test
    void upsertConfig_selectedProfileWrongCompany_throws() {
        when(companyRepository.existsById(5L)).thenReturn(true);
        when(profileRepository.findById(1L)).thenReturn(Optional.of(profile(1L, 999L, "other")));
        assertThrows(IllegalArgumentException.class, () -> service.upsertConfig(
                new ConfigRequest(5L, 1L, null, null, null)));
        verify(configRepository, never()).save(any());
    }

    @Test
    void upsertConfig_nullEnums_defaultsApplied() {
        when(companyRepository.existsById(5L)).thenReturn(true);
        when(configRepository.findByCompanyId(5L)).thenReturn(Optional.empty());
        when(configRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ConfigResponse resp = service.upsertConfig(new ConfigRequest(5L, null, null, null, null));

        assertNull(resp.selectedProfileId());
        assertEquals(StepFormat.ACTION_EXPECTED, resp.stepFormat());
        assertEquals(DetailLevel.STANDARD, resp.detailLevel());
        assertEquals(Tone.PLAIN, resp.tone());
    }

    // --- resolveActiveExamples (Sample fallback) ---

    @Test
    void resolveActiveExamples_selectedProfileWithExamples_returnsThose() {
        TestStudioConfigEntity cfg = new TestStudioConfigEntity();
        cfg.setCompanyId(5L);
        cfg.setSelectedProfileId(1L);
        when(configRepository.findByCompanyId(5L)).thenReturn(Optional.of(cfg));
        when(exampleRepository.findAllByProfileIdOrderBySortOrderAsc(1L))
                .thenReturn(List.of(example(10L, 1L, "내 예시")));

        List<ExampleResponse> result = service.resolveActiveExamples(5L);

        assertEquals(1, result.size());
        assertEquals("내 예시", result.get(0).title());
    }

    @Test
    void resolveActiveExamples_noConfig_fallbackToSample() {
        when(configRepository.findByCompanyId(5L)).thenReturn(Optional.empty());

        List<ExampleResponse> result = service.resolveActiveExamples(5L);

        assertEquals(DefaultStyleSamples.samples().size(), result.size());
        assertTrue(result.get(0).title().contains("[로그인]"),
                "fallback should be the login Sample");
    }

    @Test
    void resolveActiveExamples_selectedProfileEmpty_fallbackToSample() {
        TestStudioConfigEntity cfg = new TestStudioConfigEntity();
        cfg.setCompanyId(5L);
        cfg.setSelectedProfileId(1L);
        when(configRepository.findByCompanyId(5L)).thenReturn(Optional.of(cfg));
        when(exampleRepository.findAllByProfileIdOrderBySortOrderAsc(1L)).thenReturn(List.of());

        List<ExampleResponse> result = service.resolveActiveExamples(5L);

        assertEquals(DefaultStyleSamples.samples().size(), result.size());
        assertTrue(result.get(0).title().contains("[로그인]"));
    }
}
