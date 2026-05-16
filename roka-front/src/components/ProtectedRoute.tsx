import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../context/PermissionsContext';
import { getFirstAvailableRoute } from '../lib/navigation';

interface ProtectedRouteProps {
  permission: string;
  children: React.ReactNode;
}

export default function ProtectedRoute({ permission, children }: ProtectedRouteProps) {
  const { hasPermission, permissions, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-sm text-slate-400">Cargando permisos...</div>
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return <Navigate to={getFirstAvailableRoute(permissions)} replace />;
  }

  return <>{children}</>;
}