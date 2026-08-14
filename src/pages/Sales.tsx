import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import {
  Search, ShoppingBag, Clock, CheckCircle2, XCircle, Printer, X,
  ChevronDown, RefreshCw, Edit2, Activity, Link, AlertCircle, Check
} from 'lucide-react';

const fmt = (n: number) => `Bs. ${Number(n).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const isWithin24h = (iso: string) => Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
const APP_URL = window.location.origin + window.location.pathname;

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  PENDING:   { label: 'Pendiente',  color: '#f59e0b', icon: Clock },
  COMPLETED: { label: 'Completada', color: '#10b981', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelada',  color: '#ef4444', icon: XCircle },
};

const CANCEL_REASONS = ['Error en productos', 'Cliente desistió', 'Pago no procesado', 'Duplicado accidental', 'Otro'];
const DISCOUNT_REASONS = ['Promoción', 'Cliente frecuente', 'Producto con detalle', 'Cortesía', 'Otro'];

export default function Sales() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdmin = profile?.role === 'ADMIN';

  // ── Tab ──────────────────────────────────────────────────────
  const [tab, setTab] = useState<'pending' | 'history' | 'log'>(
    searchParams.get('status') ? 'pending' : 'pending'
  );

  // ── Pending tab state ─────────────────────────────────────────
  const [pendingSales, setPendingSales] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'PENDING');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');

  // Finalize modal
  const [finalizeSale, setFinalizeSale] = useState<any | null>(null);
  const [finalBalance, setFinalBalance] = useState(0);
  const [finalizing, setFinalizing] = useState(false);
  const [finalError, setFinalError] = useState<string | null>(null);

  // ── History tab state ─────────────────────────────────────────
  const [mySales, setMySales] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Cancel modal
  const [cancelSale, setCancelSale] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);

  // Edit modal
  const [editSale, setEditSale] = useState<any | null>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);

  // ── Log tab state ─────────────────────────────────────────────
  const [logs, setLogs] = useState<any[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logLoaded, setLogLoaded] = useState(false);

  const [pendingError, setPendingError] = useState<string | null>(null);

  // ── Load pending sales ────────────────────────────────────────
  const loadPending = async (sf: string) => {
    setPendingLoading(true);
    setPendingError(null);
    // NOTE: only columns guaranteed in init migration (no delivery_date, no discount_amount)
    let q = supabase.from('sales')
      .select(`
        id, sale_code, status, seller_id,
        subtotal, discount, total, advance_payment, balance,
        notes, created_at,
        clients:client_id (full_name, client_code, phone),
        sale_items (quantity, unit_price, subtotal,
          products:product_id (name, category))
      `)
      .order('created_at', { ascending: false })
      .limit(200);
    if (sf !== 'ALL') q = q.eq('status', sf);
    const { data, error } = await q;
    if (error) {
      const msg = `Error: ${error.message} | ${error.details || ''} | hint: ${error.hint || ''}`;
      console.error('loadPending FAILED:', msg);
      setPendingError(msg);
      setPendingSales([]);
      setPendingLoading(false);
      return;
    }
    console.log('loadPending OK — rows:', data?.length, data?.[0]);
    setPendingSales(data || []);
    setPendingLoading(false);
  };

  // ── Load history ──────────────────────────────────────────────
  const loadHistory = async (sid: string, admin: boolean) => {
    setHistoryLoading(true);
    let q = supabase.from('sales')
      .select(`id, sale_code, status, subtotal, discount, total, advance_payment, balance,
        notes, created_at, cancellation_status, cancellation_reason,
        clients:client_id (full_name, client_code, phone),
        stores:store_id (id, name),
        profiles:seller_id (full_name),
        sale_items (id, quantity, unit_price, discount_amount, discount_reason, subtotal,
          products:product_id (id, name, category))`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (!admin) q = q.eq('seller_id', sid);
    const { data, error } = await q;
    if (error) console.error('Sales loadHistory error:', error);
    setMySales(data || []);
    setHistoryLoading(false);
    setHistoryLoaded(true);
    const { data: prods } = await supabase.from('products').select('id, name, category, price, sku_code').eq('active', true).order('name');
    setProducts(prods || []);
  };

  // ── Load log ──────────────────────────────────────────────────
  const loadLog = async (sid: string, admin: boolean) => {
    setLogLoading(true);
    let q = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100);
    if (!admin) q = q.eq('user_id', sid);
    const { data, error } = await q;
    if (error) console.error('Sales loadLog error:', error);
    setLogs(data || []);
    setLogLoading(false);
    setLogLoaded(true);
  };

  // ── Effects ───────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id) return;
    loadPending(statusFilter);
  }, [profile?.id, isAdmin, statusFilter]);

  useEffect(() => {
    if (!profile?.id) return;
    if (tab === 'history' && !historyLoaded) loadHistory(profile.id, isAdmin);
    if (tab === 'log' && !logLoaded) loadLog(profile.id, isAdmin);
  }, [tab, profile?.id, isAdmin]);

  // Refresh all
  const refreshAll = () => {
    if (!profile?.id) return;
    setHistoryLoaded(false);
    setLogLoaded(false);
    loadPending(statusFilter);
    if (tab === 'history') { setHistoryLoaded(false); loadHistory(profile.id, isAdmin); }
    if (tab === 'log') { setLogLoaded(false); loadLog(profile.id, isAdmin); }
  };

  // ── Pending: filtered memo ────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    return pendingSales.filter(s => {
      if (q) {
        const name = s.clients?.full_name?.toLowerCase() || '';
        const code = s.clients?.client_code?.toLowerCase() || '';
        const saleCode = s.sale_code?.toLowerCase() || '';
        const phone = s.clients?.phone?.toLowerCase() || '';
        if (!name.includes(q) && !code.includes(q) && !saleCode.includes(q) && !phone.includes(q)) return false;
      }
      if (dateFilter !== 'all') {
        const created = new Date(s.created_at);
        if (dateFilter === 'today' && created < todayStart) return false;
        if (dateFilter === 'week' && created < weekStart) return false;
      }
      return true;
    });
  }, [pendingSales, search, dateFilter]);

  // ── Finalize ──────────────────────────────────────────────────
  const openFinalize = (sale: any) => { setFinalizeSale(sale); setFinalBalance(sale.balance || 0); setFinalError(null); };

  const handleFinalize = async () => {
    if (!finalizeSale) return;
    setFinalizing(true); setFinalError(null);
    const newBalance = Math.max(0, finalBalance);
    const newAdvance = (finalizeSale.total || 0) - newBalance;
    const { error } = await supabase.from('sales').update({ status: 'COMPLETED', advance_payment: newAdvance, balance: newBalance }).eq('id', finalizeSale.id);
    if (error) { setFinalError(error.message); setFinalizing(false); return; }
    await supabase.from('audit_log').insert({
      user_id: profile?.id, user_email: profile?.email,
      action: 'VENTA_COMPLETADA', entity_type: 'SALE', entity_id: finalizeSale.id,
      description: `Venta ${finalizeSale.sale_code} marcada como COMPLETADA. Saldo cobrado: ${fmt(newBalance)}.`,
    });
    setFinalizing(false); setFinalizeSale(null);
    if (profile?.id) loadPending(statusFilter);
  };

  // ── History: cancel ───────────────────────────────────────────
  const submitCancel = async () => {
    if (!cancelReason || !cancelSale) return;
    setCancelSaving(true);
    const { error } = await supabase.from('sales').update({
      cancellation_status: 'PENDING', cancellation_reason: cancelReason,
      cancellation_requested_by: profile?.id, cancellation_requested_at: new Date().toISOString(),
    }).eq('id', cancelSale.id);
    if (!error) {
      await supabase.from('audit_log').insert({
        user_id: profile?.id, user_email: profile?.email,
        action: 'ANULACION_SOLICITADA', entity_type: 'SALE', entity_id: cancelSale.id,
        description: `Solicitó anulación de ${cancelSale.sale_code}: ${cancelReason}`,
      });
      setCancelSale(null);
      setHistoryLoaded(false);
      if (profile?.id) loadHistory(profile.id, isAdmin);
    }
    setCancelSaving(false);
  };

  // ── History: edit items ───────────────────────────────────────
  const openEditModal = (sale: any) => {
    setEditSale(sale);
    setEditItems(sale.sale_items.map((i: any) => ({
      id: i.id, productId: i.products?.id || '', productName: i.products?.name || '',
      quantity: i.quantity, unitPrice: i.unit_price,
      discountAmount: i.discount_amount || 0, discountReason: i.discount_reason || '',
      subtotal: i.subtotal, _original: { productId: i.products?.id, quantity: i.quantity },
    })));
    setEditError(null);
  };

  const updateEditItem = (id: string, field: string, value: any) => {
    setEditItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (field === 'productId') {
        const prod = products.find((p: any) => p.id === value);
        if (prod) { updated.productName = prod.name; updated.unitPrice = prod.price; }
      }
      updated.subtotal = updated.quantity * (updated.unitPrice - (updated.discountAmount || 0));
      return updated;
    }));
  };

  const saveEdits = async () => {
    setEditSaving(true); setEditError(null);
    try {
      for (const item of editItems) {
        const orig = item._original;
        if (orig.productId !== item.productId || orig.quantity !== item.quantity) {
          await supabase.rpc('fn_adjust_inventory_for_item_edit', {
            p_store_id: editSale.stores?.id || null,
            p_old_product: orig.productId, p_old_qty: orig.quantity,
            p_new_product: item.productId, p_new_qty: item.quantity,
          });
        }
        await supabase.from('sale_items').update({
          product_id: item.productId, quantity: item.quantity,
          unit_price: item.unitPrice, discount_amount: item.discountAmount || 0,
          discount_reason: item.discountReason || null, subtotal: item.subtotal,
        }).eq('id', item.id);
      }
      const newSubtotal = editItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const newDiscount = editItems.reduce((s, i) => s + (i.discountAmount || 0) * i.quantity, 0);
      const newTotal = editItems.reduce((s, i) => s + i.subtotal, 0);
      const newBalance = Math.max(0, newTotal - editSale.advance_payment);
      await supabase.from('sales').update({
        subtotal: newSubtotal, discount: newDiscount, total: newTotal, balance: newBalance,
        status: newBalance === 0 ? 'COMPLETED' : 'PENDING', updated_at: new Date().toISOString(),
      }).eq('id', editSale.id);
      await supabase.from('audit_log').insert({
        user_id: profile?.id, user_email: profile?.email,
        action: 'VENTA_EDITADA', entity_type: 'SALE', entity_id: editSale.id,
        description: `Ítems editados en ${editSale.sale_code} — Nuevo total: ${fmt(newTotal)}`,
        metadata: {
          antes: editSale.sale_items.map((i: any) => ({ product: i.products?.name, qty: i.quantity, price: i.unit_price })),
          despues: editItems.map(i => ({ product: i.productName, qty: i.quantity, price: i.unitPrice, discount: i.discountAmount })),
        },
      });
      setEditSale(null);
      setHistoryLoaded(false);
      if (profile?.id) loadHistory(profile.id, isAdmin);
    } catch (err: any) {
      setEditError(err.message || 'Error al guardar cambios');
    }
    setEditSaving(false);
  };

  const copyLink = (saleId: string) => {
    const link = `${APP_URL}#/boleta/${saleId}`;
    navigator.clipboard.writeText(link).then(() => { setCopied(saleId); setTimeout(() => setCopied(null), 2000); });
  };

  const pendingCount = pendingSales.filter(s => s.status === 'PENDING').length;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">🧾 Ventas</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            {isAdmin ? 'Gestión de ventas del sistema' : 'Tus ventas y actividad'}
          </p>
        </div>
        <button onClick={refreshAll} className="btn btn-secondary btn-sm"><RefreshCw size={14} /></button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.125rem' }}>
        {[
          { id: 'pending', label: '⏳ Pendientes', badge: statusFilter === 'PENDING' ? pendingCount : undefined },
          { id: 'history', label: '🛒 Mis Ventas' },
          { id: 'log',     label: '📋 Registro' },
        ].map(({ id, label, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            style={{
              padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: tab === id ? 700 : 500,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === id ? 'var(--color-brand-400)' : 'var(--color-text-muted)',
              borderBottom: tab === id ? '2px solid var(--color-brand-400)' : '2px solid transparent',
              marginBottom: -1, display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.15s',
            }}
          >
            {label}
            {badge != null && badge > 0 && (
              <span style={{ background: '#f59e0b', color: 'white', borderRadius: 99, fontSize: '0.65rem', padding: '0.1rem 0.4rem', fontWeight: 800 }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─────────────────── TAB: PENDING ─────────────────────── */}
      {tab === 'pending' && (
        <>
          {/* Filters */}
          <div className="card" style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                type="text" className="input input-sm"
                placeholder="Nombre, OPT-XXXXX o VNT-XXXXXX..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              {[
                { v: 'PENDING',   label: '⏳ Pendientes' },
                { v: 'COMPLETED', label: '✅ Completadas' },
                { v: 'CANCELLED', label: '❌ Canceladas' },
                { v: 'ALL',       label: 'Todas' },
              ].map(({ v, label }) => (
                <button key={v} onClick={() => setStatusFilter(v)}
                  className={`btn btn-sm ${statusFilter === v ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem' }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <select className="input input-sm" value={dateFilter} onChange={e => setDateFilter(e.target.value as any)} style={{ paddingRight: '2rem', appearance: 'none' }}>
                <option value="all">Todas las fechas</option>
                <option value="today">Hoy</option>
                <option value="week">Últimos 7 días</option>
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-muted)' }} />
            </div>
          </div>

          {/* List */}
          {pendingLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
          ) : (
            <>
              {pendingError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '0.875rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#ef4444' }}>
                  <strong>⚠️ Error al cargar ventas:</strong><br />
                  <code style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{pendingError}</code>
                </div>
              )}
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem', display: 'flex', gap: '1rem' }}>
                <span>{pendingSales.length} venta{pendingSales.length !== 1 ? 's' : ''} cargada{pendingSales.length !== 1 ? 's' : ''}</span>
                {search && <span>→ {filtered.length} coincidencia{filtered.length !== 1 ? 's' : ''} con "{search}"</span>}
              </div>

              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                  <ShoppingBag size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                  {pendingSales.length > 0 && search ? (
                    <>
                      <p>No hay coincidencias para "{search}"</p>
                      <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                        Los nombres de clientes pueden no cargar si falta migración SQL.<br />
                        Busca por código de venta (ej: VNT-260814-0001)
                      </p>
                    </>
                  ) : (
                    <p>No hay ventas {statusFilter !== 'ALL' ? `con estado "${STATUS_LABELS[statusFilter]?.label || statusFilter}"` : ''}</p>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filtered.map(sale => {
                    const st = STATUS_LABELS[sale.status] || STATUS_LABELS.PENDING;
                    const Icon = st.icon;
                    return (
                      <div key={sale.id} className="card fade-in"
                        style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', cursor: sale.status === 'PENDING' ? 'pointer' : 'default' }}
                        onClick={() => sale.status === 'PENDING' && openFinalize(sale)}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${st.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={18} style={{ color: st.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.125rem' }}>
                            {sale.clients?.full_name || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Sin nombre</span>}
                            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>{sale.clients?.client_code}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'monospace', color: 'var(--color-brand-400)' }}>{sale.sale_code}</span>
                            <span>{fmtDate(sale.created_at)}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{fmt(sale.total)}</div>
                          {sale.balance > 0 && <div style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600 }}>Saldo: {fmt(sale.balance)}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.375rem', flexShrink: 0 }}>
                          <span style={{ background: `${st.color}20`, color: st.color, padding: '0.2rem 0.6rem', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700 }}>{st.label}</span>
                          {sale.status === 'PENDING' && (
                            <button onClick={e => { e.stopPropagation(); openFinalize(sale); }} className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}>
                              ✓ Finalizar
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); window.open(`${APP_URL}#/boleta/${sale.id}`, '_blank'); }}
                            className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Printer size={12} /> Boleta
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ─────────────────── TAB: HISTORY ─────────────────────── */}
      {tab === 'history' && (
        <>
          {historyLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>}
          {!historyLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {mySales.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: 'var(--color-text-muted)' }}>No hay ventas registradas aún.</p>
                </div>
              )}
              {mySales.map(sale => {
                const editable = isWithin24h(sale.created_at) && sale.status !== 'CANCELLED';
                const cancelable = isWithin24h(sale.created_at) && sale.status !== 'CANCELLED' && !sale.cancellation_status;
                const st = STATUS_LABELS[sale.status] || STATUS_LABELS.PENDING;
                return (
                  <div key={sale.id} className="card" style={{ border: sale.status === 'CANCELLED' ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-brand-400)', fontSize: '1rem' }}>{sale.sale_code}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {sale.clients?.full_name || 'Sin cliente'} · {fmtDateTime(sale.created_at)} · {sale.stores?.name || '—'}
                          {isAdmin && sale.profiles?.full_name && <span> · 👤 {sale.profiles.full_name}</span>}
                        </div>
                        {sale.cancellation_status === 'PENDING' && (
                          <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>⏳ Anulación pendiente de aprobación</div>
                        )}
                        {sale.cancellation_status === 'REJECTED' && (
                          <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>❌ Anulación rechazada por admin</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.0625rem' }}>{fmt(sale.total)}</span>
                        {sale.balance > 0 && <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600 }}>Saldo: {fmt(sale.balance)}</span>}
                        <span style={{ padding: '0.25rem 0.625rem', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, background: st.color + '18', color: st.color }}>{st.label}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.875rem' }}>
                      {(sale.sale_items || []).map((item: any) => (
                        <span key={item.id} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'var(--color-bg-input)', borderRadius: 99, color: 'var(--color-text-secondary)' }}>
                          {item.quantity}× {item.products?.name || '—'}
                          {item.discount_amount > 0 && <span style={{ color: '#f59e0b' }}> (−{fmt(item.discount_amount)})</span>}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button onClick={() => copyLink(sale.id)} className="btn btn-secondary btn-sm">
                        <Link size={13} /> {copied === sale.id ? '✓ Copiado' : 'Copiar link'}
                      </button>
                      <button onClick={() => window.open(`${APP_URL}#/boleta/${sale.id}`, '_blank')} className="btn btn-secondary btn-sm">
                        <Printer size={13} /> Boleta
                      </button>
                      {editable && (
                        <button onClick={() => openEditModal(sale)} className="btn btn-secondary btn-sm">
                          <Edit2 size={13} /> Editar ítems
                        </button>
                      )}
                      {sale.status === 'PENDING' && (
                        <button onClick={() => openFinalize(sale)} className="btn btn-primary btn-sm">
                          ✓ Finalizar
                        </button>
                      )}
                      {cancelable && (
                        <button onClick={() => { setCancelSale(sale); setCancelReason(''); }}
                          className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                          <XCircle size={13} /> Solicitar anulación
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─────────────────── TAB: LOG ─────────────────────────── */}
      {tab === 'log' && (
        <>
          {logLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>}
          {!logLoading && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {logs.length === 0 && <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Sin registros aún.</div>}
              {logs.map((log, i) => (
                <div key={log.id} style={{ padding: '0.875rem 1.25rem', borderBottom: i < logs.length - 1 ? '1px solid var(--color-border)' : 'none', display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(6,182,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Activity size={14} style={{ color: 'var(--color-brand-400)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{log.description || log.action}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {fmtDateTime(log.created_at)}
                      {isAdmin && log.user_email && <span style={{ marginLeft: '0.5rem' }}>· {log.user_email}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─────────────────── MODAL: Finalizar ─────────────────── */}
      {finalizeSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(16,185,129,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>✅ Finalizar Entrega</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.125rem', fontFamily: 'monospace' }}>{finalizeSale.sale_code}</div>
              </div>
              <button onClick={() => setFinalizeSale(null)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
            </div>
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
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Productos</div>
              {(finalizeSale.sale_items || []).map((item: any) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
                  <span>{item.products?.name} <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{item.quantity}× {fmt(item.unit_price)}{item.discount_amount > 0 && ` − ${fmt(item.discount_amount)}/u`}</span></span>
                  <span style={{ fontWeight: 600 }}>{fmt(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--color-bg-elevated)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Subtotal</span><span>{fmt(finalizeSale.subtotal)}</span>
              </div>
              {finalizeSale.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>Descuentos</span><span style={{ color: '#f59e0b' }}>− {fmt(finalizeSale.discount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                <span>TOTAL</span><span style={{ color: 'var(--color-brand-400)' }}>{fmt(finalizeSale.total)}</span>
              </div>
              {finalizeSale.advance_payment > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Adelanto pagado</span><span style={{ color: '#10b981' }}>{fmt(finalizeSale.advance_payment)}</span>
                </div>
              )}
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label">Saldo a cobrar (Bs.)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.875rem', color: 'var(--color-text-muted)', pointerEvents: 'none' }}>Bs.</span>
                <input type="number" min="0" step="0.01" value={finalBalance}
                  onChange={e => setFinalBalance(parseFloat(e.target.value) || 0)}
                  className="input" style={{ paddingLeft: '2.5rem', fontWeight: 700, fontSize: '1.1rem' }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.375rem' }}>
                Saldo original: <strong style={{ color: '#f59e0b' }}>{fmt(finalizeSale.balance)}</strong>
              </div>
            </div>
            {finalError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{finalError}</div>}
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
              <button onClick={handleFinalize} disabled={finalizing} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                {finalizing ? 'Guardando...' : '✅ Confirmar Entrega'}
              </button>
              <button onClick={() => window.open(`${APP_URL}#/boleta/${finalizeSale.id}`, '_blank')} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Printer size={14} /> Boleta
              </button>
              <button onClick={() => setFinalizeSale(null)} className="btn btn-ghost btn-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── MODAL: Cancelación ───────────────── */}
      {cancelSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: 440, position: 'relative' }}>
            <button onClick={() => setCancelSale(null)} className="btn btn-ghost btn-icon btn-sm" style={{ position: 'absolute', top: '1rem', right: '1rem' }}><X size={16} /></button>
            <h3 style={{ fontWeight: 700, marginBottom: '0.375rem' }}>Solicitar Anulación</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>Venta: <strong>{cancelSale.sale_code}</strong> — {fmt(cancelSale.total)}</p>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label">Motivo de anulación *</label>
              <select className="input" value={cancelReason} onChange={e => setCancelReason(e.target.value)}>
                <option value="">— Seleccionar motivo</option>
                {CANCEL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="alert alert-error" style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>
              <AlertCircle size={14} /> La anulación requiere aprobación del administrador.
            </div>
            <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setCancelSale(null)} className="btn btn-ghost">Cancelar</button>
              <button onClick={submitCancel} disabled={!cancelReason || cancelSaving} className="btn btn-primary">
                {cancelSaving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Enviando...</> : <><Check size={15} /> Enviar solicitud</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── MODAL: Editar ítems ──────────────── */}
      {editSale && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem', overflowY: 'auto' }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: 620, position: 'relative', margin: 'auto' }}>
            <button onClick={() => setEditSale(null)} className="btn btn-ghost btn-icon btn-sm" style={{ position: 'absolute', top: '1rem', right: '1rem' }}><X size={16} /></button>
            <h3 style={{ fontWeight: 700, marginBottom: '0.375rem' }}>Editar Ítems</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>Venta <strong>{editSale.sale_code}</strong> — cambios quedan en el registro de auditoría.</p>
            {editError && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><AlertCircle size={14} />{editError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.25rem' }}>
              {editItems.map(item => (
                <div key={item.id} style={{ padding: '0.875rem', background: 'var(--color-bg-input)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 2, minWidth: 160 }}>
                      <label className="label" style={{ fontSize: '0.7rem' }}>Producto</label>
                      <select className="input input-sm" value={item.productId} onChange={e => updateEditItem(item.id, 'productId', e.target.value)}>
                        {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.sku_code})</option>)}
                      </select>
                    </div>
                    <div style={{ flex: '0 0 80px' }}>
                      <label className="label" style={{ fontSize: '0.7rem' }}>Cantidad</label>
                      <input type="number" min="1" className="input input-sm" value={item.quantity} onChange={e => updateEditItem(item.id, 'quantity', parseInt(e.target.value) || 1)} />
                    </div>
                    <div style={{ flex: '0 0 100px' }}>
                      <label className="label" style={{ fontSize: '0.7rem' }}>Desc. (Bs.)</label>
                      <input type="number" min="0" step="0.01" className="input input-sm" value={item.discountAmount || ''} onChange={e => updateEditItem(item.id, 'discountAmount', parseFloat(e.target.value) || 0)} placeholder="0.00" />
                    </div>
                  </div>
                  {item.discountAmount > 0 && (
                    <select className="input input-sm" value={item.discountReason} onChange={e => updateEditItem(item.id, 'discountReason', e.target.value)}>
                      <option value="">— Motivo del descuento *</option>
                      {DISCOUNT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                  <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--color-brand-400)', fontWeight: 700 }}>Subtotal: {fmt(item.subtotal)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                Nuevo total: <span style={{ color: 'var(--color-brand-400)' }}>{fmt(editItems.reduce((s, i) => s + i.subtotal, 0))}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.625rem' }}>
                <button onClick={() => setEditSale(null)} className="btn btn-ghost">Cancelar</button>
                <button onClick={saveEdits} disabled={editSaving} className="btn btn-primary">
                  {editSaving ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Guardando...</> : <><Check size={15} /> Guardar cambios</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Exported helper for Dashboard / Clients ─────────────────────────────────
export function PendingSalesList({ clientId, sellerId, onFinalized }: {
  clientId?: string; sellerId?: string; onFinalized?: () => void;
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
      .eq('status', 'PENDING').order('created_at', { ascending: false }).limit(20);
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
    setFinalizing(false); setFinalizeSale(null); load(); onFinalized?.();
  };

  if (loading) return <div className="spinner" style={{ width: 20, height: 20 }} />;
  if (sales.length === 0) return <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Sin ventas pendientes ✅</p>;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {sales.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', background: 'var(--color-bg-elevated)', borderRadius: 10, gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--color-brand-400)', fontWeight: 700 }}>{s.sale_code}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{s.clients?.full_name || '—'} · {fmtDate(s.created_at)}</div>
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
                className="input" style={{ fontWeight: 700 }} />
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                Total: {fmt(finalizeSale.total)} · Saldo: <strong style={{ color: '#f59e0b' }}>{fmt(finalizeSale.balance)}</strong>
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
