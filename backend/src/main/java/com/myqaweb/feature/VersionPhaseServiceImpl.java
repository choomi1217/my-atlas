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

    public VersionPhaseServiceImpl(VersionPhaseRepository versionPhaseRepository,
                                  VersionRepository versionRepository,
                                  TestRunRepository testRunRepository,
                                  TestResultRepository testResultRepository,
                                  TestResultService testResultService) {
        this.versionPhaseRepository = versionPhaseRepository;
        this.versionRepository = versionRepository;
        this.testRunRepository = testRunRepository;
        this.testResultRepository = testResultRepository;
        this.testResultService = testResultService;
    }

    @Override
    @Transactional
    public VersionDto.VersionPhaseDto addPhase(Long versionId, VersionDto.PhaseRequest request) {
        VersionEntity version = versionRepository.findById(versionId)
                .orElseThrow(() -> new EntityNotFoundException("Version not found: " + versionId));

        TestRunEntity testRun = testRunRepository.findById(request.testRunId())
                .orElseThrow(() -> new EntityNotFoundException("TestRun not found: " + request.testRunId()));

        // Get next order index
        List<VersionPhaseEntity> existingPhases = versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(versionId);
        int nextOrderIndex = existingPhases.size() + 1;

        VersionPhaseEntity phase = new VersionPhaseEntity();
        phase.setVersion(version);
        phase.setPhaseName(request.phaseName());
        phase.setTestRun(testRun);
        phase.setOrderIndex(nextOrderIndex);

        VersionPhaseEntity savedPhase = versionPhaseRepository.save(phase);
        log.info("Added phase: {} to version: {}", savedPhase.getId(), versionId);

        // Initialize test results for this phase
        testResultService.createInitialResults(versionId, savedPhase.getId(), testRun.getId());

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

        if (request.testRunId() != null) {
            TestRunEntity testRun = testRunRepository.findById(request.testRunId())
                    .orElseThrow(() -> new EntityNotFoundException("TestRun not found: " + request.testRunId()));
            phase.setTestRun(testRun);
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

        // Validate version matches
        if (!phase.getVersion().getId().equals(versionId)) {
            throw new IllegalArgumentException("Phase does not belong to this version");
        }

        int deletedOrderIndex = phase.getOrderIndex();

        // Delete the phase
        versionPhaseRepository.deleteById(phaseId);

        // Reorder remaining phases with higher order index
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

        // Validate version matches
        if (!phase.getVersion().getId().equals(versionId)) {
            throw new IllegalArgumentException("Phase does not belong to this version");
        }

        int currentIndex = phase.getOrderIndex();
        if (currentIndex == newOrderIndex) {
            return; // No change needed
        }

        // Get all phases for this version
        List<VersionPhaseEntity> allPhases = versionPhaseRepository.findAllByVersionIdOrderByOrderIndex(versionId);

        // Validate new order index is within range
        if (newOrderIndex < 1 || newOrderIndex > allPhases.size()) {
            throw new IllegalArgumentException("Invalid new order index: " + newOrderIndex);
        }

        if (currentIndex < newOrderIndex) {
            // Moving forward (down): shift phases between currentIndex+1 and newOrderIndex back by 1
            List<VersionPhaseEntity> phasesToShift = versionPhaseRepository.findByVersionIdAndOrderIndexGreaterThan(versionId, currentIndex);
            for (VersionPhaseEntity p : phasesToShift) {
                if (p.getOrderIndex() <= newOrderIndex && !p.getId().equals(phaseId)) {
                    p.setOrderIndex(p.getOrderIndex() - 1);
                }
            }
            versionPhaseRepository.saveAll(phasesToShift);
        } else {
            // Moving backward (up): shift phases between newOrderIndex and currentIndex-1 forward by 1
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

        // Reorder remaining phases
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
            return; // No change needed
        }

        // Adjust order indices
        if (currentIndex < newOrderIndex) {
            // Moving down
            for (VersionPhaseEntity p : phases) {
                if (p.getOrderIndex() > currentIndex && p.getOrderIndex() <= newOrderIndex) {
                    p.setOrderIndex(p.getOrderIndex() - 1);
                    versionPhaseRepository.save(p);
                }
            }
        } else {
            // Moving up
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

    private void initializeTestResults(VersionEntity version, VersionPhaseEntity phase, TestRunEntity testRun) {
        // Initialize test results for all test cases in the test run
        // Note: This assumes a way to get test cases from a test run
        // In the actual implementation, you would query the test_run_test_case junction table
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
