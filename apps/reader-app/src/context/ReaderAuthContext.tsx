import React, { createContext, useContext, useState } from 'react';
import { UserDTO } from '@vuka/shared';

interface ReaderAuthContextType {
  user: UserDTO | null;
  token: string | null;
  login: (token: string, user: UserDTO) => void;
  logout: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const ReaderAuthContext = createContext<ReaderAuthContextType | undefined>(undefined);

export const ReaderAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('vuka_reader_token'));
  const [user, setUser] = useState<UserDTO | null>(() => {
    const saved = localStorage.getItem('vuka_reader_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (newToken: string, newUser: UserDTO) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('vuka_reader_token', newToken);
    localStorage.setItem('vuka_reader_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('vuka_reader_token');
    localStorage.removeItem('vuka_reader_user');
  };

  const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  };

  return (
    <ReaderAuthContext.Provider value={{ user, token, login, logout, authFetch }}>
      {children}
    </ReaderAuthContext.Provider>
  );
};

export const useReaderAuth = () => {
  const context = useContext(ReaderAuthContext);
  if (!context) throw new Error('useReaderAuth must be used within a ReaderAuthProvider');
  return context;
};
