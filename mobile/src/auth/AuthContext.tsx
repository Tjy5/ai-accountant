import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../../../shared/utils/api';
import { secureStorage } from '../storage/secureStorage';
import { initDatabase } from '../storage/localDB';

interface User {
  id: number;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.setBaseUrl(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001');
    initDatabase().catch(console.error);
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await secureStorage.getToken();
      const storedUser = await secureStorage.getUser();
      if (storedToken && storedUser) {
        api.setAuthToken(storedToken);
        setToken(storedToken);
        setUser(storedUser);
      }
    } catch (error) {
      console.error('Failed to load auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const response = await api.post<{ token: string; user: User }>('/api/auth/login', {
      email,
      password,
    });
    api.setAuthToken(response.token);
    await secureStorage.setToken(response.token);
    await secureStorage.setUser(response.user);
    setToken(response.token);
    setUser(response.user);
  };

  const register = async (email: string, password: string, name?: string) => {
    const response = await api.post<{ token: string; user: User }>('/api/auth/register', {
      email,
      password,
      name,
    });
    api.setAuthToken(response.token);
    await secureStorage.setToken(response.token);
    await secureStorage.setUser(response.user);
    setToken(response.token);
    setUser(response.user);
  };

  const signOut = async () => {
    api.setAuthToken(null);
    await secureStorage.clearAll();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, register, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
