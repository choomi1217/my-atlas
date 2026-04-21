import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { AuthUser, LoginRequest, LoginResponse } from '@/types/auth';
import { authApi } from '@/api/auth';
import { apiClient } from '@/api/client';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginRequired: boolean;
  login: (request: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshPublicSettings: () => Promise<void>;
  setLoginRequired: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'my-atlas-token';
const USER_KEY = 'my-atlas-user';
const TIMEOUT_KEY = 'my-atlas-session-timeout';
const LOGIN_REQUIRED_KEY = 'my-atlas-login-required';

interface ApiResponseShape<T> {
  success: boolean;
  message: string;
  data: T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginRequired, setLoginRequiredState] = useState<boolean>(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSessionTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const logout = useCallback(() => {
    clearSessionTimer();
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TIMEOUT_KEY);
  }, [clearSessionTimer]);

  const startSessionTimer = useCallback((timeoutSeconds: number) => {
    clearSessionTimer();
    timeoutRef.current = setTimeout(() => {
      logout();
      window.location.href = '/login';
    }, timeoutSeconds * 1000);
  }, [clearSessionTimer, logout]);

  const setLoginRequired = useCallback((value: boolean) => {
    setLoginRequiredState(value);
    localStorage.setItem(LOGIN_REQUIRED_KEY, String(value));
  }, []);

  const refreshPublicSettings = useCallback(async () => {
    try {
      const response = await apiClient.get<ApiResponseShape<{ loginRequired: boolean }>>(
        '/api/settings/public',
      );
      const value = response.data.data.loginRequired;
      setLoginRequired(value);
    } catch {
      // Network or server error — keep safe default (true).
    }
  }, [setLoginRequired]);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    const savedTimeout = localStorage.getItem(TIMEOUT_KEY);
    const savedLoginRequired = localStorage.getItem(LOGIN_REQUIRED_KEY);

    if (savedLoginRequired !== null) {
      setLoginRequiredState(savedLoginRequired === 'true');
    }

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        if (savedTimeout) {
          startSessionTimer(Number(savedTimeout));
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TIMEOUT_KEY);
      }
    }

    // Always refresh public settings (authoritative source)
    refreshPublicSettings().finally(() => setIsLoading(false));
  }, [startSessionTimer, refreshPublicSettings]);

  const login = useCallback(async (request: LoginRequest) => {
    const response: LoginResponse = await authApi.login(request);
    const authUser: AuthUser = { username: response.username, role: response.role };

    setToken(response.token);
    setUser(authUser);
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    localStorage.setItem(TIMEOUT_KEY, String(response.sessionTimeoutSeconds));

    startSessionTimer(response.sessionTimeoutSeconds);
  }, [startSessionTimer]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        loginRequired,
        login,
        logout,
        refreshPublicSettings,
        setLoginRequired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
