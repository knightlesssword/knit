import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { ApiError, api, getToken, setToken, User } from "../../lib/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  /** True when the stored token was kept but the local server can't be reached. */
  serverUnreachable: boolean;
  retry: () => void;
  login: (identifier: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverUnreachable, setServerUnreachable] = useState(false);

  const checkSession = useCallback(() => {
    if (!getToken()) {
      setUser(null);
      setServerUnreachable(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setServerUnreachable(false);
    api
      .me()
      .then(setUser)
      .catch((err: unknown) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          // genuinely unauthorized: drop the token and fall back to login
          setToken(null);
          setUser(null);
        } else if (err instanceof ApiError && err.status === 0) {
          // network failure: the backend may just be down — keep the token
          // so Shell can offer a retry instead of dropping to login
          setServerUnreachable(true);
        }
        // other errors: keep the token, surface the login screen
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (identifier: string, password: string) => {
    const res = await api.login({ identifier, password });
    setToken(res.token);
    setUser(res.user);
    setServerUnreachable(false);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await api.register({ name, email, password });
    setToken(res.token);
    setUser(res.user);
    setServerUnreachable(false);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setServerUnreachable(false);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, serverUnreachable, retry: checkSession, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
