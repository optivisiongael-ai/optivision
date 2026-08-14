import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Warehouse, Settings, ShoppingCart,
  Users, Activity, LogOut, Menu, X, ChevronRight, Moon, Sun
} from 'lucide-react';
import { useAuth } from '../lib/supabase/auth';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

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
      {/* Logo + close button */}
      <div style={{
        padding: '0.5rem 1rem',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: theme === 'dark'
          ? 'linear-gradient(135deg, rgba(255,180,0,0.05), transparent)'
          : 'linear-gradient(135deg, rgba(0,80,180,0.04), transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: '6px 12px',
            display: 'inline-flex',
          }}>
            <img
              src="/logo.png"
              alt="OPTIVISION"
              style={{ height: 90, width: 'auto', objectFit: 'contain' }}
            />
          </div>
        </div>
        {/* Close button – only visible on mobile */}
        <button
          onClick={closeSidebar}
          className="btn btn-ghost btn-icon mobile-only"
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
      </div>

      {/* User / Role badge */}
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
      <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          className="btn btn-ghost"
          style={{ width: '100%', gap: '0.625rem', color: 'var(--color-text-secondary)', justifyContent: 'flex-start' }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
        </button>
        <button
          onClick={handleSignOut}
          className="btn btn-ghost"
          style={{ width: '100%', color: '#f87171', gap: '0.625rem', justifyContent: 'flex-start' }}
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--color-bg-base)', overflow: 'hidden' }}>

      {/* ── SIDEBAR DESKTOP (siempre visible lg+) ── */}
      <aside style={{
        width: 260, flexShrink: 0,
        background: 'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
      }} className="sidebar-desktop">
        <SidebarContent />
      </aside>

      {/* ── OVERLAY MOBILE (backdrop oscuro al abrir el drawer) ── */}
      {sidebarOpen && (
        <div
          onClick={closeSidebar}
          style={{
            position: 'fixed', inset: 0, zIndex: 20,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}
          className="sidebar-overlay"
        />
      )}

      {/* ── SIDEBAR MOBILE (drawer deslizable) ── */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 30,
        width: 280,
        background: 'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border)',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column',
      }} className="sidebar-mobile">
        <SidebarContent />
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar — solo visible en mobile */}
        <header style={{
          height: 56,
          background: 'var(--color-bg-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '0.875rem',
          flexShrink: 0,
        }} className="topbar-mobile">
          <button
            onClick={() => setSidebarOpen(true)}
            className="btn btn-ghost btn-icon"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <img
            src="/logo.png"
            alt="OPTIVISION"
            style={{ height: 38, width: 'auto', objectFit: 'contain' }}
          />
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }} className="main-scroll">
          <Outlet />
        </main>
      </div>

      <style>{`
        /* Desktop: sidebar visible, no topbar, no mobile-only elements */
        @media (min-width: 1024px) {
          .sidebar-desktop { display: flex !important; }
          .sidebar-mobile  { display: none !important; }
          .sidebar-overlay { display: none !important; }
          .topbar-mobile   { display: none !important; }
          .mobile-only     { display: none !important; }
          .main-scroll     { padding: 1.5rem 2rem !important; }
        }
        /* Mobile: no desktop sidebar, show topbar and drawer */
        @media (max-width: 1023px) {
          .sidebar-desktop { display: none !important; }
          .topbar-mobile   { display: flex !important; }
          .main-scroll     { padding: 1rem !important; }
        }
      `}</style>
    </div>
  );
}
