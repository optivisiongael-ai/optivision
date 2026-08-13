import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import { Activity, RefreshCw } from 'lucide-react';

const ACTION_LABEL: Record<string, { label: string; color: string; emoji: string }> = {
  VENTA_CREADA:         { label: 'Venta creada', color: 'teal', emoji: '🛒' },
  VENTA_CANCELADA:      { label: 'Venta cancelada', color: 'red', emoji: '❌' },
  CLIENTE_CREADO:       { label: 'Cliente creado', color: 'blue', emoji: '👤' },
  CLIENTE_EDITADO:      { label: 'Cliente editado', color: 'blue', emoji: '✏️' },
  MEDIDAS_ACTUALIZADAS: { label: 'Medidas actualizadas', color: 'purple', emoji: '🔭' },
};

const COLOR_MAP: Record<string, string> = {
  teal: 'badge-teal', red: 'badge-red', blue: 'badge-blue', purple: 'badge-teal', green: 'badge-green',
};

export default function MyActivity() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const loadLogs = async () => {
    setLoading(true);
    const query = supabase.from('audit_log').select('*').eq('user_id', profile?.id).order('created_at', { ascending: false }).limit(100);
    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => { if (profile?.id) loadLogs(); }, [profile?.id]);

  const actions = ['ALL', ...Object.keys(ACTION_LABEL)];

  const filtered = filter === 'ALL' ? logs : logs.filter(l => l.action === filter);

  const stats = {
    ventas: logs.filter(l => l.action === 'VENTA_CREADA').length,
    clientes: logs.filter(l => l.action === 'CLIENTE_CREADO').length,
    medidas: logs.filter(l => l.action === 'MEDIDAS_ACTUALIZADAS').length,
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Mi Actividad</h1>
          <p className="page-subtitle">Historial completo de tus acciones en el sistema</p>
        </div>
        <button onClick={loadLogs} disabled={loading} className="btn btn-secondary">
          <RefreshCw size={15} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Ventas Realizadas', value: stats.ventas, color: 'teal', emoji: '🛒' },
          { label: 'Clientes Registrados', value: stats.clientes, color: 'blue', emoji: '👤' },
          { label: 'Medidas Actualizadas', value: stats.medidas, color: 'purple', emoji: '🔭' },
          { label: 'Total de Acciones', value: logs.length, color: 'green', emoji: '📊' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.375rem' }}>{s.emoji}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {actions.map(a => (
          <button key={a} onClick={() => setFilter(a)} className={`btn btn-sm ${filter === a ? 'btn-primary' : 'btn-secondary'}`}>
            {a === 'ALL' ? '📋 Todos' : `${ACTION_LABEL[a]?.emoji || ''} ${ACTION_LABEL[a]?.label || a}`}
          </button>
        ))}
      </div>

      {/* Log list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={15} style={{ color: 'var(--color-brand-400)' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {filtered.length} registros
          </span>
        </div>
        <div style={{ maxHeight: 560, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner spinner-lg" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No hay registros de actividad aún</p>
            </div>
          ) : filtered.map(log => {
            const info = ACTION_LABEL[log.action] || { label: log.action, color: 'gray', emoji: '📌' };
            return (
              <div
                key={log.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '1rem',
                  padding: '0.875rem 1.25rem',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'var(--color-bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem',
                }}>
                  {info.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span className={`badge ${COLOR_MAP[info.color] || 'badge-gray'}`}>{info.label}</span>
                    {log.entity_id && (
                      <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--color-text-muted)', background: 'var(--color-bg-input)', padding: '1px 5px', borderRadius: 4 }}>
                        #{log.entity_id.slice(-8)}
                      </span>
                    )}
                  </div>
                  {log.description && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>{log.description}</p>
                  )}
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {new Date(log.created_at).toLocaleString('es-BO', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
