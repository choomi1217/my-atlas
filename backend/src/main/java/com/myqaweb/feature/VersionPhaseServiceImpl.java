package com.myqaweb.feature;

import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Service implementation for VersionPhase operations.
 */
@Service
@Slf4j
public class VersionPhaseServiceImpl implements VersionPhaseService {
    private final VersionPhaseRepository versionPhaseRepository;
    private final VersionRepository versionRepository;
    private final TestRunRepository testRunRepository;
    private final TestResultRepository testResultRepository;
    private final TestResultService testResultService;
    private final VersionPhaseTestRunRepository versionPhaseTestRunRepository;
    private final TestRunTestCaseRepository testRunTestCaseRepository;

    public VersionPhaseServiceImpl(VersionPhaseRepository versionPhaseRepository,
                                  VersionRepository versionRepository,
                                  TestRunRepository testRunRepository,
                                  TestResultRepository testResultRepository,
                                  TestResultService testResultService,
                                  VersionPhaseTestRunRepository versionPhaseTestRunRepository,
                                  TestRunTestCaseRepository testRunTestCaseRepository) {
        this.versionPhaseRepository = versionPhaseRepository;
        this.versionRepository = versionRepository;
        this.testRunRepository = testRunRepository;
        this.testResultRepository = testResultRepository;
        this.testResultService = testResultService;
        this.versionPhaseTestRunRepository = versionPhaseTestRunRepository;
        this.testRunTestCaseRepository = testRunTestCaseRepository;
    }

    @Override
    @Transactional
    public VersionDto.VersionPhaseDto addPhase(Long versionId, VersionDto.PhaseRequest request) {
        VersionEntity version = versionRepository.findById(versionId)
                .orElseThrow(() -> new EntityNotFoundException("Version not found: " + versionId));

        // Validate all test runs exist
        List<TestRunEntity> testRuns = request.testRunIds().stream()
                .map(id -> testRunRepository.findById(id)
                        .orElseThrow(() -> new EntityNotFoundException("TestRun not found: " + id)))
                .toList();

        // Get next order index
        List<VersionPhaseEntity> existingPhases = versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(versionId);
        int nextOrderIndex = existingPhases.size() + 1;

        // Create phase (without test_run_id — now via junction)
        VersionPhaseEntity phase = new VersionPhaseEntity();
        phase.setVersion(version);
        phase.setPhaseName(request.phaseName());
        phase.setOrderIndex(nextOrderIndex);

        VersionPhaseEntity savedPhase = versionPhaseRepository.save(phase);
        log.info("Added phase: {} to version: {}", savedPhase.getId(), versionId);

        // Create junction entries
        for (TestRunEntity testRun : testRuns) {
            VersionPhaseTestRunEntity junction = new VersionPhaseTestRunEntity();
            junction.setVersionPhase(savedPhase);
            junction.setTestRun(testRun);
            versionPhaseTestRunRepository.save(junction);
        }

        // Initialize test results for all test runs (with dedup)
        testResultService.createInitialResults(versionId, savedPhase.getId(), request.testRunIds());

        return toPhaseDto(savedPhase);
    }

    @Override
    @Transactional(readOnly = true)
    public List<VersionDto.VersionPhaseDto> getAllByVersionId(Long versionId) {
        List<VersionPhaseEntity> phases = versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(versionId);
        return phases.stream()
                .map(this::toPhaseDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public VersionDto.VersionPhaseDto updatePhase(Long phaseId, VersionDto.PhaseRequest request) {
        VersionPhaseEntity phase = versionPhaseRepository.findById(phaseId)
                .orElseThrow(() -> new EntityNotFoundException("Phase not found: " + phaseId));

        if (request.phaseName() != null) {
            phase.setPhaseName(request.phaseName());
        }

        if (request.testRunIds() != null && !request.testRunIds().isEmpty()) {
            // Replace junction entries
            versionPhaseTestRunRepository.deleteAllByVersionPhaseId(phaseId);

            for (Long testRunId : request.testRunIds()) {
                TestRunEntity testRun = testRunRepository.findById(testRunId)
                        .orElseThrow(() -> new EntityNotFoundException("TestRun not found: " + testRunId));
                VersionPhaseTestRunEntity junction = new VersionPhaseTestRunEntity();
                junction.setVersionPhase(phase);
                junction.setTestRun(testRun);
                versionPhaseTestRunRepository.save(junction);
            }
        }

        VersionPhaseEntity updated = versionPhaseRepository.save(phase);
        log.info("Updated phase: {}", phaseId);

        return toPhaseDto(updated);
    }

    @Override
    @Transactional
    public void deletePhase(Long versionId, Long phaseId) {
        VersionPhaseEntity phase = versionPhaseRepository.findById(phaseId)
                .orElseThrow(() -> new EntityNotFoundException("Phase not found: " + phaseId));

        if (!phase.getVersion().getId().equals(versionId)) {
            throw new IllegalArgumentException("Phase does not belong to this version");
        }

        int deletedOrderIndex = phase.getOrderIndex();

        versionPhaseRepository.deleteById(phaseId);

        List<VersionPhaseEntity> phasesToReorder = versionPhaseRepository.findByVersionIdAndOrderIndexGreaterThan(versionId, deletedOrderIndex);
        for (VersionPhaseEntity p : phasesToReorder) {
            p.setOrderIndex(p.getOrderIndex() - 1);
        }
        versionPhaseRepository.saveAll(phasesToReorder);

        log.info("Deleted phase: {} from version: {}, reordered {} phases", phaseId, versionId, phasesToReorder.size());
    }

    @Override
    @Transactional
    public void reorderPhase(Long versionId, Long phaseId, int newOrderIndex) {
        VersionPhaseEntity phase = versionPhaseRepository.findById(phaseId)
                .orElseThrow(() -> new EntityNotFoundException("Phase not found: " + phaseId));

        if (!phase.getVersion().getId().equals(versionId)) {
            throw new IllegalArgumentException("Phase does not belong to this version");
        }

        int currentIndex = phase.getOrderIndex();
        if (currentIndex == newOrderIndex) {
            return;
        }

        List<VersionPhaseEntity> allPhases = versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(versionId);

        if (newOrderIndex < 1 || newOrderIndex > allPhases.size()) {
            throw new IllegalArgumentException("Invalid new order index: " + newOrderIndex);
        }

        if (currentIndex < newOrderIndex) {
            List<VersionPhaseEntity> phasesToShift = versionPhaseRepository.findByVersionIdAndOrderIndexGreaterThan(versionId, currentIndex);
            for (VersionPhaseEntity p : phasesToShift) {
                if (p.getOrderIndex() <= newOrderIndex && !p.getId().equals(phaseId)) {
                    p.setOrderIndex(p.getOrderIndex() - 1);
                }
            }
            versionPhaseRepository.saveAll(phasesToShift);
        } else {
            List<VersionPhaseEntity> phasesToShift = versionPhaseRepository.findByVersionIdAndOrderIndexGreaterThanEqual(versionId, newOrderIndex);
            for (VersionPhaseEntity p : phasesToShift) {
                if (p.getOrderIndex() < currentIndex && !p.getId().equals(phaseId)) {
                    p.setOrderIndex(p.getOrderIndex() + 1);
                }
            }
            versionPhaseRepository.saveAll(phasesToShift);
        }

        phase.setOrderIndex(newOrderIndex);
        versionPhaseRepository.save(phase);
        log.info("Reordered phase: {} from index {} to {}", phaseId, currentIndex, newOrderIndex);
    }

    @Override
    @Transactional
    public void deletePhase(Long phaseId) {
        VersionPhaseEntity phase = versionPhaseRepository.findById(phaseId)
                .orElseThrow(() -> new EntityNotFoundException("Phase not found: " + phaseId));

        VersionEntity version = phase.getVersion();
        versionPhaseRepository.delete(phase);

        reorderPhasesAfterDelete(version.getId());

        log.info("Deleted phase: {}", phaseId);
    }

    @Override
    @Transactional
    public void reorderPhase(Long phaseId, Integer newOrderIndex) {
        VersionPhaseEntity phase = versionPhaseRepository.findById(phaseId)
                .orElseThrow(() -> new EntityNotFoundException("Phase not found: " + phaseId));

        Long versionId = phase.getVersion().getId();
        List<VersionPhaseEntity> phases = versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(versionId);

        int currentIndex = phase.getOrderIndex();
        if (currentIndex == newOrderIndex) {
            return;
        }

        if (currentIndex < newOrderIndex) {
            for (VersionPhaseEntity p : phases) {
                if (p.getOrderIndex() > currentIndex && p.getOrderIndex() <= newOrderIndex) {
                    p.setOrderIndex(p.getOrderIndex() - 1);
                    versionPhaseRepository.save(p);
                }
            }
        } else {
            for (VersionPhaseEntity p : phases) {
                if (p.getOrderIndex() >= newOrderIndex && p.getOrderIndex() < currentIndex) {
                    p.setOrderIndex(p.getOrderIndex() + 1);
                    versionPhaseRepository.save(p);
                }
            }
        }

        phase.setOrderIndex(newOrderIndex);
        versionPhaseRepository.save(phase);
        log.info("Reordered phase: {} to index: {}", phaseId, newOrderIndex);
    }

    private void reorderPhasesAfterDelete(Long versionId) {
        List<VersionPhaseEntity> phases = versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(versionId);
        int orderIndex = 1;
        for (VersionPhaseEntity phase : phases) {
            phase.setOrderIndex(orderIndex++);
            versionPhaseRepository.save(phase);
        }
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
