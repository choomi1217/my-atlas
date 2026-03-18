import { create } from 'zustand';
import { Company } from '@/types/features';

interface FeatureStore {
  activeCompany: Company | null;
  setActiveCompany: (company: Company | null) => void;
}

/**
 * Global state store for feature domain.
 * Manages the currently active company across all pages.
 */
export const useFeatureStore = create<FeatureStore>((set) => ({
  activeCompany: null,
  setActiveCompany: (company) => set({ activeCompany: company }),
}));
