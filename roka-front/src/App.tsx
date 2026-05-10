import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { PermissionsProvider, usePermissions } from './context/PermissionsContext';
import { MainLayout } from './components/layout/MainLayout';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import { getFirstAvailableRoute } from './lib/navigation';
import LoginPage from './pages/LoginPage';

const DashboardPage = lazy(() => import('./components/dashboard/DashboardPage'));
const SolicitudesPage = lazy(() => import('./components/solicitudes/SolicitudesPage'));
const SolicitudCotizacionTab = lazy(() => import('./components/cotizaciones/SolicitudCotizacionTab'));
const OrdenesPage = lazy(() => import('./components/ordenes/OrdenesPage'));
const ConfigPage = lazy(() => import('./pages/config/ConfigPage'));
const MaterialesPage = lazy(() => import('./components/materiales/MaterialesPage'));
const ProveedoresPage = lazy(() => import('./components/proveedores/ProveedoresPage'));
const ProyectosPage = lazy(() => import('./components/proyectos/ProyectosPage'));
const PresupuestosPage = lazy(() => import('./components/presupuestos/PresupuestosPage'));

function FirstAvailableRedirect() {
  const { permissions, loading } = usePermissions();
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="text-sm text-slate-400">Cargando...</div></div>;
  return <Navigate to={getFirstAvailableRoute(permissions)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PermissionsProvider>
            <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="text-sm text-slate-400">Cargando...</div></div>}>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected Routes */}
                <Route element={<MainLayout />}>
                  <Route path="/" element={<ProtectedRoute permission="dashboard.view"><DashboardPage /></ProtectedRoute>} />
                  <Route path="/solicitudes" element={<ProtectedRoute permission="solicitudes.view"><SolicitudesPage /></ProtectedRoute>} />
                  <Route path="/cotizaciones" element={<ProtectedRoute permission="cotizaciones.view"><SolicitudCotizacionTab /></ProtectedRoute>} />
                  <Route path="/ordenes" element={<ProtectedRoute permission="ordenes.view"><OrdenesPage /></ProtectedRoute>} />
                  <Route path="/proyectos" element={<ProtectedRoute permission="proyectos.view"><ProyectosPage /></ProtectedRoute>} />
                  <Route path="/presupuestos" element={<ProtectedRoute permission="presupuestos.view"><PresupuestosPage /></ProtectedRoute>} />
                  <Route path="/materiales" element={<ProtectedRoute permission="materiales.view"><MaterialesPage /></ProtectedRoute>} />
                  <Route path="/proveedores" element={<ProtectedRoute permission="proveedores.view"><ProveedoresPage /></ProtectedRoute>} />
                  <Route path="/config" element={<ProtectedRoute permission="config.manage"><ConfigPage /></ProtectedRoute>} />
                </Route>

                {/* Sin acceso */}
                {/* <Route path="/sin-acceso" element={<SinAccesoPage />} /> */}

                {/* Fallback */}
                <Route path="*" element={<FirstAvailableRedirect />} />
              </Routes>
            </Suspense>
          </PermissionsProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
