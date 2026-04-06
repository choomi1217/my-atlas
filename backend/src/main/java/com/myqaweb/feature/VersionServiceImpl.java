package com.myqaweb.feature;

import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service implementation for Version operations.
 */
@Service
@Slf4j
public class VersionServiceImpl implements VersionService {
    private final VersionRepository versionRepository;
    private final VersionPhaseRepository versionPhaseRepository;
    private final TestResultRepository testResultRepository;
    private final ProductRepository productRepository;
    private final TestRunRepository testRunRepository;
    private final TestResultService testResultService;

    public VersionServiceImpl(VersionRepository versionRepository,
                             VersionPhaseRepository versionPhaseRepository,
                             TestResultRepository testResultRepository,
                             ProductRepository productRepository,
                             TestRunRepository testRunRepository,
                             TestResultService testResultService) {
        this.versionRepository = versionRepository;
        this.versionPhaseRepository = versionPhaseRepository;
        this.testResultRepository = testResultRepository;
        this.productRepository = productRepository;
        this.testRunRepository = testRunRepository;
        this.testResultService = testResultService;
    }

    @Override
    @Transactional
    public VersionDto.VersionDetail create(VersionDto.CreateVersionRequest request) {
        // Validate product exists
        ProductEntity product = productRepository.findById(request.productId())
                .orElseThrow(() -> new EntityNotFoundException("Product not found: " + request.productId()));

        // Create version
        VersionEntity version = new VersionEntity();
        version.setProduct(product);
        version.setName(request.name());
        version.setDescription(request.description());
        version.setReleaseDate(request.releaseDate());

        VersionEntity savedVersion = versionRepository.save(version);
        log.info("Created version: {}", savedVersion.getId());

        // Create phases
        int orderIndex = 1;
        for (VersionDto.PhaseRequest phaseReq : request.phases()) {
            TestRunEntity testRun = testRunRepository.findById(phaseReq.testRunId())
                    .orElseThrow(() -> new EntityNotFoundException("TestRun not found: " + phaseReq.testRunId()));

            VersionPhaseEntity phase = new VersionPhaseEntity();
            phase.setVersion(savedVersion);
            phase.setPhaseName(phaseReq.phaseName());
            phase.setTestRun(testRun);
            phase.setOrderIndex(orderIndex++);

            VersionPhaseEntity savedPhase = versionPhaseRepository.save(phase);

            // Initialize test results for this phase
            testResultService.createInitialResults(savedVersion.getId(), savedPhase.getId(), testRun.getId());
        }

        return getById(savedVersion.getId());
    }

    @Override
    @Transactional(readOnly = true)
    public List<VersionDto.VersionSummary> getAllByProductId(Long productId) {
        List<VersionEntity> versions = versionRepository.findAllByProductIdOrderByReleaseDateDescCreatedAtDesc(productId);
        return versions.stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public VersionDto.VersionDetail getById(Long id) {
        VersionEntity version = versionRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Version not found: " + id));

        return toDetail(version);
    }

    @Override
    @Transactional
    public VersionDto.VersionDetail update(Long id, VersionDto.UpdateVersionRequest request) {
        VersionEntity version = versionRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Version not found: " + id));

        if (request.name() != null) {
            version.setName(request.name());
        }
        if (request.description() != null) {
            version.setDescription(request.description());
        }
        if (request.releaseDate() != null) {
            version.setReleaseDate(request.releaseDate());
        }

        VersionEntity updated = versionRepository.save(version);
        log.info("Updated version: {}", id);

        return toDetail(updated);
    }

    @Override
    @Transactional
    public VersionDto.VersionDetail copy(Long id, VersionDto.VersionCopyRequest request) {
        VersionEntity original = versionRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Version not found: " + id));

        // Create new version
        VersionEntity newVersion = new VersionEntity();
        newVersion.setProduct(original.getProduct());
        newVersion.setName(request.newName());
        newVersion.setDescription(original.getDescription());
        newVersion.setReleaseDate(request.newReleaseDate());
        newVersion.setCopiedFrom(original.getId());

        VersionEntity savedVersion = versionRepository.save(newVersion);
        log.info("Copied version: {} -> {}", original.getId(), savedVersion.getId());

        // Copy phases
        List<VersionPhaseEntity> originalPhases = versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(original.getId());
        for (VersionPhaseEntity originalPhase : originalPhases) {
            VersionPhaseEntity newPhase = new VersionPhaseEntity();
            newPhase.setVersion(savedVersion);
            newPhase.setPhaseName(originalPhase.getPhaseName());
            newPhase.setTestRun(originalPhase.getTestRun());
            newPhase.setOrderIndex(originalPhase.getOrderIndex());

            VersionPhaseEntity savedPhase = versionPhaseRepository.save(newPhase);

            // Initialize test results (UNTESTED)
            testResultService.createInitialResults(savedVersion.getId(), savedPhase.getId(), originalPhase.getTestRun().getId());
        }

        return getById(savedVersion.getId());
    }

    @Override
    @Transactional
    public void delete(Long id) {
        VersionEntity version = versionRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Version not found: " + id));

        versionRepository.delete(version);
        log.info("Deleted version: {}", id);
    }

    private void initializeTestResults(VersionEntity version, VersionPhaseEntity phase, TestRunEntity testRun) {
        // Initialize test results for all test cases in the test run
        // Note: This assumes a way to get test cases from a test run
        // In the actual implementation, you would query the test_run_test_case junction table
    }

    private boolean isReleaseDatePassed(VersionEntity version) {
        if (version.getReleaseDate() == null) {
            return false;
        }
        return LocalDate.now().isAfter(version.getReleaseDate());
    }

    private String getWarningMessage(VersionEntity version) {
        if (!isReleaseDatePassed(version)) {
            return null;
        }
        return "⚠️ 릴리스 예정일(" + version.getReleaseDate() + ")이 지났습니다. 진행 상황을 확인하세요.";
    }

    private VersionDto.VersionSummary toSummary(VersionEntity entity) {
        List<VersionPhaseEntity> phases = versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(entity.getId());
        VersionDto.ProgressStats progress = testResultService.computeVersionProgress(entity.getId());
        boolean isReleaseDatePassed = isReleaseDatePassed(entity);

        return new VersionDto.VersionSummary(
                entity.getId(),
                entity.getProduct().getId(),
                entity.getName(),
                entity.getDescription(),
                entity.getReleaseDate(),
                entity.getCopiedFrom(),
                phases.size(),
                progress,
                isReleaseDatePassed,
                getWarningMessage(entity),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private VersionDto.VersionDetail toDetail(VersionEntity entity) {
        List<VersionPhaseEntity> phases = versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(entity.getId());
        List<VersionDto.VersionPhaseDto> phaseDtos = phases.stream()
                .map(this::toPhaseDto)
                .collect(Collectors.toList());

        VersionDto.ProgressStats progress = testResultService.computeVersionProgress(entity.getId());
        boolean isReleaseDatePassed = isReleaseDatePassed(entity);

        return new VersionDto.VersionDetail(
                entity.getId(),
                entity.getProduct().getId(),
                entity.getName(),
                entity.getDescription(),
                entity.getReleaseDate(),
                entity.getCopiedFrom(),
                phaseDtos,
                progress,
                isReleaseDatePassed,
                getWarningMessage(entity),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private VersionDto.VersionPhaseDto toPhaseDto(VersionPhaseEntity entity) {
        VersionDto.ProgressStats phaseProgress = testResultService.computePhaseProgress(entity.getId());

        int testCaseCount = testResultRepository.findAllByVersionPhaseId(entity.getId()).size();

        return new VersionDto.VersionPhaseDto(
                entity.getId(),
                entity.getPhaseName(),
                entity.getTestRun().getId(),
                entity.getTestRun().getName(),
                testCaseCount,
                entity.getOrderIndex(),
                phaseProgress
        );
    }
}
