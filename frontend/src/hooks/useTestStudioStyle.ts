import { useCallback, useEffect, useState } from 'react';
import { testStudioStyleApi } from '@/api/test-studio-style';
import {
  StyleProfile,
  StyleExample,
  StyleExampleInput,
  TestStudioConfig,
} from '@/types/test-studio';

interface ConfigPatch {
  selectedProfileId?: number | null;
  stepFormat?: TestStudioConfig['stepFormat'];
  detailLevel?: TestStudioConfig['detailLevel'];
  tone?: TestStudioConfig['tone'];
}

interface UseTestStudioStyleResult {
  profiles: StyleProfile[];
  config: TestStudioConfig | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  // 세트
  createProfile: (name: string) => Promise<StyleProfile>;
  renameProfile: (id: number, name: string) => Promise<void>;
  deleteProfile: (id: number) => Promise<void>;
  // 설정 / 활성 세트 선택
  selectProfile: (profileId: number | null) => Promise<void>;
  updateConfig: (patch: ConfigPatch) => Promise<void>;
  // 예시 TC (passthrough — 호출측이 listExamples/refresh로 갱신)
  listExamples: (profileId: number) => Promise<StyleExample[]>;
  addExample: (profileId: number, input: StyleExampleInput) => Promise<StyleExample>;
  updateExample: (id: number, input: StyleExampleInput) => Promise<StyleExample>;
  deleteExample: (id: number) => Promise<void>;
}

/**
 * Test Studio v2.5 — Company별 스타일 세트/예시/보조 설정 관리 훅.
 *
 * profiles + config를 로드하고, 세트/설정 변경 헬퍼와 예시 TC CRUD passthrough를 제공한다.
 * 세트/예시 개수가 바뀌는 변경 후에는 exampleCount 동기화를 위해 전체를 다시 로드한다.
 */
export function useTestStudioStyle(
  companyId: number | undefined
): UseTestStudioStyleResult {
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [config, setConfig] = useState<TestStudioConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setProfiles([]);
      setConfig(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [profileList, cfg] = await Promise.all([
        testStudioStyleApi.listProfiles(companyId),
        testStudioStyleApi.getConfig(companyId),
      ]);
      setProfiles(profileList);
      setConfig(cfg);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load style settings'
      );
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const createProfile = useCallback(
    async (name: string): Promise<StyleProfile> => {
      if (!companyId) throw new Error('companyId is required');
      const created = await testStudioStyleApi.createProfile(companyId, name);
      await load();
      return created;
    },
    [companyId, load]
  );

  const renameProfile = useCallback(
    async (id: number, name: string) => {
      await testStudioStyleApi.renameProfile(id, name);
      await load();
    },
    [load]
  );

  const deleteProfile = useCallback(
    async (id: number) => {
      await testStudioStyleApi.deleteProfile(id);
      await load();
    },
    [load]
  );

  const persistConfig = useCallback(
    async (patch: ConfigPatch) => {
      if (!companyId) throw new Error('companyId is required');
      const base: TestStudioConfig = config ?? {
        companyId,
        selectedProfileId: null,
        stepFormat: 'ACTION_EXPECTED',
        detailLevel: 'STANDARD',
        tone: 'PLAIN',
      };
      const next: TestStudioConfig = { ...base, companyId, ...patch };
      const saved = await testStudioStyleApi.upsertConfig(next);
      setConfig(saved);
    },
    [companyId, config]
  );

  const selectProfile = useCallback(
    async (profileId: number | null) => {
      await persistConfig({ selectedProfileId: profileId });
    },
    [persistConfig]
  );

  const updateConfig = useCallback(
    async (patch: ConfigPatch) => {
      await persistConfig(patch);
    },
    [persistConfig]
  );

  const listExamples = useCallback(
    (profileId: number) => testStudioStyleApi.listExamples(profileId),
    []
  );

  const addExample = useCallback(
    async (profileId: number, input: StyleExampleInput) => {
      const created = await testStudioStyleApi.addExample(profileId, input);
      await load(); // exampleCount 동기화
      return created;
    },
    [load]
  );

  const updateExample = useCallback(
    (id: number, input: StyleExampleInput) =>
      testStudioStyleApi.updateExample(id, input),
    []
  );

  const deleteExample = useCallback(
    async (id: number) => {
      await testStudioStyleApi.deleteExample(id);
      await load(); // exampleCount 동기화
    },
    [load]
  );

  return {
    profiles,
    config,
    isLoading,
    error,
    refresh,
    createProfile,
    renameProfile,
    deleteProfile,
    selectProfile,
    updateConfig,
    listExamples,
    addExample,
    updateExample,
    deleteExample,
  };
}
