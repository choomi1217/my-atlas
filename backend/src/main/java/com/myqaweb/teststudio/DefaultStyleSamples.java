package com.myqaweb.teststudio;

import com.myqaweb.feature.Priority;
import com.myqaweb.feature.TestStep;
import com.myqaweb.feature.TestType;
import com.myqaweb.teststudio.TestStudioStyleExampleDto.ExampleResponse;

import java.util.List;

/**
 * Test Studio v2.5 — 기본 견본(Sample).
 *
 * <p>사용자가 스타일 세트를 만들지 않았거나 선택 세트가 비어 있을 때, 생성 시 few-shot으로
 * 참조되는 로그인 기반 예시 TC(정상 2 + 실패 1). 모든 Company 공통 fallback이라 DB row가 아니라
 * 코드 상수로 제공한다(중복 저장 방지). 셀렉트 박스에서 "Sample (기본 견본)"으로 노출된다.
 *
 * <p>스타일 참고용이므로 제목 prefix({@code [로그인]})·평서체("~한다")·{@code action → expected}
 * step·다중 기대결과 같은 형식을 대표적으로 담는다.
 */
public final class DefaultStyleSamples {

    /** 셀렉트 박스에 노출되는 기본 견본 이름. */
    public static final String SAMPLE_NAME = "Sample";

    private static final List<ExampleResponse> SAMPLES = List.of(
            new ExampleResponse(
                    null, null,
                    "[로그인] 유효한 이메일/비밀번호로 로그인 성공",
                    "가입된 계정이 존재한다. 사용자는 로그아웃 상태이다.",
                    List.of(
                            new TestStep(1, "로그인 화면에서 이메일과 비밀번호를 입력한다", "비밀번호가 마스킹되어 표시된다"),
                            new TestStep(2, "로그인 버튼을 클릭한다", "메인 화면으로 이동한다")
                    ),
                    List.of("로그인에 성공하고 세션이 생성된다", "메인 화면 상단에 사용자 이름이 표시된다"),
                    Priority.HIGH, TestType.SMOKE, 0, null, null
            ),
            new ExampleResponse(
                    null, null,
                    "[로그인] 자동 로그인 체크 시 재접속에도 세션 유지",
                    "가입된 계정이 존재한다.",
                    List.of(
                            new TestStep(1, "자동 로그인을 체크한 뒤 로그인한다", "메인 화면으로 이동한다"),
                            new TestStep(2, "브라우저를 종료한 뒤 다시 접속한다", "로그인 화면 없이 메인 화면이 표시된다")
                    ),
                    List.of("세션이 유지되어 재로그인 없이 접근된다"),
                    Priority.MEDIUM, TestType.FUNCTIONAL, 1, null, null
            ),
            new ExampleResponse(
                    null, null,
                    "[로그인] 잘못된 비밀번호 입력 시 로그인 실패",
                    "가입된 계정이 존재한다.",
                    List.of(
                            new TestStep(1, "이메일은 정확히, 비밀번호는 틀리게 입력한다", "입력값이 표시된다"),
                            new TestStep(2, "로그인 버튼을 클릭한다", "오류 메시지가 표시된다")
                    ),
                    List.of(
                            "'이메일 또는 비밀번호가 올바르지 않습니다' 메시지가 표시된다",
                            "로그인 화면에 머무른다",
                            "5회 연속 실패 시 계정이 일시 잠금된다"
                    ),
                    Priority.HIGH, TestType.FUNCTIONAL, 2, null, null
            )
    );

    private DefaultStyleSamples() {
    }

    /** 기본 견본 예시 TC(정상 2 + 실패 1). 불변 리스트. */
    public static List<ExampleResponse> samples() {
        return SAMPLES;
    }
}
