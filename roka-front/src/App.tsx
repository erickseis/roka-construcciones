import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PermissionsProvider, usePermissions } from './context/PermissionsContext';
import { MainLayout } from './components/layout/MainLayout';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import { getFirstAvailableRoute } from './lib/navigation';
import LoginPage from './pages/LoginPage';
import DashboardPage from './components/dashboard/DashboardPage';
import SolicitudesPage from './components/solicitudes/SolicitudesPage';
import SolicitudCotizacionTab from './components/cotizaciones/SolicitudCotizacionTab';
import OrdenesPage from './components/ordenes/OrdenesPage';
import ConfigPage from './pages/config/ConfigPage';
import MaterialesPage from './components/materiales/MaterialesPage';
import ProveedoresPage from './components/proveedores/ProveedoresPage';
import ProyectosPage from './components/proyectos/ProyectosPage';
import PresupuestosPage from './components/presupuestos/PresupuestosPage';

function FirstAvailableRedirect() {
  const { permissions } = usePermissions();
  return <Navigate to={getFirstAvailableRoute(permissions)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PermissionsProvider>
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

              {/* Fallback */}
              <Route path="*" element={<FirstAvailableRedirect />} />
            </Routes>
          </PermissionsProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
