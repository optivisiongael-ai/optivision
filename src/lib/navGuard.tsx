/**
 * NavGuardContext — allows any page to register an "unsaved changes" warning
 * that the Layout will intercept before any sidebar navigation.
 */
import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface NavGuardCtx {
  guardMsg: string | null;
  setGuard: (msg: string | null) => void;
  /** Called by Layout's Link onClick when a guard is active */
  requestNav: (to: string) => void;
  /** Pending navigation path (if blocked) */
  pendingPath: string | null;
  confirmNav: () => void;
  cancelNav: () => void;
}

const NavGuardContext = createContext<NavGuardCtx>({
  guardMsg: null, setGuard: () => {}, requestNav: () => {},
  pendingPath: null, confirmNav: () => {}, cancelNav: () => {},
});

export function NavGuardProvider({ children }: { children: ReactNode }) {
  const [guardMsg, setGuardMsg] = useState<string | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const navigate = useNavigate();

  const setGuard = useCallback((msg: string | null) => setGuardMsg(msg), []);

  const requestNav = useCallback((to: string) => {
    if (guardMsg) {
      setPendingPath(to);  // blocked — show modal
    } else {
      navigate(to);
    }
  }, [guardMsg, navigate]);

  const confirmNav = useCallback(() => {
    if (pendingPath) { navigate(pendingPath); }
    setPendingPath(null);
    setGuardMsg(null);
  }, [pendingPath, navigate]);

  const cancelNav = useCallback(() => setPendingPath(null), []);

  return (
    <NavGuardContext.Provider value={{ guardMsg, setGuard, requestNav, pendingPath, confirmNav, cancelNav }}>
      {children}
      {/* Global guard modal */}
      {pendingPath && guardMsg && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 16, padding: '2rem', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
            <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>
              Cambios sin guardar
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{guardMsg}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={cancelNav} style={{ padding: '0.6rem 1.2rem', borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer', fontWeight: 600 }}>
                Seguir editando
              </button>
              <button onClick={confirmNav} style={{ padding: '0.6rem 1.2rem', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </NavGuardContext.Provider>
  );
}

export const useNavGuard = () => useContext(NavGuardContext);
