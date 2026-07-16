import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'SUBMITTER' | 'APPROVER' | 'FINANCE_ADMIN';
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Simple helper to decode JWT without external libraries to ensure runtime stability
function decodeJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error decoding JWT', e);
    return null;
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from local storage on mount
  useEffect(() => {
    const storedAccess = localStorage.getItem('accessToken');
    const storedRefresh = localStorage.getItem('refreshToken');

    if (storedAccess && storedRefresh) {
      const decoded = decodeJwt(storedAccess);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        setAccessToken(storedAccess);
        setRefreshToken(storedRefresh);
        setUser({
          id: decoded.user_id,
          username: decoded.username,
          email: decoded.email,
          role: decoded.role,
        });
        setLoading(false);
      } else {
        // Access token is expired, try to refresh
        refreshAccessToken(storedRefresh)
          .catch(() => {
            // If refresh fails, clear
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          })
          .finally(() => setLoading(false));
      }
    } else {
      setLoading(false);
    }
  }, []);

  const refreshAccessToken = async (rToken: string): Promise<string> => {
    try {
      const res = await fetch(`${API_URL}/api/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: rToken }),
      });

      if (!res.ok) throw new Error('Token refresh failed');

      const data = await res.json();
      const newAccess = data.access;
      const newRefresh = data.refresh || rToken;

      setAccessToken(newAccess);
      setRefreshToken(newRefresh);
      localStorage.setItem('accessToken', newAccess);
      localStorage.setItem('refreshToken', newRefresh);

      const decoded = decodeJwt(newAccess);
      if (decoded) {
        setUser({
          id: decoded.user_id,
          username: decoded.username,
          email: decoded.email,
          role: decoded.role,
        });
      }
      return newAccess;
    } catch (err) {
      logout();
      throw err;
    }
  };

  const login = async (username: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Login failed. Please check credentials.');
    }

    const data = await res.json();
    const access = data.access;
    const refresh = data.refresh;

    setAccessToken(access);
    setRefreshToken(refresh);
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);

    const decoded = decodeJwt(access);
    if (decoded) {
      setUser({
        id: decoded.user_id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role,
      });
    }
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  // Custom fetch that automatically appends JWT and handles auto-refresh on 401
  const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    let headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    let tokenToUse = accessToken;

    // Check if token is expired, refresh if needed
    if (tokenToUse && refreshToken) {
      const decoded = decodeJwt(tokenToUse);
      if (decoded && decoded.exp * 1000 < Date.now() + 5000) { // 5s grace period
        try {
          tokenToUse = await refreshAccessToken(refreshToken);
        } catch (e) {
          tokenToUse = null;
        }
      }
    }

    if (tokenToUse) {
      headers['Authorization'] = `Bearer ${tokenToUse}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const fetchUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
    let response = await fetch(fetchUrl, { ...options, headers });

    // Handle expired tokens that weren't caught pre-fetch (e.g. clock skew)
    if (response.status === 401 && refreshToken) {
      try {
        const newAccess = await refreshAccessToken(refreshToken);
        headers['Authorization'] = `Bearer ${newAccess}`;
        response = await fetch(fetchUrl, { ...options, headers });
      } catch (e) {
        // Refresh failed, logout is called inside refreshAccessToken
      }
    }

    return response;
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
