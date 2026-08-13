import { useRef } from 'react';
import { Printer, Eye, Calendar, Hash } from 'lucide-react';

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface ReceiptPreviewProps {
  saleCode: string;
  clientName: string;
  clientCode: string;
  storeName: string;
  sellerName: string;
  date: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  advancePayment: number;
  balance: number;
  notes?: string;
}

const fmt = (n: number) => `Bs. ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ReceiptPreview({ 
  saleCode, clientName, clientCode, storeName, sellerName, date,
  items, subtotal, discount, total, advancePayment, balance, notes
}: ReceiptPreviewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => window.print();

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={receiptRef}
        id="receipt-print-area"
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 16, overflow: 'hidden',
          fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--color-brand-800), var(--color-brand-700))',
          padding: '1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Eye size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'white', letterSpacing: '-0.02em' }}>OPTIVISION</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)' }}>{storeName}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>BOLETA DE VENTA</div>
            <div style={{ fontWeight: 700, color: 'white', fontFamily: 'monospace', fontSize: '0.875rem' }}>{saleCode}</div>
          </div>
        </div>

        {/* Client & Meta */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem',
        }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
              Cliente
            </div>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{clientName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Hash size={10} /> {clientCode}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
              Vendedor / Fecha
            </div>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{sellerName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <Calendar size={10} /> {new Date(date).toLocaleDateString('es-BO')}
            </div>
          </div>
        </div>

        {/* Items table */}
        <div style={{ padding: '1rem 1.5rem' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
            Detalle de Productos
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Producto', 'Cant.', 'P. Unit.', 'Subtotal'].map(h => (
                  <th key={h} style={{
                    textAlign: h === 'Producto' ? 'left' : 'right',
                    fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)',
                    padding: '0.375rem 0.5rem', borderBottom: '1px solid var(--color-border)',
                    letterSpacing: '0.04em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: '0.5rem 0.5rem', fontSize: '0.875rem', color: 'var(--color-text-primary)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {item.name}
                  </td>
                  <td style={{ padding: '0.5rem 0.5rem', fontSize: '0.875rem', textAlign: 'right', color: 'var(--color-text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {item.quantity}
                  </td>
                  <td style={{ padding: '0.5rem 0.5rem', fontSize: '0.875rem', textAlign: 'right', color: 'var(--color-text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {fmt(item.unitPrice)}
                  </td>
                  <td style={{ padding: '0.5rem 0.5rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-primary)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {fmt(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-surface)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxWidth: 280, marginLeft: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              <span>Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#34d399' }}>
                <span>Descuento</span><span>- {fmt(discount)}</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '1rem', fontWeight: 800,
              color: 'var(--color-text-primary)',
              paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)',
              marginTop: '0.25rem',
            }}>
              <span>TOTAL</span><span style={{ color: 'var(--color-brand-400)' }}>{fmt(total)}</span>
            </div>
            <div style={{ height: 1, background: 'var(--color-border)', margin: '0.375rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#34d399' }}>
              <span>Adelanto pagado</span><span>{fmt(advancePayment)}</span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '0.9375rem', fontWeight: 700,
              color: balance > 0 ? '#fbbf24' : '#34d399',
            }}>
              <span>Saldo pendiente</span>
              <span>{balance > 0 ? fmt(balance) : '✓ Pagado'}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {notes && (
          <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--color-border)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              <strong style={{ color: 'var(--color-text-secondary)' }}>Notas: </strong>{notes}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '0.75rem 1.5rem',
          background: 'linear-gradient(135deg, rgba(8,145,178,0.08), transparent)',
          borderTop: '1px solid var(--color-border)',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>
            Gracias por su preferencia • OPTIVISION — {storeName}
          </p>
        </div>
      </div>

      {/* Print button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
        <button onClick={handlePrint} className="btn btn-secondary btn-sm no-print">
          <Printer size={14} />
          Imprimir Boleta
        </button>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area {
            position: fixed; top: 0; left: 0; right: 0;
            background: white !important;
            color: black !important;
            border: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
