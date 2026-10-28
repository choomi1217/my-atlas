package com.myqaweb.feature;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 에이전트 실행 라이브 뷰용 최신 화면 프레임 저장소 (registry_v26).
 * Job당 최신 1장만 메모리에 보관한다 — DB/S3 저장 없음.
 */
// ponytail: in-memory single instance. 백엔드를 다중 인스턴스로 띄우면 Redis 등 공유 저장소로 옮길 것.
@Component
public class AgentLiveFrameStore {

    /** 프레임 바이트 + 원본 Content-Type. */
    public record Frame(byte[] data, String contentType) {}

    private final Map<Long, Frame> frames = new ConcurrentHashMap<>();

    /** 해당 Job의 최신 프레임으로 덮어쓴다. */
    public void put(Long jobId, byte[] data, String contentType) {
        frames.put(jobId, new Frame(data, contentType));
    }

    /** 해당 Job의 최신 프레임. 없으면 empty. */
    public Optional<Frame> get(Long jobId) {
        return Optional.ofNullable(frames.get(jobId));
    }

    /** 해당 Job의 프레임 제거 (Job 종료/취소 시). */
    public void clear(Long jobId) {
        frames.remove(jobId);
    }
}
