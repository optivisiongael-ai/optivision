import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import { EyeOff, Eye, AlertCircle, Lock, Mail } from 'lucide-react';

export default function Login() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Read theme from localStorage OR from the data-theme already applied to document
  const [theme] = useState(() => {
    const stored = localStorage.getItem('theme');
    const docAttr = document.documentElement.getAttribute('data-theme');
    return stored || docAttr || 'light'; // CSS :root defaults to light
  });

  useEffect(() => {
    // Apply theme to document so CSS vars and logo are always in sync
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  if (session) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message === 'Invalid login credentials' ? 'Credenciales inválidas. Verifica tu correo y contraseña.' : error.message);
    else navigate('/');
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(8,145,178,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '10%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="fade-in" style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src={theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'}
            alt="OPTIVISION"
            style={{ height: 160, width: 'auto', objectFit: 'contain', margin: '0 auto', display: 'block' }}
          />
        </div>

        {/* Config warning when .env is not set */}
        {!isSupabaseConfigured && (
          <div className="fade-in" style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 12,
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
          }}>
            <p style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              ⚙️ Configuración de Supabase pendiente
            </p>
            <p style={{ color: '#d97706', fontSize: '0.8rem', lineHeight: 1.6 }}>
              Crea el archivo <code style={{ background: 'rgba(245,158,11,0.15)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>.env</code> en la raíz del proyecto copiando{' '}
              <code style={{ background: 'rgba(245,158,11,0.15)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>.env.example</code>{' '}
              y llenando tus claves de Supabase:
            </p>
            <pre style={{
              marginTop: '0.625rem', padding: '0.625rem', borderRadius: 8,
              background: 'rgba(0,0,0,0.3)', fontSize: '0.75rem', fontFamily: 'monospace',
              color: '#fde68a', overflowX: 'auto',
            }}>{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_AGENT_API_KEY=tu_clave_secreta`}</pre>
          </div>
        )}

        {/* Card */}
        <div className="card-glass" style={{ padding: '2rem' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-text-primary)', marginBottom: '0.375rem' }}>
            Iniciar Sesión
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '1.75rem' }}>
            Acceso exclusivo para personal autorizado
          </p>

          {error && (
            <div className="alert alert-error fade-in" style={{ marginBottom: '1.25rem' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            <div>
              <label className="label" htmlFor="login-email">Correo Electrónico</label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  style={{
                    position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)', pointerEvents: 'none',
                  }}
                />
                <input
                  id="login-email"
                  className="input"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="correo@optica.com"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="login-password">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{
                    position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)', pointerEvents: 'none',
                  }}
                />
                <input
                  id="login-password"
                  className="input"
                  type={showPwd ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{
                    position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-muted)', padding: 0, display: 'flex',
                  }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ marginTop: '0.5rem', width: '100%' }}
            >
              {loading ? (
                <><div className="spinner" style={{ width: 18, height: 18 }} /> Ingresando...</>
              ) : (
                <><Lock size={16} /> Iniciar Sesión</>
              )}
            </button>
          </form>

          <div style={{
            marginTop: '1.5rem', paddingTop: '1.25rem',
            borderTop: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Sistema activo · Acceso solo por invitación del administrador
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
