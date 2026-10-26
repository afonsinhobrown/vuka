import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserDTO, UserRole } from '@vuka/shared';

interface AuthContextType {
  user: UserDTO | null;
  token: string | null;
  login: (token: string, user: UserDTO) => void;
  logout: () => void;
  isAdmin: boolean;
  isPublisher: boolean;
  publisherId?: string | null;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('vuka_admin_token'));
  const [user, setUser] = useState<UserDTO | null>(() => {
    const saved = localStorage.getItem('vuka_admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (newToken: string, newUser: UserDTO) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('vuka_admin_token', newToken);
    localStorage.setItem('vuka_admin_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('vuka_admin_token');
    localStorage.removeItem('vuka_admin_user');
  };

  const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  };

  const isAdmin = user?.role === UserRole.ADMIN;
  const isPublisher = user?.role === UserRole.PUBLISHER_ADMIN || user?.role === UserRole.PUBLISHER_EDITOR;
  const publisherId = user?.publisherId;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin, isPublisher, publisherId, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
