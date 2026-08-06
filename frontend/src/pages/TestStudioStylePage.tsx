import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Company } from '@/types/features';
import { companyApi } from '@/api/features';
import { useTestStudioStyle } from '@/hooks/useTestStudioStyle';
import {
  StyleExample,
  StyleExampleInput,
  StepFormat,
  DetailLevel,
  Tone,
  SAMPLE_PROFILE_NAME,
} from '@/types/test-studio';
import StyleExampleModal from '@/components/test-studio/StyleExampleModal';

const STEP_FORMAT_LABELS: Record<StepFormat, string> = {
  ACTION_EXPECTED: 'action → expected',
  GIVEN_WHEN_THEN: 'Given / When / Then',
  NARRATIVE: '서술형 시나리오',
};
const DETAIL_LEVEL_LABELS: Record<DetailLevel, string> = {
  CONCISE: '간결',
  STANDARD: '표준',
  DETAILED: '상세',
};
const TONE_LABELS: Record<Tone, string> = {
  BULLET: '개조식 (-함/-음)',
  FORMAL: '격식체 (합니다)',
  PLAIN: '평서체 (한다)',
};

/**
 * Test Studio v2.5 — 스타일 설정 페이지 (`/test-studio/style?companyId=X`).
 *
 * 사용자가 팀 방식대로 쓴 예시 TC 세트를 verbatim으로 관리한다. 셀렉트 박스로 활성 세트를
 * 고르고(Sample=기본 견본), 세트 내 예시 TC를 기존 TC 폼과 동일한 UX로 CRUD 한다.
 * 보조 enum(문체/포맷/상세)은 예시가 없을 때의 약한 힌트다.
 */
export default function TestStudioStylePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const companyIdParam = searchParams.get('companyId');
  const companyId = companyIdParam ? Number(companyIdParam) : undefined;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    companyApi
      .getAll()
      .then(setCompanies)
      .catch((e) => console.error('Failed to load companies', e));
  }, []);

  const {
    profiles,
    config,
    isLoading,
    error,
    createProfile,
    renameProfile,
    deleteProfile,
    selectProfile,
    updateConfig,
    listExamples,
    addExample,
    updateExample,
    deleteExample,
  } = useTestStudioStyle(companyId);

  const selectedProfileId = config?.selectedProfileId ?? null;
  const selectedProfile =
    selectedProfileId != null
      ? profiles.find((p) => p.id === selectedProfileId) ?? null
      : null;

  const [examples, setExamples] = useState<StyleExample[]>([]);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExample, setEditingExample] = useState<StyleExample | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const reloadExamples = useCallback(async () => {
    if (selectedProfileId == null) {
      setExamples([]);
      return;
    }
    try {
      setExamples(await listExamples(selectedProfileId));
    } catch (e) {
      console.error('Failed to load examples', e);
      setExamples([]);
    }
  }, [selectedProfileId, listExamples]);

  useEffect(() => {
    reloadExamples();
  }, [reloadExamples]);

  const handleCompanyChange = (nextId: number | null) => {
    if (nextId == null) searchParams.delete('companyId');
    else searchParams.set('companyId', String(nextId));
    setSearchParams(searchParams, { replace: true });
  };

  const handleSelectChange = async (value: string) => {
    try {
      await selectProfile(value ? Number(value) : null);
    } catch {
      showToast('활성 세트 변경에 실패했습니다.');
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const created = await createProfile(name);
      setNewName('');
      await selectProfile(created.id);
      showToast(`세트 '${name}'을(를) 만들었습니다.`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '세트 생성에 실패했습니다.');
    }
  };

  const handleRename = async () => {
    if (!selectedProfile) return;
    const name = renameValue.trim();
    if (!name) return;
    try {
      await renameProfile(selectedProfile.id, name);
      setRenaming(false);
      showToast('세트 이름을 변경했습니다.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '이름 변경에 실패했습니다.');
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfile) return;
    if (!window.confirm(`세트 '${selectedProfile.name}'을(를) 삭제하시겠습니까? (예시 TC도 함께 삭제됩니다)`))
      return;
    try {
      await deleteProfile(selectedProfile.id);
      showToast('세트를 삭제했습니다.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '세트 삭제에 실패했습니다.');
    }
  };

  const handleExampleSubmit = async (input: StyleExampleInput) => {
    try {
      if (editingExample?.id) {
        await updateExample(editingExample.id, input);
      } else if (selectedProfileId != null) {
        await addExample(selectedProfileId, input);
      }
      setModalOpen(false);
      setEditingExample(null);
      await reloadExamples();
      showToast('예시 TC를 저장했습니다.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '예시 저장에 실패했습니다.');
    }
  };

  const handleDeleteExample = async (id: number) => {
    if (!window.confirm('이 예시 TC를 삭제하시겠습니까?')) return;
    try {
      await deleteExample(id);
      await reloadExamples();
      showToast('예시 TC를 삭제했습니다.');
    } catch {
      showToast('예시 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1">스타일 설정</h1>
          <p className="text-gray-600 text-sm">
            팀 방식대로 작성한 예시 TC를 등록하면, TestCase 자동 생성 시 그 형식·문체를 그대로 따릅니다.
          </p>
        </div>
        <button
          onClick={() =>
            navigate(
              companyId ? `/test-studio?companyId=${companyId}` : '/test-studio'
            )
          }
          className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 shrink-0"
        >
          ← Test Studio
        </button>
      </div>

      {toast && (
        <div className="rounded-md bg-indigo-50 border border-indigo-200 px-4 py-2 text-sm text-indigo-700">
          {toast}
        </div>
      )}

      {/* Company selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Company</label>
        <select
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white min-w-[220px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={companyId ?? ''}
          onChange={(e) =>
            handleCompanyChange(e.target.value ? Number(e.target.value) : null)
          }
          data-testid="style-company-select"
        >
          <option value="">— 선택 —</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.isActive ? ' (활성)' : ''}
            </option>
          ))}
        </select>
      </div>

      {!companyId ? (
        <div className="rounded-md border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          Company를 선택하면 스타일 세트를 관리할 수 있습니다.
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <>
          {/* 활성 세트 선택 */}
          <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">활성 스타일 세트</h2>
            <p className="text-xs text-gray-500">
              선택한 세트의 예시 TC가 생성 시 참고됩니다. <b>{SAMPLE_PROFILE_NAME}</b>은(는) 기본
              견본(로그인)이며, 직접 지정하려면 새 세트를 만들어 예시를 추가하세요.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white min-w-[220px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedProfileId ?? ''}
                onChange={(e) => handleSelectChange(e.target.value)}
                disabled={isLoading}
                data-testid="style-profile-select"
              >
                <option value="">{SAMPLE_PROFILE_NAME} (기본 견본)</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.exampleCount})
                  </option>
                ))}
              </select>

              {selectedProfile && !renaming && (
                <>
                  <button
                    onClick={() => {
                      setRenameValue(selectedProfile.name);
                      setRenaming(true);
                    }}
                    className="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                    data-testid="style-rename-start"
                  >
                    이름 변경
                  </button>
                  <button
                    onClick={handleDeleteProfile}
                    className="px-2.5 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                    data-testid="style-delete-profile"
                  >
                    세트 삭제
                  </button>
                </>
              )}

              {selectedProfile && renaming && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                    data-testid="style-rename-input"
                  />
                  <button
                    onClick={handleRename}
                    className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    data-testid="style-rename-save"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setRenaming(false)}
                    className="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>

            {/* 새 세트 만들기 */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="새 세트 이름 (예: 결제팀 스타일)"
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm min-w-[220px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                data-testid="style-create-input"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                data-testid="style-create-button"
              >
                + 새 세트
              </button>
            </div>
          </section>

          {/* 예시 TC 목록 (실제 세트 선택 시) */}
          {selectedProfileId == null ? (
            <section
              className="rounded-md border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500"
              data-testid="style-sample-notice"
            >
              현재 <b>{SAMPLE_PROFILE_NAME}</b>(기본 견본, 로그인)이 사용됩니다. 팀 스타일을 직접
              지정하려면 위에서 새 세트를 만들고 예시 TC를 추가하세요.
            </section>
          ) : (
            <section className="space-y-3" data-testid="style-examples-section">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  예시 TC ({examples.length})
                </h2>
                <button
                  onClick={() => {
                    setEditingExample(null);
                    setModalOpen(true);
                  }}
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  data-testid="style-add-example-button"
                >
                  + 예시 TC 추가
                </button>
              </div>

              {examples.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                  로그인처럼 보편적인 기능의 대표 TC를 평소 팀 방식대로 <b>정상 2 + 실패 1 (총 3개)</b>{' '}
                  작성하세요. 내용이 아니라 <b>형식·문체</b>가 학습됩니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {examples.map((ex) => (
                    <div
                      key={ex.id ?? ex.title}
                      className="bg-white border rounded-lg shadow-sm p-3 flex items-start justify-between gap-3"
                      data-testid="style-example-row"
                    >
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm truncate">{ex.title}</h3>
                        <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-3">
                          <span>Step {ex.steps?.length ?? 0}개</span>
                          <span>기대결과 {ex.expectedResults?.length ?? 0}개</span>
                          {ex.priority && <span>{ex.priority}</span>}
                          {ex.testType && <span>{ex.testType}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setEditingExample(ex);
                            setModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                          data-testid="style-example-edit"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => ex.id != null && handleDeleteExample(ex.id)}
                          className="px-2.5 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                          data-testid="style-example-delete"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 보조 설정 (enum) */}
          <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">보조 설정</h2>
            <p className="text-xs text-gray-500">
              예시 TC가 있으면 예시가 우선합니다. 아래는 예시가 보여주지 못하는 부분의 약한 힌트입니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Step 포맷
                </label>
                <select
                  value={config?.stepFormat ?? 'ACTION_EXPECTED'}
                  onChange={(e) =>
                    updateConfig({ stepFormat: e.target.value as StepFormat })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  data-testid="style-config-stepformat"
                >
                  {(Object.keys(STEP_FORMAT_LABELS) as StepFormat[]).map((k) => (
                    <option key={k} value={k}>
                      {STEP_FORMAT_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  상세 수준
                </label>
                <select
                  value={config?.detailLevel ?? 'STANDARD'}
                  onChange={(e) =>
                    updateConfig({ detailLevel: e.target.value as DetailLevel })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  data-testid="style-config-detaillevel"
                >
                  {(Object.keys(DETAIL_LEVEL_LABELS) as DetailLevel[]).map((k) => (
                    <option key={k} value={k}>
                      {DETAIL_LEVEL_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  문체/어조
                </label>
                <select
                  value={config?.tone ?? 'PLAIN'}
                  onChange={(e) => updateConfig({ tone: e.target.value as Tone })}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  data-testid="style-config-tone"
                >
                  {(Object.keys(TONE_LABELS) as Tone[]).map((k) => (
                    <option key={k} value={k}>
                      {TONE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        </>
      )}

      <StyleExampleModal
        isOpen={modalOpen}
        initial={editingExample}
        onClose={() => {
          setModalOpen(false);
          setEditingExample(null);
        }}
        onSubmit={handleExampleSubmit}
      />
    </div>
  );
}
