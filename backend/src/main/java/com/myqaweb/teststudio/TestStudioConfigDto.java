package com.myqaweb.teststudio;

import jakarta.validation.constraints.NotNull;

/**
 * DTOs for Test Studio Company 보조 설정 + 활성 세트 선택.
 */
public class TestStudioConfigDto {

    /** 설정 응답. selectedProfileId 가 null 이면 기본 견본(Sample) 사용. */
    public record ConfigResponse(
            Long companyId,
            Long selectedProfileId,
            StepFormat stepFormat,
            DetailLevel detailLevel,
            Tone tone
    ) {}

    /** 설정 upsert 요청. enum 미지정 시 서비스에서 기본값을 채운다. */
    public record ConfigRequest(
            @NotNull(message = "companyId is required")
            Long companyId,
            Long selectedProfileId,
            StepFormat stepFormat,
            DetailLevel detailLevel,
            Tone tone
    ) {}
}
