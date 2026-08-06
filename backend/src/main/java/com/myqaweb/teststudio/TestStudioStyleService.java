package com.myqaweb.teststudio;

import com.myqaweb.teststudio.TestStudioConfigDto.ConfigRequest;
import com.myqaweb.teststudio.TestStudioConfigDto.ConfigResponse;
import com.myqaweb.teststudio.TestStudioStyleExampleDto.ExampleRequest;
import com.myqaweb.teststudio.TestStudioStyleExampleDto.ExampleResponse;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.CreateRequest;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.ProfileResponse;
import com.myqaweb.teststudio.TestStudioStyleProfileDto.RenameRequest;

import java.util.List;

/**
 * Test Studio v2.5 — 스타일 세트/예시/보조 설정 관리.
 */
public interface TestStudioStyleService {

    // --- 스타일 세트(프로필) ---

    List<ProfileResponse> listProfiles(Long companyId);

    ProfileResponse createProfile(CreateRequest request);

    ProfileResponse renameProfile(Long profileId, RenameRequest request);

    void deleteProfile(Long profileId);

    // --- 세트 내 예시 TC ---

    List<ExampleResponse> listExamples(Long profileId);

    ExampleResponse addExample(Long profileId, ExampleRequest request);

    ExampleResponse updateExample(Long exampleId, ExampleRequest request);

    void deleteExample(Long exampleId);

    // --- 보조 설정 + 활성 세트 선택 ---

    /** Company의 설정. 없으면 기본값(selected=null=Sample)으로 fallback. */
    ConfigResponse getConfig(Long companyId);

    ConfigResponse upsertConfig(ConfigRequest request);

    // --- 생성 시 활성 예시 해석 (Sample fallback) — TestStudioGenerator(Step 3)에서 사용 ---

    /**
     * Company의 활성 예시 TC를 해석한다.
     * 선택된 세트가 있고 예시가 있으면 그 세트의 예시를, 없거나 비어 있으면
     * 기본 견본(Sample, 로그인)을 반환한다.
     */
    List<ExampleResponse> resolveActiveExamples(Long companyId);
}
