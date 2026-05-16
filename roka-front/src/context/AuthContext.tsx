import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Usuario } from '../types';
import { getMe, login as loginApi } from '../lib/api';

interface AuthContextType {
  user: Usuario | null;
  loading: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('roka_token');
    
    const restoreSession = async () => {
      if (token) {
        try {
          const u = await getMe();
          setUser(u);
          // If we are at login and have a user, go to home
          if (location.pathname === '/login') {
            navigate('/', { replace: true });
          }
        } catch (error) {
          console.error('Error al restaurar sesión:', error);
          localStorage.removeItem('roka_token');
          setUser(null);
        }
      }
      setLoading(false);
    };

    restoreSession();
  }, [navigate]);

  const login = async (credentials: any) => {
    const res = await loginApi(credentials);
    localStorage.setItem('roka_token', res.token);
    setUser(res.user);
    navigate('/', { replace: true });
  };

  const logout = () => {
    console.log('Cerrando sesión...');
    localStorage.removeItem('roka_token');
    setUser(null);
    navigate('/login', { replace: true });
  };

  const refreshUser = async () => {
    try {
      const u = await getMe();
      setUser(u);
    } catch (error) {
      console.error('Error al refrescar usuario:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
