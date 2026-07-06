import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  changePassword as changePasswordApi,
  fetchMe,
  login as loginApi,
  logout as logoutApi,
  refreshToken as refreshTokenApi,
  type AuthUser,
} from '../api/authApi';
import { clearAuthTokens, getAccessToken } from '../api/authToken';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!getAccessToken()) {
      if (active) {
        setUser(null);
        setLoading(false);
      }
      return () => {
        active = false;
      };
    }
    fetchMe()
      .then((nextUser) => {
        if (active) setUser(nextUser);
      })
      .catch(() => refreshTokenApi().then((nextUser) => {
        if (active) setUser(nextUser);
      }).catch(() => {
        clearAuthTokens();
        if (active) setUser(null);
      }))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const nextUser = await loginApi(username, password);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    await logoutApi().catch(() => undefined);
    clearAuthTokens();
    setUser(null);
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string, confirmPassword: string) => {
    await changePasswordApi(oldPassword, newPassword, confirmPassword);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, changePassword }),
    [changePassword, loading, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
