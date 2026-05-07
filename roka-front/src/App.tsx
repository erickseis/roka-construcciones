import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import { ThemeProvider } from './context/ThemeContext';
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

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/solicitudes" element={<SolicitudesPage />} />
                <Route path="/materiales" element={<MaterialesPage />} />
                <Route path="/proveedores" element={<ProveedoresPage />} />
                <Route path="/cotizaciones" element={<SolicitudCotizacionTab />} />
                <Route path="/ordenes" element={<OrdenesPage />} />
                <Route path="/proyectos" element={<ProyectosPage />} />
                <Route path="/presupuestos" element={<PresupuestosPage />} />
                <Route path="/config" element={<ConfigPage />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
