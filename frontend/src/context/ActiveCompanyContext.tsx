/* eslint-disable react-refresh/only-export-components */
import React, { createContext, ReactNode, useState, useCallback } from 'react';
import { Company } from '@/types/features';

interface ActiveCompanyContextType {
  activeCompany: Company | null;
  setActiveCompany: (company: Company | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const ActiveCompanyContext = createContext<
  ActiveCompanyContextType | undefined
>(undefined);

interface ActiveCompanyProviderProps {
  children: ReactNode;
}

/**
 * Provider for managing active company context.
 */
export function ActiveCompanyProvider({
  children,
}: ActiveCompanyProviderProps) {
  const [activeCompany, setActiveCompanyState] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setActiveCompany = useCallback((company: Company | null) => {
    setActiveCompanyState(company);
  }, []);

  return (
    <ActiveCompanyContext.Provider
      value={{ activeCompany, setActiveCompany, isLoading, setIsLoading }}
    >
      {children}
    </ActiveCompanyContext.Provider>
  );
}

/**
 * Hook to use active company context.
 */
export function useActiveCompany() {
  const context = React.useContext(ActiveCompanyContext);
  if (!context) {
    throw new Error(
      'useActiveCompany must be used within ActiveCompanyProvider'
    );
  }
  return context;
}
