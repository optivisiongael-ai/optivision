import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import {
  ShoppingCart, Users, TrendingUp, Package, Store,
  AlertTriangle, Activity, RefreshCw, Eye
} from 'lucide-react';

const fmt = (n: number) => `Bs. ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Admin Dashboard ────────────────────────────────────────────
function AdminDashboard() {
  const [stats, setStats] = useState({ totalSales: 0, totalRevenue: 0, totalClients: 0, totalProducts: 0 });
  const [stores, setStores] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [pendingCancellations, setPendingCancellations] = useState<any[]>([]);
  const [cancelActionId, setCancelActionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // Stats
    const [salesRes, clientsRes, productsRes, storesRes, auditRes, cancelRes] = await Promise.all([
      supabase.from('sales').select('total, store_id').neq('status', 'CANCELLED'),
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('stores').select('id, name, address, active'),
      supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(15),
      supabase.from('sales').select(`id, sale_code, total, cancellation_reason, cancellation_requested_at,
        clients:client_id (full_name), profiles:seller_id (full_name, email), stores:store_id (name),
        requester:cancellation_requested_by (full_name, email)`)
        .eq('cancellation_status', 'PENDING').order('cancellation_requested_at', { ascending: true }),
    ]);

    const sales = salesRes.data || [];
    setStats({
      totalSales: sales.length,
      totalRevenue: sales.reduce((s: number, r: any) => s + (r.total || 0), 0),
      totalClients: clientsRes.count || 0,
      totalProducts: productsRes.count || 0,
    });
    setStores(storesRes.data || []);
    setRecentAudit(auditRes.data || []);
    setPendingCancellations(cancelRes.data || []);


    // Low stock with alert config
    const { data: alertConfigs } = await supabase.from('store_alert_config').select('*').eq('alerts_enabled', true);
    if (alertConfigs && alertConfigs.length > 0) {
      const low: any[] = [];
      for (const cfg of alertConfigs) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('quantity, product:products(name, sku_code), store:stores(name)')
          .eq('store_id', cfg.store_id)
          .lte('quantity', cfg.low_stock_threshold);
        if (inv) inv.forEach((i: any) => low.push({ ...i, threshold: cfg.low_stock_threshold }));
      }
      setLowStock(low);
    }
    setLoading(false);
  };

  const ACTION_LABEL: Record<string, string> = {
    VENTA_CREADA: '🛒 Venta creada',
    VENTA_CANCELADA: '❌ Venta cancelada',
    CLIENTE_CREADO: '👤 Cliente creado',
    CLIENTE_EDITADO: '✏️ Cliente editado',
    MEDIDAS_ACTUALIZADAS: '🔭 Medidas actualizadas',
    SKU_CREADO: '📦 SKU creado',
    SKU_EDITADO: '✏️ SKU editado',
    SKU_BORRADO: '🗑️ SKU borrado',
    INVENTARIO_EDITADO: '🏪 Inventario editado',
    USUARIO_CREADO: '👥 Usuario creado',
  };

  const { profile } = useAuth();

  const handleCancelAction = async (saleId: string, approve: boolean) => {
    setCancelActionId(saleId);
    if (approve) {
      // Approve: mark CANCELLED, restore inventory
      await supabase.from('sales').update({
        status: 'CANCELLED',
        cancellation_status: 'APPROVED',
        cancellation_approved_by: profile?.id,
        cancellation_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', saleId);
      await supabase.rpc('fn_restore_inventory_on_cancel', { p_sale_id: saleId });
      await supabase.from('audit_log').insert({
        user_id: profile?.id, user_email: profile?.email,
        action: 'ANULACION_APROBADA', entity_type: 'SALE', entity_id: saleId,
        description: 'Anulación aprobada por admin. Inventario restituido.',
      });
    } else {
      await supabase.from('sales').update({
        cancellation_status: 'REJECTED',
        cancellation_approved_by: profile?.id,
        cancellation_approved_at: new Date().toISOString(),
      }).eq('id', saleId);
      await supabase.from('audit_log').insert({
        user_id: profile?.id, user_email: profile?.email,
        action: 'ANULACION_RECHAZADA', entity_type: 'SALE', entity_id: saleId,
        description: 'Anulación rechazada por admin.',
      });
    }
    setCancelActionId(null);
    loadData();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320 }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Pending cancellations alert */}
      {pendingCancellations.length > 0 && (
        <div className="card fade-in" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
            ⚠️ Solicitudes de Anulación Pendientes
            <span style={{ background: '#ef4444', color: 'white', borderRadius: 99, padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 800 }}>{pendingCancellations.length}</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingCancellations.map(s => (
              <div key={s.id} style={{ padding: '0.875rem 1rem', background: 'var(--color-bg-card)', borderRadius: 12, border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-brand-400)' }}>{s.sale_code}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Vendedor: {s.requester?.full_name || s.requester?.email || '—'} · Bs. {Number(s.total).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: 2 }}>Motivo: {s.cancellation_reason}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleCancelAction(s.id, true)} disabled={cancelActionId === s.id} className="btn btn-success btn-sm">
                    {cancelActionId === s.id ? '...' : '✅ Aprobar'}
                  </button>
                  <button onClick={() => handleCancelAction(s.id, false)} disabled={cancelActionId === s.id} className="btn btn-danger btn-sm">
                    {cancelActionId === s.id ? '...' : '❌ Rechazar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
        {[
          { icon: ShoppingCart, label: 'Ventas Totales', value: stats.totalSales, color: 'teal', suffix: '' },
          { icon: TrendingUp, label: 'Ingresos Totales', value: fmt(stats.totalRevenue), color: 'green', suffix: '' },
          { icon: Users, label: 'Clientes Registrados', value: stats.totalClients, color: 'blue', suffix: '' },
          { icon: Package, label: 'Productos Activos', value: stats.totalProducts, color: 'purple', suffix: '' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div className={`icon-box icon-box-${color}`}><Icon size={20} /></div>
            </div>
            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}>
                {typeof value === 'number' ? value.toLocaleString('es-BO') : value}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2">
        {/* Tiendas */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', gap: '0.625rem',
          }}>
            <Store size={16} style={{ color: 'var(--color-brand-400)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
              Tiendas ({stores.length})
            </span>
          </div>
          <div style={{ padding: '0.5rem' }}>
            {stores.length === 0 ? (
              <p style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                No hay tiendas creadas. Ir a Configuración.
              </p>
            ) : stores.map((store: any) => (
              <div key={store.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: 10,
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: store.active ? 'rgba(6,182,212,0.12)' : 'rgba(239,68,68,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Eye size={16} color={store.active ? 'var(--color-brand-400)' : '#f87171'} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{store.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{store.address}</div>
                </div>
                <span className={`badge ${store.active ? 'badge-green' : 'badge-red'}`}>
                  {store.active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock alerts */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', gap: '0.625rem',
          }}>
            <AlertTriangle size={16} style={{ color: '#fbbf24' }} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
              Alertas de Stock Bajo
            </span>
            {lowStock.length > 0 && (
              <span className="badge badge-yellow" style={{ marginLeft: 'auto' }}>{lowStock.length}</span>
            )}
          </div>
          <div style={{ padding: '0.5rem', maxHeight: 280, overflowY: 'auto' }}>
            {lowStock.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✅</div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  Todo el inventario está OK
                </p>
              </div>
            ) : lowStock.map((item: any, i: number) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem', borderRadius: 10,
              }}>
                <div className="icon-box icon-box-yellow" style={{ width: 32, height: 32 }}>
                  <AlertTriangle size={14} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-text-primary)' }}>
                    {item.product?.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    {item.store?.name} · {item.quantity} uds restantes (alerta: ≤{item.threshold})
                  </div>
                </div>
                <span className="badge badge-yellow">{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit log */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Activity size={16} style={{ color: 'var(--color-brand-400)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
              Actividad Reciente (Todos los Vendedores)
            </span>
          </div>
          <button onClick={loadData} className="btn btn-ghost btn-sm btn-icon">
            <RefreshCw size={14} />
          </button>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {recentAudit.length === 0 ? (
            <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              Sin actividad registrada aún
            </p>
          ) : recentAudit.map((log: any) => (
            <div key={log.id} style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '0.75rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              transition: 'background 0.12s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {ACTION_LABEL[log.action] || log.action}
                  {log.description && (
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> — {log.description}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {log.user_email} · {new Date(log.created_at).toLocaleString('es-BO')}
                </div>
              </div>
              {log.entity_id && (
                <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--color-text-muted)', background: 'var(--color-bg-input)', padding: '2px 6px', borderRadius: 4 }}>
                  #{log.entity_id.slice(-6)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Vendedor Dashboard ─────────────────────────────────────────
function VendedorDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ mySales: 0, myRevenue: 0, myClients: 0, pendingBalance: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const userId = profile?.id;
    if (!userId) { setLoading(false); return; }

    const [salesRes, balanceRes, clientsRes] = await Promise.all([
      supabase.from('sales').select('id, sale_code, total, status, created_at, client:clients(full_name, client_code)')
        .eq('seller_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('sales').select('balance').eq('seller_id', userId).gt('balance', 0),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('created_by', userId),
    ]);

    const sales = salesRes.data || [];
    setRecentSales(sales);
    setStats({
      mySales: sales.length,
      myRevenue: sales.reduce((s: number, r: any) => s + (r.total || 0), 0),
      myClients: clientsRes.count || 0,
      pendingBalance: (balanceRes.data || []).reduce((s: number, r: any) => s + (r.balance || 0), 0),
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320 }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Welcome */}
      <div className="card-glass" style={{
        background: 'linear-gradient(135deg, rgba(8,145,178,0.1), rgba(6,182,212,0.05))',
        border: '1px solid rgba(6,182,212,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--color-brand-700), var(--color-brand-500))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.25rem', fontWeight: 800, color: 'white',
            flexShrink: 0,
          }}>
            {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>
              Bienvenido, {profile?.full_name || profile?.email} 👋
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Vendedor · {new Date().toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {[
          { icon: ShoppingCart, label: 'Mis Ventas', value: stats.mySales, color: 'teal' },
          { icon: TrendingUp, label: 'Mis Ingresos', value: fmt(stats.myRevenue), color: 'green' },
          { icon: Users, label: 'Mis Clientes', value: stats.myClients, color: 'blue' },
          { icon: AlertTriangle, label: 'Saldos Pendientes', value: fmt(stats.pendingBalance), color: 'yellow' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="stat-card">
            <div className={`icon-box icon-box-${color}`}><Icon size={18} /></div>
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}>
                {typeof value === 'number' ? value.toLocaleString('es-BO') : value}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent sales */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <ShoppingCart size={16} style={{ color: 'var(--color-brand-400)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>Mis Ventas Recientes</span>
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {recentSales.length === 0 ? (
            <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              Aún no has registrado ventas. ¡Empieza con Nueva Venta!
            </p>
          ) : recentSales.map((sale: any) => (
            <div key={sale.id} style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '0.875rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              transition: 'background 0.12s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(6,182,212,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand-400)',
                flexShrink: 0,
              }}>
                🛒
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                  {sale.client?.full_name || 'Sin nombre'}
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
                    {sale.sale_code}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {new Date(sale.created_at).toLocaleString('es-BO')}
                </div>
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-brand-400)' }}>
                {fmt(sale.total)}
              </span>
              <span className={`badge ${sale.status === 'COMPLETED' ? 'badge-green' : sale.status === 'CANCELLED' ? 'badge-red' : 'badge-yellow'}`}>
                {sale.status === 'COMPLETED' ? 'Completada' : sale.status === 'CANCELLED' ? 'Cancelada' : 'Pendiente'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────
export default function Dashboard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isAdmin ? '⚡ Panel de Administración' : '🛒 Mi Panel'}
          </h1>
          <p className="page-subtitle">
            {isAdmin ? 'Visión global del sistema — OPTIVISION' : 'Tu resumen de actividad como vendedor'}
          </p>
        </div>
      </div>
      {isAdmin ? <AdminDashboard /> : <VendedorDashboard />}
    </div>
  );
}
