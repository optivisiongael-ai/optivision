import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import { Search, Edit2, X, Check, Hash, Phone, Mail, Eye } from 'lucide-react';

const fmt = (n: number) => `Bs. ${n.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
const emptyMeasures = { od_sphere: '', od_cylinder: '', od_axis: '', od_add: '', oi_sphere: '', oi_cylinder: '', oi_axis: '', oi_add: '', dip: '' };

export default function Clients() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [clientSales, setClientSales] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [editingMeasures, setEditingMeasures] = useState(false);
  const [measures, setMeasures] = useState(emptyMeasures);
  const [savingMeasures, setSavingMeasures] = useState(false);
  const [measureMsg, setMeasureMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const searchClients = useCallback(async (q: string) => {
    setLoading(true);
    const query = supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (q.trim()) {
      query.or(`full_name.ilike.%${q}%,client_code.ilike.%${q}%,phone.ilike.%${q}%`);
    } else {
      query.limit(20);
    }
    const { data } = await query;
    setClients(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchClients(search), 300);
    return () => clearTimeout(t);
  }, [search, searchClients]);

  useEffect(() => { searchClients(''); }, []);

  const openClient = async (client: any) => {
    setSelectedClient(client);
    setMeasures({
      od_sphere: client.od_sphere || '', od_cylinder: client.od_cylinder || '',
      od_axis: client.od_axis || '', od_add: client.od_add || '',
      oi_sphere: client.oi_sphere || '', oi_cylinder: client.oi_cylinder || '',
      oi_axis: client.oi_axis || '', oi_add: client.oi_add || '',
      dip: client.dip || '',
    });
    setEditingMeasures(false);
    setSalesLoading(true);
    const { data } = await supabase.from('sales')
      .select('id, sale_code, total, advance_payment, balance, status, created_at, sale_items(quantity, unit_price, product:products(name))')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });
    setClientSales(data || []);
    setSalesLoading(false);
  };

  const saveMeasures = async () => {
    setSavingMeasures(true); setMeasureMsg(null);
    const { error } = await supabase.from('clients').update({
      od_sphere: measures.od_sphere || null, od_cylinder: measures.od_cylinder || null,
      od_axis: measures.od_axis || null, od_add: measures.od_add || null,
      oi_sphere: measures.oi_sphere || null, oi_cylinder: measures.oi_cylinder || null,
      oi_axis: measures.oi_axis || null, oi_add: measures.oi_add || null,
      dip: measures.dip || null, updated_at: new Date().toISOString(),
    }).eq('id', selectedClient.id);

    if (error) { setMeasureMsg({ type: 'error', text: error.message }); }
    else {
      await supabase.from('audit_log').insert({
        user_id: profile?.id, user_email: profile?.email,
        action: 'MEDIDAS_ACTUALIZADAS', entity_type: 'CLIENT', entity_id: selectedClient.id,
        description: `Medidas actualizadas para ${selectedClient.full_name}`,
      });
      setMeasureMsg({ type: 'ok', text: '✅ Medidas guardadas' });
      setSelectedClient({ ...selectedClient, ...measures });
      setEditingMeasures(false);
      searchClients(search);
    }
    setSavingMeasures(false);
  };

  const MEASURE_FIELDS = [
    { key: 'od_sphere', label: 'OD Esfera' }, { key: 'od_cylinder', label: 'OD Cilindro' },
    { key: 'od_axis', label: 'OD Eje' }, { key: 'od_add', label: 'OD Add' },
    { key: 'oi_sphere', label: 'OI Esfera' }, { key: 'oi_cylinder', label: 'OI Cilindro' },
    { key: 'oi_axis', label: 'OI Eje' }, { key: 'oi_add', label: 'OI Add' },
    { key: 'dip', label: 'DIP' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 Clientes</h1>
          <p className="page-subtitle">Busca clientes, consulta historial y actualiza medidas de lentes</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedClient ? '380px 1fr' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Client list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              id="client-search"
              className="input"
              placeholder="Buscar por nombre, código o teléfono..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          {/* Results */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {loading ? 'Buscando...' : `${clients.length} cliente${clients.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
              ) : clients.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  {search ? 'Sin resultados para tu búsqueda' : 'No hay clientes registrados aún'}
                </div>
              ) : clients.map(c => (
                <button
                  key={c.id}
                  onClick={() => openClient(c)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.875rem',
                    padding: '0.875rem 1rem', background: selectedClient?.id === c.id ? 'rgba(6,182,212,0.08)' : 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.1s',
                    borderLeft: selectedClient?.id === c.id ? '3px solid var(--color-brand-500)' : '3px solid transparent',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (selectedClient?.id !== c.id) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)'; }}
                  onMouseLeave={e => { if (selectedClient?.id !== c.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(6,182,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--color-brand-400)', flexShrink: 0, fontSize: '0.875rem' }}>
                    {c.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{c.client_code}</div>
                  </div>
                  {c.phone && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{c.phone}</div>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Client detail */}
        {selectedClient && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div className="card" style={{ background: 'linear-gradient(135deg, rgba(8,145,178,0.1), transparent)', border: '1px solid rgba(6,182,212,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-brand-700), var(--color-brand-500))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.25rem', color: 'white' }}>
                    {selectedClient.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>{selectedClient.full_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <Hash size={12} style={{ color: 'var(--color-brand-400)' }} />
                      <span style={{ fontFamily: 'monospace', color: 'var(--color-brand-400)', fontSize: '0.875rem', fontWeight: 600 }}>{selectedClient.client_code}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedClient(null)} className="btn btn-ghost btn-icon btn-sm"><X size={15} /></button>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {selectedClient.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    <Phone size={13} />{selectedClient.phone}
                  </div>
                )}
                {selectedClient.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    <Mail size={13} />{selectedClient.email}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Registrado: {new Date(selectedClient.created_at).toLocaleDateString('es-BO')}
                </div>
              </div>
            </div>

            {/* Lens measurements */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div className="icon-box icon-box-teal" style={{ width: 32, height: 32 }}><Eye size={14} /></div>
                  <h3 style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.9375rem' }}>Medidas de Lentes</h3>
                </div>
                {!editingMeasures && (
                  <button onClick={() => setEditingMeasures(true)} className="btn btn-secondary btn-sm">
                    <Edit2 size={13} /> Editar
                  </button>
                )}
              </div>

              {measureMsg && <div className={`alert ${measureMsg.type === 'ok' ? 'alert-success' : 'alert-error'} fade-in`} style={{ marginBottom: '1rem' }}>{measureMsg.text}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.75rem' }}>
                {MEASURE_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    {editingMeasures ? (
                      <input className="input input-sm" value={(measures as any)[key]} onChange={e => setMeasures(m => ({ ...m, [key]: e.target.value }))} placeholder="—" />
                    ) : (
                      <div style={{ padding: '0.4rem 0.75rem', background: 'var(--color-bg-input)', borderRadius: 8, fontSize: '0.875rem', color: (selectedClient as any)[key] ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: (selectedClient as any)[key] ? 600 : 400 }}>
                        {(selectedClient as any)[key] || '—'}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {editingMeasures && (
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button onClick={() => { setEditingMeasures(false); setMeasureMsg(null); }} className="btn btn-ghost btn-sm"><X size={14} /> Cancelar</button>
                  <button onClick={saveMeasures} disabled={savingMeasures} className="btn btn-primary btn-sm">
                    {savingMeasures ? 'Guardando...' : <><Check size={14} /> Guardar Medidas</>}
                  </button>
                </div>
              )}
            </div>

            {/* Purchase history */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>📋 Historial de Compras</span>
                <span className="badge badge-gray">{clientSales.length}</span>
              </div>
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {salesLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}><div className="spinner" /></div>
                ) : clientSales.length === 0 ? (
                  <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Sin compras registradas</p>
                ) : clientSales.map(sale => (
                  <div key={sale.id} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-brand-400)', fontWeight: 700 }}>{sale.sale_code}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                          {new Date(sale.created_at).toLocaleString('es-BO')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: 'var(--color-brand-400)' }}>{fmt(sale.total)}</div>
                        <span className={`badge ${sale.status === 'COMPLETED' ? 'badge-green' : sale.status === 'CANCELLED' ? 'badge-red' : 'badge-yellow'}`} style={{ fontSize: '0.65rem' }}>
                          {sale.status === 'COMPLETED' ? 'Completada' : sale.status === 'CANCELLED' ? 'Cancelada' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                    {/* Items */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                      {(sale.sale_items || []).map((item: any, i: number) => (
                        <span key={i} style={{ fontSize: '0.7rem', background: 'var(--color-bg-input)', color: 'var(--color-text-muted)', padding: '0.125rem 0.5rem', borderRadius: 4 }}>
                          {item.product?.name} ×{item.quantity}
                        </span>
                      ))}
                    </div>
                    {sale.balance > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#fbbf24' }}>
                        ⚠️ Saldo pendiente: {fmt(sale.balance)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
