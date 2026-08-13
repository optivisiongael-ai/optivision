import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Warehouse, Settings, ShoppingCart,
  Users, Activity, LogOut, Menu, X, Eye, ChevronRight
} from 'lucide-react';
import { useAuth } from '../lib/supabase/auth';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = profile?.role === 'ADMIN';

  const adminNav = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Productos / SKUs', path: '/products', icon: Package },
    { name: 'Inventario', path: '/inventory', icon: Warehouse },
    { name: 'Configuración', path: '/settings', icon: Settings },
  ];

  const vendedorNav = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Nueva Venta', path: '/new-sale', icon: ShoppingCart },
    { name: 'Clientes', path: '/clients', icon: Users },
    { name: 'Mi Actividad', path: '/my-activity', icon: Activity },
  ];

  const navItems = isAdmin ? adminNav : vendedorNav;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, rgba(8,145,178,0.08), transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-400))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(6,182,212,0.35)',
          }}>
            <Eye size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-brand-400)', letterSpacing: '-0.02em' }}>
              OPTIVISION
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>
              SISTEMA ÓPTICA
            </div>
          </div>
        </div>
        {/* Mobile close */}
        <button
          onClick={closeSidebar}
          className="btn btn-ghost btn-icon"
          style={{ display: 'none' }}
          id="sidebar-close-btn"
        >
          <X size={18} />
        </button>
      </div>

      {/* Role badge */}
      <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: isAdmin ? 'rgba(6,182,212,0.15)' : 'rgba(139,92,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.875rem', fontWeight: 700,
            color: isAdmin ? 'var(--color-brand-400)' : '#a78bfa',
            flexShrink: 0,
          }}>
            {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {profile?.full_name || profile?.email}
            </div>
            <span className={`badge ${isAdmin ? 'badge-teal' : 'badge-blue'}`} style={{ marginTop: 2 }}>
              {isAdmin ? '⚡ Admin' : '🛒 Vendedor'}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        <p className="section-title">Navegación</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeSidebar}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.625rem 0.875rem', borderRadius: 10,
                  textDecoration: 'none', transition: 'all 0.15s',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(8,145,178,0.2), rgba(6,182,212,0.1))'
                    : 'transparent',
                  border: isActive ? '1px solid rgba(6,182,212,0.2)' : '1px solid transparent',
                  color: isActive ? 'var(--color-brand-400)' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.875rem',
                }}
                className={isActive ? '' : 'nav-link-hover'}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-card)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)';
                  }
                }}
              >
                <Icon size={18} />
                <span style={{ flex: 1 }}>{item.name}</span>
                {isActive && <ChevronRight size={14} style={{ opacity: 0.6 }} />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={handleSignOut}
          className="btn btn-ghost"
          style={{ width: '100%', color: '#f87171', gap: '0.625rem' }}
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--color-bg-base)', overflow: 'hidden' }}>
      {/* Desktop sidebar */}
      <aside style={{
        width: 260, flexShrink: 0,
        background: 'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
      }} className="hidden-mobile">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={closeSidebar}
          style={{
            position: 'fixed', inset: 0, zIndex: 20,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* Mobile drawer */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 30,
        width: 280,
        background: 'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border)',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Mobile top bar */}
        <header style={{
          height: 56,
          background: 'var(--color-bg-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '0.875rem',
          flexShrink: 0,
        }} className="mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-icon">
            <Menu size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Eye size={16} color="var(--color-brand-400)" />
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-brand-400)' }}>OPTIVISION</span>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }} className="main-content">
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .hidden-mobile { display: flex !important; }
          .mobile-header { display: none !important; }
        }
        @media (max-width: 1023px) {
          .hidden-mobile { display: none !important; }
          .main-content { padding: 1rem !important; }
        }
      `}</style>
    </div>
  );
}
