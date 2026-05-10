import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuthPermisos } from '../lib/api';
import { useAuth } from './AuthContext';

interface PermissionsContextType {
  permissions: string[];
  loading: boolean;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  refresh: () => void;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPermissions = async () => {
    if (authLoading) return; // esperar que auth resuelva primero
    const token = localStorage.getItem('roka_token');
    if (!token || !user) {
      setPermissions([]);
      setLoading(false);
      return;
    }
    try {
      const perms = await getAuthPermisos();
      setPermissions(perms);
    } catch (error) {
      console.error('Error al cargar permisos:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, [user, authLoading]);

  const hasPermission = (code: string): boolean => {
    return permissions.includes(code);
  };

  const hasAnyPermission = (codes: string[]): boolean => {
    return codes.some(code => permissions.includes(code));
  };

  return (
    <PermissionsContext.Provider value={{ permissions, loading, hasPermission, hasAnyPermission, refresh: loadPermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}