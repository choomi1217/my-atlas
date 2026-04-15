package com.myqaweb.feature;

import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
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
    private final VersionPhaseTestRunRepository versionPhaseTestRunRepository;
    private final TestRunTestCaseRepository testRunTestCaseRepository;
    private final VersionPhaseTestCaseRepository versionPhaseTestCaseRepository;
    private final TicketRepository ticketRepository;

    public VersionServiceImpl(VersionRepository versionRepository,
                             VersionPhaseRepository versionPhaseRepository,
                             TestResultRepository testResultRepository,
                             ProductRepository productRepository,
                             TestRunRepository testRunRepository,
                             TestResultService testResultService,
                             VersionPhaseTestRunRepository versionPhaseTestRunRepository,
                             TestRunTestCaseRepository testRunTestCaseRepository,
                             VersionPhaseTestCaseRepository versionPhaseTestCaseRepository,
                             TicketRepository ticketRepository) {
        this.versionRepository = versionRepository;
        this.versionPhaseRepository = versionPhaseRepository;
        this.testResultRepository = testResultRepository;
        this.productRepository = productRepository;
        this.testRunRepository = testRunRepository;
        this.testResultService = testResultService;
        this.versionPhaseTestRunRepository = versionPhaseTestRunRepository;
        this.testRunTestCaseRepository = testRunTestCaseRepository;
        this.versionPhaseTestCaseRepository = versionPhaseTestCaseRepository;
        this.ticketRepository = ticketRepository;
    }

    @Override
    @Transactional
    public VersionDto.VersionDetail create(VersionDto.CreateVersionRequest request) {
        ProductEntity product = productRepository.findById(request.productId())
                .orElseThrow(() -> new EntityNotFoundException("Product not found: " + request.productId()));

        VersionEntity version = new VersionEntity();
        version.setProduct(product);
        version.setName(request.name());
        version.setDescription(request.description());
        version.setReleaseDate(request.releaseDate());

        VersionEntity savedVersion = versionRepository.save(version);
        log.info("Created version: {} (phases added separately via detail page)", savedVersion.getId());

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

        VersionEntity newVersion = new VersionEntity();
        newVersion.setProduct(original.getProduct());
        newVersion.setName(request.newName());
        newVersion.setDescription(original.getDescription());
        newVersion.setReleaseDate(request.newReleaseDate());
        newVersion.setCopiedFrom(original.getId());

        VersionEntity savedVersion = versionRepository.save(newVersion);
        log.info("Copied version: {} -> {}", original.getId(), savedVersion.getId());

        // Copy phases with junction data
        List<VersionPhaseEntity> originalPhases = versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(original.getId());
        for (VersionPhaseEntity originalPhase : originalPhases) {
            VersionPhaseEntity newPhase = new VersionPhaseEntity();
            newPhase.setVersion(savedVersion);
            newPhase.setPhaseName(originalPhase.getPhaseName());
            newPhase.setOrderIndex(originalPhase.getOrderIndex());

            VersionPhaseEntity savedPhase = versionPhaseRepository.save(newPhase);

            // Copy junction entries from original phase
            List<VersionPhaseTestRunEntity> originalJunctions =
                    versionPhaseTestRunRepository.findAllByVersionPhaseId(originalPhase.getId());
            List<Long> testRunIds = originalJunctions.stream()
                    .map(j -> j.getTestRun().getId())
                    .toList();

            for (VersionPhaseTestRunEntity origJunction : originalJunctions) {
                VersionPhaseTestRunEntity newJunction = new VersionPhaseTestRunEntity();
                newJunction.setVersionPhase(savedPhase);
                newJunction.setTestRun(origJunction.getTestRun());
                versionPhaseTestRunRepository.save(newJunction);
            }

            // Copy direct TC junctions
            List<VersionPhaseTestCaseEntity> originalDirectTcs =
                    versionPhaseTestCaseRepository.findAllByVersionPhaseId(originalPhase.getId());
            List<Long> directTcIds = new ArrayList<>();
            for (VersionPhaseTestCaseEntity origTc : originalDirectTcs) {
                VersionPhaseTestCaseEntity newTc = new VersionPhaseTestCaseEntity();
                newTc.setVersionPhase(savedPhase);
                newTc.setTestCase(origTc.getTestCase());
                versionPhaseTestCaseRepository.save(newTc);
                directTcIds.add(origTc.getTestCase().getId());
            }

            // Initialize test results (UNTESTED) with dedup across runs + direct TCs
            testResultService.createInitialResults(savedVersion.getId(), savedPhase.getId(), testRunIds, directTcIds);
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

    @Override
    @Transactional(readOnly = true)
    public List<VersionDto.FailedTestCaseInfo> getFailedTestCases(Long versionId) {
        List<TestResultEntity> failedResults = testResultRepository.findAllByVersionIdAndStatus(versionId, RunResultStatus.FAIL);

        // Group by testCaseId — pick the first failed phase for display
        java.util.Map<Long, TestResultEntity> uniqueByTc = new java.util.LinkedHashMap<>();
        for (TestResultEntity r : failedResults) {
            uniqueByTc.putIfAbsent(r.getTestCase().getId(), r);
        }

        return uniqueByTc.values().stream()
                .map(r -> {
                    String phaseName = r.getVersionPhase().getPhaseName();
                    Long[] pathArr = r.getTestCase().getPath();
                    List<Long> path = pathArr != null ? java.util.Arrays.asList(pathArr) : List.of();
                    int tickets = ticketRepository.countByTestResultId(r.getId());
                    return new VersionDto.FailedTestCaseInfo(
                            r.getTestCase().getId(),
                            r.getTestCase().getTitle(),
                            path,
                            phaseName,
                            tickets
                    );
                })
                .toList();
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
        return "릴리스 예정일(" + version.getReleaseDate() + ")이 지났습니다. 진행 상황을 확인하세요.";
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
        int totalTestCaseCount = testResultRepository.findAllByVersionPhaseId(entity.getId()).size();

        // Build test run references from junction table
        List<VersionPhaseTestRunEntity> junctions = versionPhaseTestRunRepository.findAllByVersionPhaseId(entity.getId());
        List<VersionDto.TestRunRef> testRuns = junctions.stream()
                .map(j -> new VersionDto.TestRunRef(
                        j.getTestRun().getId(),
                        j.getTestRun().getName(),
                        testRunTestCaseRepository.findAllByTestRunId(j.getTestRun().getId()).size()
                ))
                .toList();

        return new VersionDto.VersionPhaseDto(
                entity.getId(),
                entity.getPhaseName(),
                testRuns,
                totalTestCaseCount,
                entity.getOrderIndex(),
                phaseProgress
        );
    }
}
