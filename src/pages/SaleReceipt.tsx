import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase/client';

const fmt = (n: number) => `Bs. ${Number(n).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function SaleReceipt() {
  const { id } = useParams<{ id: string }>();
  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    loadSale();
  }, [id]);

  const loadSale = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id, sale_code, status, subtotal, discount, total, advance_payment, balance, notes, created_at,
        clients:client_id (full_name, client_code, phone),
        stores:store_id (name, address, phone),
        profiles:seller_id (full_name, email),
        sale_items (id, quantity, unit_price, discount_amount, discount_reason, subtotal,
          products:product_id (name, category))
      `)
      .eq('id', id)
      .single();

    if (error || !data) { setNotFound(true); setLoading(false); return; }
    setSale(data);
    setLoading(false);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #14b8a6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Cargando boleta...</p>
      </div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
        <h1 style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Boleta no encontrada</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>El link puede haber expirado o no existe.</p>
      </div>
    </div>
  );

  const CANCELLED = sale.status === 'CANCELLED';

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '1.5rem', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .receipt-wrapper { box-shadow: none !important; }
        }
      `}</style>
      {/* Print button — hidden when printing */}
      <div className="no-print" style={{ maxWidth: 480, margin: '0 auto 1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '0.5rem 1.25rem', background: '#0d9488', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          🖨️ Imprimir boleta
        </button>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto' }} className="receipt-wrapper">
        {/* Header */}
        <div style={{ background: 'white', borderRadius: 20, padding: '2rem', marginBottom: '1rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <img
            src={sale.stores?.logo_url || '/logo.png'}
            alt={sale.stores?.name || 'OPTIVISION'}
            style={{ height: 90, width: 'auto', objectFit: 'contain', marginBottom: '0.75rem', display: 'block', margin: '0 auto 0.75rem' }}
          />
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{sale.stores?.name || 'OPTIVISION'}</div>
          {sale.stores?.address && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{sale.stores.address}</div>}
          {sale.stores?.phone && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{sale.stores.phone}</div>}
        </div>

        {/* Sale info */}
        <div style={{ background: 'white', borderRadius: 20, padding: '1.5rem', marginBottom: '1rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Boleta de Venta</div>
              <div style={{ fontWeight: 800, fontSize: '1.125rem', color: '#0f172a', fontFamily: 'monospace' }}>{sale.sale_code}</div>
            </div>
            <div style={{
              padding: '0.375rem 0.875rem', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700,
              background: CANCELLED ? '#fef2f2' : sale.status === 'COMPLETED' ? '#f0fdf4' : '#fefce8',
              color: CANCELLED ? '#ef4444' : sale.status === 'COMPLETED' ? '#16a34a' : '#ca8a04',
            }}>
              {CANCELLED ? '❌ Anulada' : sale.status === 'COMPLETED' ? '✅ Completada' : '⏳ Pendiente'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', fontSize: '0.8125rem' }}>
            <div><span style={{ color: '#94a3b8' }}>Cliente: </span><strong style={{ color: '#0f172a' }}>{sale.clients?.full_name || 'N/D'}</strong></div>
            <div><span style={{ color: '#94a3b8' }}>Código: </span><span style={{ fontFamily: 'monospace', color: '#14b8a6' }}>{sale.clients?.client_code || '—'}</span></div>
            <div><span style={{ color: '#94a3b8' }}>Vendedor: </span><span style={{ color: '#0f172a' }}>{sale.profiles?.full_name || sale.profiles?.email || '—'}</span></div>
            <div><span style={{ color: '#94a3b8' }}>Fecha: </span><span style={{ color: '#0f172a' }}>{fmtDate(sale.created_at)}</span></div>
          </div>
        </div>

        {/* Items */}
        <div style={{ background: 'white', borderRadius: 20, padding: '1.5rem', marginBottom: '1rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a', marginBottom: '1rem' }}>Productos</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(sale.sale_items || []).map((item: any) => (
              <div key={item.id} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>{item.products?.name || '—'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                      {item.quantity}× {fmt(item.unit_price)}
                      {item.discount_amount > 0 && <span style={{ color: '#f59e0b' }}> − {fmt(item.discount_amount)}/u ({item.discount_reason})</span>}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: '#14b8a6', fontSize: '0.9rem', flexShrink: 0, marginLeft: '1rem' }}>{fmt(item.subtotal)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div style={{ background: 'white', borderRadius: 20, padding: '1.5rem', marginBottom: '1rem', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Subtotal</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{fmt(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#f59e0b' }}>Descuentos</span>
                <span style={{ fontWeight: 600, color: '#f59e0b' }}>− {fmt(sale.discount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f0fdfa', borderRadius: 10, marginTop: '0.25rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>TOTAL</span>
              <span style={{ fontWeight: 800, fontSize: '1.125rem', color: '#0d9488' }}>{fmt(sale.total)}</span>
            </div>
            {sale.advance_payment > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Adelanto pagado</span>
                <span style={{ fontWeight: 600, color: '#16a34a' }}>{fmt(sale.advance_payment)}</span>
              </div>
            )}
            {sale.balance > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: '#fefce8', borderRadius: 8 }}>
                <span style={{ fontWeight: 700, color: '#92400e' }}>Saldo pendiente</span>
                <span style={{ fontWeight: 700, color: '#ca8a04' }}>{fmt(sale.balance)}</span>
              </div>
            )}
          </div>
          {sale.notes && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b' }}>
              <strong>Notas:</strong> {sale.notes}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.75rem' }}>
          <p style={{ fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>¡Gracias por su preferencia!</p>
          <p>OPTIVISION · Tecnología Para Tus Ojos</p>
          <p style={{ marginTop: '0.5rem', fontFamily: 'monospace' }}>{sale.sale_code}</p>
        </div>
      </div>
    </div>
  );
}
