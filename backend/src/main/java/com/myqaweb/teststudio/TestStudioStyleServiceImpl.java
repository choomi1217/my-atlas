package com.myqaweb.teststudio;

import com.myqaweb.feature.CompanyRepository;
import com.myqaweb.teststudio.TestStudioConfigDto.ConfigRequest;
import com.myqaweb.teststudio.TestStudioConfigDto.ConfigResponse;
import com.myqaweb.teststudio.TestStudioStyleExampleDto.ExampleRequest;
import com.myqaweb.teststudio.TestStudioStyleExampleDto.ExampleResponse;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.CreateRequest;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.ProfileResponse;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.RenameRequest;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * {@link TestStudioStyleService} 구현.
 *
 * <p>not-found는 도메인 관례대로 {@link IllegalArgumentException}(→400)으로 처리한다.
 */
@Service
@RequiredArgsConstructor
public class TestStudioStyleServiceImpl implements TestStudioStyleService {

    private static final Logger log = LoggerFactory.getLogger(TestStudioStyleServiceImpl.class);

    static final int MAX_PROFILES_PER_COMPANY = 10;
    static final int MAX_EXAMPLES_PER_PROFILE = 5;

    private final TestStudioStyleProfileRepository profileRepository;
    private final TestStudioStyleExampleRepository exampleRepository;
    private final TestStudioConfigRepository configRepository;
    private final CompanyRepository companyRepository;

    // --- 스타일 세트 ---

    @Override
    @Transactional(readOnly = true)
    public List<ProfileResponse> listProfiles(Long companyId) {
        requireCompanyId(companyId);
        return profileRepository.findAllByCompanyIdOrderByCreatedAtAsc(companyId).stream()
                .map(this::toProfileResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ProfileResponse createProfile(CreateRequest request) {
        Long companyId = request.companyId();
        requireCompanyId(companyId);
        if (!companyRepository.existsById(companyId)) {
            throw new IllegalArgumentException("Company not found: " + companyId);
        }
        if (profileRepository.countByCompanyId(companyId) >= MAX_PROFILES_PER_COMPANY) {
            throw new IllegalArgumentException(
                    "스타일 세트는 Company당 최대 " + MAX_PROFILES_PER_COMPANY + "개까지 만들 수 있습니다");
        }
        TestStudioStyleProfileEntity entity = new TestStudioStyleProfileEntity();
        entity.setCompanyId(companyId);
        entity.setName(request.name());
        TestStudioStyleProfileEntity saved = profileRepository.save(entity);
        log.info("Test Studio style profile created: id={}, companyId={}, name='{}'",
                saved.getId(), companyId, saved.getName());
        return toProfileResponse(saved);
    }

    @Override
    @Transactional
    public ProfileResponse renameProfile(Long profileId, RenameRequest request) {
        TestStudioStyleProfileEntity entity = requireProfile(profileId);
        entity.setName(request.name());
        return toProfileResponse(profileRepository.save(entity));
    }

    @Override
    @Transactional
    public void deleteProfile(Long profileId) {
        if (!profileRepository.existsById(profileId)) {
            throw new IllegalArgumentException("Style profile not found: " + profileId);
        }
        // 예시는 FK ON DELETE CASCADE, config.selected_profile_id는 ON DELETE SET NULL로 DB가 정리.
        profileRepository.deleteById(profileId);
    }

    // --- 세트 내 예시 TC ---

    @Override
    @Transactional(readOnly = true)
    public List<ExampleResponse> listExamples(Long profileId) {
        requireProfile(profileId);
        return exampleRepository.findAllByProfileIdOrderBySortOrderAsc(profileId).stream()
                .map(this::toExampleResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ExampleResponse addExample(Long profileId, ExampleRequest request) {
        requireProfile(profileId);
        if (exampleRepository.countByProfileId(profileId) >= MAX_EXAMPLES_PER_PROFILE) {
            throw new IllegalArgumentException(
                    "세트당 예시 TC는 최대 " + MAX_EXAMPLES_PER_PROFILE + "개까지 만들 수 있습니다");
        }
        TestStudioStyleExampleEntity entity = new TestStudioStyleExampleEntity();
        entity.setProfileId(profileId);
        applyExampleRequest(entity, request);
        return toExampleResponse(exampleRepository.save(entity));
    }

    @Override
    @Transactional
    public ExampleResponse updateExample(Long exampleId, ExampleRequest request) {
        TestStudioStyleExampleEntity entity = exampleRepository.findById(exampleId)
                .orElseThrow(() -> new IllegalArgumentException("Style example not found: " + exampleId));
        applyExampleRequest(entity, request);
        return toExampleResponse(exampleRepository.save(entity));
    }

    @Override
    @Transactional
    public void deleteExample(Long exampleId) {
        if (!exampleRepository.existsById(exampleId)) {
            throw new IllegalArgumentException("Style example not found: " + exampleId);
        }
        exampleRepository.deleteById(exampleId);
    }

    // --- 보조 설정 + 활성 세트 ---

    @Override
    @Transactional(readOnly = true)
    public ConfigResponse getConfig(Long companyId) {
        requireCompanyId(companyId);
        return configRepository.findByCompanyId(companyId)
                .map(this::toConfigResponse)
                .orElseGet(() -> defaultConfigResponse(companyId));
    }

    @Override
    @Transactional
    public ConfigResponse upsertConfig(ConfigRequest request) {
        Long companyId = request.companyId();
        requireCompanyId(companyId);
        if (!companyRepository.existsById(companyId)) {
            throw new IllegalArgumentException("Company not found: " + companyId);
        }
        Long selectedProfileId = request.selectedProfileId();
        if (selectedProfileId != null) {
            TestStudioStyleProfileEntity profile = requireProfile(selectedProfileId);
            if (!profile.getCompanyId().equals(companyId)) {
                throw new IllegalArgumentException("선택한 스타일 세트가 해당 Company에 속하지 않습니다");
            }
        }
        TestStudioConfigEntity entity = configRepository.findByCompanyId(companyId)
                .orElseGet(() -> {
                    TestStudioConfigEntity fresh = new TestStudioConfigEntity();
                    fresh.setCompanyId(companyId);
                    return fresh;
                });
        entity.setSelectedProfileId(selectedProfileId);
        entity.setStepFormat(request.stepFormat() != null ? request.stepFormat() : StepFormat.ACTION_EXPECTED);
        entity.setDetailLevel(request.detailLevel() != null ? request.detailLevel() : DetailLevel.STANDARD);
        entity.setTone(request.tone() != null ? request.tone() : Tone.PLAIN);
        return toConfigResponse(configRepository.save(entity));
    }

    // --- 생성 시 활성 예시 해석 (Sample fallback) ---

    @Override
    @Transactional(readOnly = true)
    public List<ExampleResponse> resolveActiveExamples(Long companyId) {
        Long selectedProfileId = configRepository.findByCompanyId(companyId)
                .map(TestStudioConfigEntity::getSelectedProfileId)
                .orElse(null);
        if (selectedProfileId != null) {
            List<ExampleResponse> examples = exampleRepository
                    .findAllByProfileIdOrderBySortOrderAsc(selectedProfileId).stream()
                    .map(this::toExampleResponse)
                    .collect(Collectors.toList());
            if (!examples.isEmpty()) {
                return examples;
            }
        }
        // 세트 미선택 / 선택 세트가 비어 있음 → 기본 견본(Sample, 로그인)
        return DefaultStyleSamples.samples();
    }

    // --- helpers ---

    private void requireCompanyId(Long companyId) {
        if (companyId == null) {
            throw new IllegalArgumentException("companyId is required");
        }
    }

    private TestStudioStyleProfileEntity requireProfile(Long profileId) {
        return profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Style profile not found: " + profileId));
    }

    private void applyExampleRequest(TestStudioStyleExampleEntity entity, ExampleRequest request) {
        entity.setTitle(request.title());
        entity.setPreconditions(request.preconditions());
        entity.setSteps(request.steps());
        entity.setExpectedResults(request.expectedResults());
        entity.setPriority(request.priority());
        entity.setTestType(request.testType());
        entity.setSortOrder(request.sortOrder() != null ? request.sortOrder() : 0);
    }

    private ProfileResponse toProfileResponse(TestStudioStyleProfileEntity e) {
        return new ProfileResponse(
                e.getId(), e.getCompanyId(), e.getName(),
                exampleRepository.countByProfileId(e.getId()),
                e.getCreatedAt(), e.getUpdatedAt());
    }

    private ExampleResponse toExampleResponse(TestStudioStyleExampleEntity e) {
        return new ExampleResponse(
                e.getId(), e.getProfileId(), e.getTitle(), e.getPreconditions(),
                e.getSteps(), e.getExpectedResults(), e.getPriority(), e.getTestType(),
                e.getSortOrder(), e.getCreatedAt(), e.getUpdatedAt());
    }

    private ConfigResponse toConfigResponse(TestStudioConfigEntity e) {
        return new ConfigResponse(
                e.getCompanyId(), e.getSelectedProfileId(),
                e.getStepFormat(), e.getDetailLevel(), e.getTone());
    }

    private ConfigResponse defaultConfigResponse(Long companyId) {
        return new ConfigResponse(companyId, null,
                StepFormat.ACTION_EXPECTED, DetailLevel.STANDARD, Tone.PLAIN);
    }
}
