import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import { Activity, RefreshCw, Edit2, XCircle, Check, X, Link, AlertCircle } from 'lucide-react';

const fmt = (n: number) => `Bs. ${Number(n).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const isWithin24h = (iso: string) => Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
const APP_URL = window.location.origin + window.location.pathname;

const CANCEL_REASONS = ['Error en productos', 'Cliente desistió', 'Pago no procesado', 'Duplicado accidental', 'Otro'];
const DISCOUNT_REASONS = ['Promoción', 'Cliente frecuente', 'Producto con detalle', 'Cortesía', 'Otro'];

export default function MyActivity() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'sales' | 'log'>('sales');
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

  const loadData = async () => {
    setLoading(true);
    const [salesRes, logsRes] = await Promise.all([
      supabase.from('sales')
        .select(`id, sale_code, status, subtotal, discount, total, advance_payment, balance, notes, created_at, cancellation_status, cancellation_reason,
          clients:client_id (full_name, client_code, phone),
          stores:store_id (name),
          sale_items (id, quantity, unit_price, discount_amount, discount_reason, subtotal, products:product_id (id, name, category))`)
        .eq('seller_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('audit_log').select('*').eq('user_id', profile?.id).order('created_at', { ascending: false }).limit(100),
    ]);
    setSales(salesRes.data || []);
    setLogs(logsRes.data || []);
    setLoading(false);
  };

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, category, price, sku_code').eq('active', true).order('name');
    setProducts(data || []);
  };

  useEffect(() => { if (profile?.id) { loadData(); loadProducts(); } }, [profile?.id]);

  const copyLink = (saleId: string) => {
    const link = `${APP_URL}#/boleta/${saleId}`;
    navigator.clipboard.writeText(link).then(() => { setCopied(saleId); setTimeout(() => setCopied(null), 2000); });
  };

  // ── Cancellation request ──
  const openCancelModal = (sale: any) => { setCancelSale(sale); setCancelReason(''); };

  const submitCancel = async () => {
    if (!cancelReason || !cancelSale) return;
    setCancelSaving(true);
    const { error } = await supabase.from('sales').update({
      cancellation_status: 'PENDING',
      cancellation_reason: cancelReason,
      cancellation_requested_by: profile?.id,
      cancellation_requested_at: new Date().toISOString(),
    }).eq('id', cancelSale.id);

    if (!error) {
      await supabase.from('audit_log').insert({
        user_id: profile?.id, user_email: profile?.email,
        action: 'ANULACION_SOLICITADA', entity_type: 'SALE', entity_id: cancelSale.id,
        description: `Solicitó anulación de ${cancelSale.sale_code}: ${cancelReason}`,
      });
      setCancelSale(null);
      loadData();
    }
    setCancelSaving(false);
  };

  // ── Edit items ──
  const openEditModal = (sale: any) => {
    setEditSale(sale);
    setEditItems(sale.sale_items.map((i: any) => ({
      id: i.id,
      productId: i.products?.id || '',
      productName: i.products?.name || '',
      quantity: i.quantity,
      unitPrice: i.unit_price,
      discountAmount: i.discount_amount || 0,
      discountReason: i.discount_reason || '',
      subtotal: i.subtotal,
      _original: { productId: i.products?.id, quantity: i.quantity },
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
        // Adjust inventory if product or quantity changed
        if (orig.productId !== item.productId || orig.quantity !== item.quantity) {
          await supabase.rpc('fn_adjust_inventory_for_item_edit', {
            p_store_id: editSale.stores?.id || null,
            p_old_product: orig.productId,
            p_old_qty: orig.quantity,
            p_new_product: item.productId,
            p_new_qty: item.quantity,
          });
        }
        // Update the item
        await supabase.from('sale_items').update({
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_amount: item.discountAmount || 0,
          discount_reason: item.discountReason || null,
          subtotal: item.subtotal,
        }).eq('id', item.id);
      }

      // Recalculate sale totals
      const newSubtotal = editItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const newDiscount = editItems.reduce((s, i) => s + (i.discountAmount || 0) * i.quantity, 0);
      const newTotal = editItems.reduce((s, i) => s + i.subtotal, 0);
      const newBalance = Math.max(0, newTotal - editSale.advance_payment);

      await supabase.from('sales').update({
        subtotal: newSubtotal, discount: newDiscount, total: newTotal, balance: newBalance,
        status: newBalance === 0 ? 'COMPLETED' : 'PENDING',
        updated_at: new Date().toISOString(),
      }).eq('id', editSale.id);

      // Audit log with before/after
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
      loadData();
    } catch (err: any) {
      setEditError(err.message || 'Error al guardar cambios');
    }
    setEditSaving(false);
  };

  const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    COMPLETED: { label: 'Completada', color: '#16a34a' },
    PENDING:   { label: 'Pendiente', color: '#ca8a04' },
    CANCELLED: { label: 'Anulada', color: '#ef4444' },
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Mi Actividad</h1>
          <p className="page-subtitle">Historial de ventas y acciones en el sistema</p>
        </div>
        <button onClick={loadData} className="btn btn-secondary btn-sm"><RefreshCw size={15} /></button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[{ id: 'sales', label: '🛒 Mis Ventas' }, { id: 'log', label: '📋 Registro de Acciones' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={tab === t.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="spinner" style={{ margin: '3rem auto' }} />}

      {/* ── Sales tab ── */}
      {!loading && tab === 'sales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sales.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--color-text-muted)' }}>No tienes ventas registradas aún.</p>
            </div>
          )}
          {sales.map(sale => {
            const editable = isWithin24h(sale.created_at) && sale.status !== 'CANCELLED';
            const cancelable = isWithin24h(sale.created_at) && sale.status !== 'CANCELLED' && !sale.cancellation_status;
            const st = STATUS_LABEL[sale.status] || { label: sale.status, color: '#64748b' };
            return (
              <div key={sale.id} className="card" style={{ border: sale.status === 'CANCELLED' ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-brand-400)', fontSize: '1rem' }}>{sale.sale_code}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {sale.clients?.full_name || 'Sin cliente'} · {fmtDate(sale.created_at)} · {sale.stores?.name || '—'}
                    </div>
                    {sale.cancellation_status === 'PENDING' && (
                      <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>⏳ Anulación pendiente de aprobación</div>
                    )}
                    {sale.cancellation_status === 'REJECTED' && (
                      <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>❌ Anulación rechazada por admin</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.0625rem', color: 'var(--color-text-primary)' }}>{fmt(sale.total)}</span>
                    <span style={{ padding: '0.25rem 0.625rem', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, background: st.color + '18', color: st.color }}>{st.label}</span>
                  </div>
                </div>

                {/* Items summary */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.875rem' }}>
                  {(sale.sale_items || []).map((item: any) => (
                    <span key={item.id} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', background: 'var(--color-bg-input)', borderRadius: 99, color: 'var(--color-text-secondary)' }}>
                      {item.quantity}× {item.products?.name || '—'}
                      {item.discount_amount > 0 && <span style={{ color: '#f59e0b' }}> (−{fmt(item.discount_amount)})</span>}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button onClick={() => copyLink(sale.id)} className="btn btn-secondary btn-sm">
                    <Link size={13} /> {copied === sale.id ? '✓ Copiado' : 'Copiar link'}
                  </button>
                  {editable && (
                    <button onClick={() => openEditModal(sale)} className="btn btn-secondary btn-sm">
                      <Edit2 size={13} /> Editar ítems
                    </button>
                  )}
                  {cancelable && (
                    <button onClick={() => openCancelModal(sale)} className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <XCircle size={13} /> Solicitar anulación
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Log tab ── */}
      {!loading && tab === 'log' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {logs.length === 0 && <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>Sin registros aún.</div>}
          {logs.map((log, i) => (
            <div key={log.id} style={{ padding: '0.875rem 1.25rem', borderBottom: i < logs.length - 1 ? '1px solid var(--color-border)' : 'none', display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(6,182,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.875rem' }}>
                <Activity size={14} style={{ color: 'var(--color-brand-400)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>{log.description || log.action}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{fmtDate(log.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Cancel Modal ── */}
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
              <AlertCircle size={14} /> La anulación requiere aprobación del administrador. El inventario se restituirá si es aprobada.
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

      {/* ── Edit Modal ── */}
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
