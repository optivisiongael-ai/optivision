import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import { Search, ShoppingBag, Clock, CheckCircle2, XCircle, Printer, X, ChevronDown } from 'lucide-react';

const fmt = (n: number) => `Bs. ${Number(n).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const APP_URL = window.location.origin + window.location.pathname;

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  PENDING:   { label: 'Pendiente',  color: '#f59e0b', icon: Clock },
  COMPLETED: { label: 'Completada', color: '#10b981', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelada',  color: '#ef4444', icon: XCircle },
};

export default function Sales() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdmin = profile?.role === 'ADMIN';

  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'PENDING');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');

  // Finalize modal
  const [finalizeSale, setFinalizeSale] = useState<any | null>(null);
  const [finalBalance, setFinalBalance] = useState(0);
  const [finalizing, setFinalizing] = useState(false);
  const [finalError, setFinalError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) loadSales();
  }, [profile?.id, statusFilter]);

  const loadSales = async () => {
    setLoading(true);
    let q = supabase.from('sales')
      .select(`
        id, sale_code, status, subtotal, discount, total, advance_payment, balance,
        notes, created_at, delivery_date,
        clients:client_id (full_name, client_code, phone),
        stores:store_id (name),
        profiles:seller_id (full_name, email),
        sale_items (id, quantity, unit_price, discount_amount, subtotal,
          products:product_id (name, category))
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    // VENDEDORs only see their own sales
    if (!isAdmin) q = q.eq('seller_id', profile!.id);

    // Status filter
    if (statusFilter !== 'ALL') q = q.eq('status', statusFilter);

    const { data } = await q;
    setSales(data || []);
    setLoading(false);
  };

  // Client-side search + date filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    return sales.filter(s => {
      // Search filter
      if (q) {
        const name = s.clients?.full_name?.toLowerCase() || '';
        const code = s.clients?.client_code?.toLowerCase() || '';
        const saleCode = s.sale_code?.toLowerCase() || '';
        if (!name.includes(q) && !code.includes(q) && !saleCode.includes(q)) return false;
      }
      // Date filter
      if (dateFilter !== 'all') {
        const created = new Date(s.created_at);
        if (dateFilter === 'today' && created < todayStart) return false;
        if (dateFilter === 'week' && created < weekStart) return false;
      }
      return true;
    });
  }, [sales, search, dateFilter]);

  const openFinalize = (sale: any) => {
    setFinalizeSale(sale);
    setFinalBalance(sale.balance || 0);
    setFinalError(null);
  };

  const handleFinalize = async () => {
    if (!finalizeSale) return;
    setFinalizing(true); setFinalError(null);
    const newBalance = Math.max(0, finalBalance);
    const newAdvance = (finalizeSale.total || 0) - newBalance;

    const { error } = await supabase.from('sales')
      .update({
        status: 'COMPLETED',
        advance_payment: newAdvance,
        balance: newBalance,
      })
      .eq('id', finalizeSale.id);

    if (error) { setFinalError(error.message); setFinalizing(false); return; }

    await supabase.from('audit_log').insert({
      user_id: profile?.id,
      user_email: profile?.email,
      action: 'VENTA_COMPLETADA',
      entity_type: 'SALE',
      entity_id: finalizeSale.id,
      description: `Venta ${finalizeSale.sale_code} marcada como COMPLETADA. Saldo cobrado: ${fmt(newBalance)}.`,
    });

    setFinalizing(false);
    setFinalizeSale(null);
    loadSales();
  };

  const pendingCount = sales.filter(s => s.status === 'PENDING').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">🧾 Ventas</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            {isAdmin ? 'Todas las ventas del sistema' : 'Mis ventas'}
            {statusFilter === 'PENDING' && pendingCount > 0 && (
              <span style={{ marginLeft: '0.5rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', padding: '0.125rem 0.5rem', borderRadius: 99, fontWeight: 600, fontSize: '0.75rem' }}>
                {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            className="input input-sm"
            placeholder="Nombre, OPT-XXXXX o VNT-XXXXXX..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {[
            { v: 'PENDING', label: '⏳ Pendientes' },
            { v: 'COMPLETED', label: '✅ Completadas' },
            { v: 'CANCELLED', label: '❌ Canceladas' },
            { v: 'ALL', label: 'Todas' },
          ].map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`btn btn-sm ${statusFilter === v ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.78rem' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date filter */}
        <div style={{ position: 'relative' }}>
          <select
            className="input input-sm"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value as any)}
            style={{ paddingRight: '2rem', appearance: 'none' }}
          >
            <option value="all">Todas las fechas</option>
            <option value="today">Hoy</option>
            <option value="week">Últimos 7 días</option>
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-muted)' }} />
        </div>
      </div>

      {/* Sales list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          <ShoppingBag size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <p>No hay ventas{search ? ` que coincidan con "${search}"` : ''}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(sale => {
            const st = STATUS_LABELS[sale.status] || STATUS_LABELS.PENDING;
            const Icon = st.icon;
            return (
              <div
                key={sale.id}
                className="card fade-in"
                style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', cursor: sale.status === 'PENDING' ? 'pointer' : 'default' }}
                onClick={() => sale.status === 'PENDING' && openFinalize(sale)}
              >
                {/* Status icon */}
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${st.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} style={{ color: st.color }} />
                </div>

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-primary)', marginBottom: '0.125rem' }}>
                    {sale.clients?.full_name || '—'}
                    <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
                      {sale.clients?.client_code}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--color-brand-400)' }}>{sale.sale_code}</span>
                    <span>{fmtDate(sale.created_at)}</span>
                    {isAdmin && sale.profiles?.full_name && <span>👤 {sale.profiles.full_name}</span>}
                  </div>
                </div>

                {/* Amounts */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{fmt(sale.total)}</div>
                  {sale.balance > 0 && (
                    <div style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600 }}>
                      Saldo: {fmt(sale.balance)}
                    </div>
                  )}
                </div>

                {/* Status badge + action */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem', flexShrink: 0 }}>
                  <span style={{ background: `${st.color}20`, color: st.color, padding: '0.2rem 0.6rem', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700 }}>
                    {st.label}
                  </span>
                  {sale.status === 'PENDING' && (
                    <button
                      onClick={e => { e.stopPropagation(); openFinalize(sale); }}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                    >
                      ✓ Finalizar
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); window.open(`${APP_URL}#/boleta/${sale.id}`, '_blank'); }}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Printer size={12} /> Boleta
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Finalize Modal ── */}
      {finalizeSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(16,185,129,0.3)' }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>✅ Finalizar Entrega</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.125rem', fontFamily: 'monospace' }}>
                  {finalizeSale.sale_code}
                </div>
              </div>
              <button onClick={() => setFinalizeSale(null)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
            </div>

            {/* Client info */}
            <div style={{ background: 'var(--color-bg-elevated)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{finalizeSale.clients?.full_name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{finalizeSale.clients?.client_code}</div>
                {finalizeSale.clients?.phone && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{finalizeSale.clients.phone}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Creada</div>
                <div style={{ fontSize: '0.8rem' }}>{fmtDateTime(finalizeSale.created_at)}</div>
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Productos
              </div>
              {(finalizeSale.sale_items || []).map((item: any) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
                  <span>
                    {item.products?.name}
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                      {item.quantity}× {fmt(item.unit_price)}
                      {item.discount_amount > 0 && ` − ${fmt(item.discount_amount)}/u`}
                    </span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{fmt(item.subtotal)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ background: 'var(--color-bg-elevated)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Subtotal</span>
                <span>{fmt(finalizeSale.subtotal)}</span>
              </div>
              {finalizeSale.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>Descuentos</span>
                  <span style={{ color: '#f59e0b' }}>− {fmt(finalizeSale.discount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                <span>TOTAL</span>
                <span style={{ color: 'var(--color-brand-400)' }}>{fmt(finalizeSale.total)}</span>
              </div>
              {finalizeSale.advance_payment > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Adelanto pagado</span>
                  <span style={{ color: '#10b981' }}>{fmt(finalizeSale.advance_payment)}</span>
                </div>
              )}
            </div>

            {/* Balance to collect */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label">Saldo a cobrar (Bs.)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.875rem', color: 'var(--color-text-muted)', pointerEvents: 'none' }}>Bs.</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={finalBalance}
                  onChange={e => setFinalBalance(parseFloat(e.target.value) || 0)}
                  className="input"
                  style={{ paddingLeft: '2.5rem', fontWeight: 700, fontSize: '1.1rem' }}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.375rem' }}>
                Saldo original registrado: <strong style={{ color: '#f59e0b' }}>{fmt(finalizeSale.balance)}</strong>
              </div>
            </div>

            {finalError && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{finalError}</div>
            )}

            {/* Modal actions */}
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="btn btn-primary btn-lg"
                style={{ flex: 1 }}
              >
                {finalizing ? 'Guardando...' : '✅ Confirmar Entrega'}
              </button>
              <button
                onClick={() => window.open(`${APP_URL}#/boleta/${finalizeSale.id}`, '_blank')}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              >
                <Printer size={14} /> Boleta
              </button>
              <button onClick={() => setFinalizeSale(null)} className="btn btn-ghost btn-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Exported helper: compact pending sales list (for use in other pages) ────
export function PendingSalesList({ clientId, sellerId, onFinalized }: {
  clientId?: string;
  sellerId?: string;
  onFinalized?: () => void;
}) {
  const { profile } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizeSale, setFinalizeSale] = useState<any | null>(null);
  const [finalBalance, setFinalBalance] = useState(0);
  const [finalizing, setFinalizing] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('sales')
      .select(`id, sale_code, status, total, advance_payment, balance, created_at,
        clients:client_id (full_name, client_code),
        sale_items (id, quantity, unit_price, discount_amount, subtotal, products:product_id (name))`)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(20);
    if (clientId) q = q.eq('client_id', clientId);
    if (sellerId) q = q.eq('seller_id', sellerId);
    const { data } = await q;
    setSales(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId, sellerId]);

  const handleFinalize = async () => {
    if (!finalizeSale) return;
    setFinalizing(true);
    const newBalance = Math.max(0, finalBalance);
    const newAdvance = (finalizeSale.total || 0) - newBalance;
    await supabase.from('sales').update({ status: 'COMPLETED', advance_payment: newAdvance, balance: newBalance }).eq('id', finalizeSale.id);
    await supabase.from('audit_log').insert({
      user_id: profile?.id, user_email: profile?.email,
      action: 'VENTA_COMPLETADA', entity_type: 'SALE', entity_id: finalizeSale.id,
      description: `Venta ${finalizeSale.sale_code} completada. Saldo cobrado: ${fmt(newBalance)}.`,
    });
    setFinalizing(false);
    setFinalizeSale(null);
    load();
    onFinalized?.();
  };

  if (loading) return <div className="spinner" style={{ width: 20, height: 20 }} />;
  if (sales.length === 0) return <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Sin ventas pendientes</p>;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {sales.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', background: 'var(--color-bg-elevated)', borderRadius: 10, gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--color-brand-400)', fontWeight: 700 }}>{s.sale_code}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{fmtDate(s.created_at)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{fmt(s.total)}</div>
              {s.balance > 0 && <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Saldo: {fmt(s.balance)}</div>}
            </div>
            <button onClick={() => { setFinalizeSale(s); setFinalBalance(s.balance || 0); }} className="btn btn-primary btn-sm" style={{ fontSize: '0.72rem' }}>
              ✓ Finalizar
            </button>
          </div>
        ))}
      </div>

      {/* Inline finalize modal */}
      {finalizeSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: 420, border: '1px solid rgba(16,185,129,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 800, margin: 0 }}>✅ Finalizar — {finalizeSale.sale_code}</h3>
              <button onClick={() => setFinalizeSale(null)} className="btn btn-ghost btn-icon btn-sm"><X size={15} /></button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label">Saldo a cobrar (Bs.)</label>
              <input type="number" min="0" step="0.01" value={finalBalance}
                onChange={e => setFinalBalance(parseFloat(e.target.value) || 0)}
                className="input" style={{ fontWeight: 700 }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                Total: {fmt(finalizeSale.total)} · Saldo registrado: <strong style={{ color: '#f59e0b' }}>{fmt(finalizeSale.balance)}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleFinalize} disabled={finalizing} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                {finalizing ? 'Guardando...' : '✅ Confirmar'}
              </button>
              <button onClick={() => window.open(`${APP_URL}#/boleta/${finalizeSale.id}`, '_blank')} className="btn btn-secondary btn-sm">
                <Printer size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
