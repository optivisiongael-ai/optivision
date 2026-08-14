import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { AuthProvider, useAuth } from './lib/supabase/auth';
import { NavGuardProvider } from './lib/navGuard';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import NewSale from './pages/NewSale';
import Clients from './pages/Clients';
import MyActivity from './pages/MyActivity';
import SaleReceipt from './pages/SaleReceipt';
import Sales from './pages/Sales';

// ── Protected Route (requiere sesión activa) ───────────────────
const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-base)' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return children;
};

// ── Admin-Only Route ───────────────────────────────────────────
const AdminRoute = ({ children }: { children: ReactElement }) => {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (profile?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Ruta pública — sin login requerido */}
      <Route path="/boleta/:id" element={<SaleReceipt />} />

      <Route path="/login" element={<Login />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        {/* Rutas compartidas */}
        <Route index element={<Dashboard />} />

        {/* Rutas ADMIN */}
        <Route path="products" element={<AdminRoute><Products /></AdminRoute>} />
        <Route path="inventory" element={<AdminRoute><Inventory /></AdminRoute>} />
        <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

        {/* Rutas VENDEDOR */}
        <Route path="new-sale" element={<NewSale />} />
        <Route path="clients" element={<Clients />} />
        <Route path="my-activity" element={<MyActivity />} />
        <Route path="ventas" element={<Sales />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <NavGuardProvider>
          <AppRoutes />
        </NavGuardProvider>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
