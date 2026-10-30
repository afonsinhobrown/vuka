import React, { createContext, useContext, useState } from 'react';
import { UserDTO } from '@vuka/shared';

interface AuthContextType {
  user: UserDTO | null;
  token: string | null;
  login: (token: string, user: UserDTO) => void;
  logout: () => void;
  publisherId?: string | null;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('vuka_publisher_token'));
  const [user, setUser] = useState<UserDTO | null>(() => {
    const saved = localStorage.getItem('vuka_publisher_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (newToken: string, newUser: UserDTO) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('vuka_publisher_token', newToken);
    localStorage.setItem('vuka_publisher_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('vuka_publisher_token');
    localStorage.removeItem('vuka_publisher_user');
  };

  const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  };

  const publisherId = user?.publisherId;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, publisherId, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
