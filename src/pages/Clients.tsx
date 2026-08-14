import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import { Search, Edit2, X, Hash, Phone, Mail, Eye, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchCatalogByTypes } from '../lib/useCatalog';
import type { CatalogOption } from '../lib/useCatalog';

const fmt = (n: number) => `Bs. ${n.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;

const emptyEdit = {
  full_name: '', phone: '', email: '', age: '',
  frame_type: '', crystal_type: '',
  delivery_date: '', delivery_time: '',
  // Lejos
  od_sphere: '', od_cylinder: '', od_axis: '', dip_far: '',
  oi_sphere: '', oi_cylinder: '', oi_axis: '',
  od_add: '', oi_add: '',
  // Cerca
  od_sphere_near: '', od_cyl_near: '', od_axis_near: '', od_dip_near: '',
  oi_sphere_near: '', oi_cyl_near: '', oi_axis_near: '',
  add_near: '',
  notes: '',
};



export default function Clients() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [clientSales, setClientSales] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(emptyEdit);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [showNear, setShowNear] = useState(false);
  const [frameTypes, setFrameTypes] = useState<CatalogOption[]>([]);
  const [crystalTypes, setCrystalTypes] = useState<CatalogOption[]>([]);

  useEffect(() => {
    fetchCatalogByTypes(['FRAME_TYPE', 'CRYSTAL_TYPE']).then(cat => {
      setFrameTypes(cat.FRAME_TYPE || []);
      setCrystalTypes(cat.CRYSTAL_TYPE || []);
    });
  }, []);

  const searchClients = useCallback(async (q: string) => {
    setLoading(true);
    const query = supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (q.trim()) {
      query.or(`full_name.ilike.%${q}%,client_code.ilike.%${q}%,phone.ilike.%${q}%`);
    } else {
      query.limit(30);
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
    setEditing(false);
    setSaveMsg(null);
    setSalesLoading(true);
    const { data } = await supabase.from('sales')
      .select('id, sale_code, total, advance_payment, balance, status, created_at, sale_items(quantity, unit_price, product:products(name))')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false });
    setClientSales(data || []);
    setSalesLoading(false);
  };

  const startEdit = () => {
    setEditForm({
      full_name: selectedClient.full_name || '',
      phone: selectedClient.phone || '',
      email: selectedClient.email || '',
      age: selectedClient.age || '',
      frame_type: selectedClient.frame_type || '',
      crystal_type: selectedClient.crystal_type || '',
      delivery_date: selectedClient.delivery_date || '',
      delivery_time: selectedClient.delivery_time || '',
      od_sphere: selectedClient.od_sphere || '',
      od_cylinder: selectedClient.od_cylinder || '',
      od_axis: selectedClient.od_axis || '',
      dip_far: selectedClient.dip_far || '',
      oi_sphere: selectedClient.oi_sphere || '',
      oi_cylinder: selectedClient.oi_cylinder || '',
      oi_axis: selectedClient.oi_axis || '',
      od_add: selectedClient.od_add || '',
      oi_add: selectedClient.oi_add || '',
      od_sphere_near: selectedClient.od_sphere_near || '',
      od_cyl_near: selectedClient.od_cyl_near || '',
      od_axis_near: selectedClient.od_axis_near || '',
      od_dip_near: selectedClient.od_dip_near || '',
      oi_sphere_near: selectedClient.oi_sphere_near || '',
      oi_cyl_near: selectedClient.oi_cyl_near || '',
      oi_axis_near: selectedClient.oi_axis_near || '',
      add_near: selectedClient.add_near || '',
      notes: selectedClient.notes || '',
    });
    setEditing(true);
    setSaveMsg(null);
  };

  const saveEdit = async () => {
    if (!editForm.full_name.trim()) { setSaveMsg({ type: 'error', text: 'El nombre es obligatorio' }); return; }
    setSaving(true); setSaveMsg(null);
    const payload = {
      full_name: editForm.full_name.trim(),
      phone: editForm.phone.trim() || null,
      email: editForm.email.trim() || null,
      age: editForm.age || null,
      frame_type: editForm.frame_type || null,
      crystal_type: editForm.crystal_type || null,
      delivery_date: editForm.delivery_date || null,
      delivery_time: editForm.delivery_time || null,
      od_sphere: editForm.od_sphere || null, od_cylinder: editForm.od_cylinder || null,
      od_axis: editForm.od_axis || null, dip_far: editForm.dip_far || null,
      oi_sphere: editForm.oi_sphere || null, oi_cylinder: editForm.oi_cylinder || null,
      oi_axis: editForm.oi_axis || null,
      od_add: editForm.od_add || null, oi_add: editForm.oi_add || null,
      od_sphere_near: editForm.od_sphere_near || null, od_cyl_near: editForm.od_cyl_near || null,
      od_axis_near: editForm.od_axis_near || null, od_dip_near: editForm.od_dip_near || null,
      oi_sphere_near: editForm.oi_sphere_near || null, oi_cyl_near: editForm.oi_cyl_near || null,
      oi_axis_near: editForm.oi_axis_near || null,
      add_near: editForm.add_near || null,
      notes: editForm.notes || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('clients').update(payload).eq('id', selectedClient.id);
    if (error) { setSaveMsg({ type: 'error', text: error.message }); }
    else {
      await supabase.from('audit_log').insert({
        user_id: profile?.id, user_email: profile?.email,
        action: 'CLIENTE_EDITADO', entity_type: 'CLIENT', entity_id: selectedClient.id,
        description: `Cliente editado: ${editForm.full_name}`,
      });
      const updated = { ...selectedClient, ...payload };
      setSelectedClient(updated);
      setEditing(false);
      setSaveMsg({ type: 'ok', text: '✅ Cliente actualizado' });
      searchClients(search);
    }
    setSaving(false);
  };

  const f = (key: string) => (editForm as any)[key];
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 Clientes</h1>
          <p className="page-subtitle">Busca clientes, consulta historial y actualiza medidas ópticas</p>
        </div>
      </div>

      <div className={selectedClient ? 'client-grid' : ''} style={{ display: selectedClient ? undefined : 'block' }}>
        {/* Client list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input id="client-search" className="input" placeholder="Nombre, código o teléfono..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.5rem' }} />
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {loading ? 'Buscando...' : `${clients.length} cliente${clients.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
              ) : clients.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  {search ? 'Sin resultados' : 'No hay clientes registrados aún'}
                </div>
              ) : clients.map(c => (
                <button key={c.id} onClick={() => openClient(c)} style={{
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
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{c.client_code}</div>
                  </div>
                  {c.phone && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>{c.phone}</div>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Client detail */}
        {selectedClient && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header card */}
            <div className="card" style={{ background: 'linear-gradient(135deg, rgba(8,145,178,0.1), transparent)', border: '1px solid rgba(6,182,212,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-brand-700), var(--color-brand-500))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.25rem', color: 'white' }}>
                    {selectedClient.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{selectedClient.full_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.2rem' }}>
                      <Hash size={11} style={{ color: 'var(--color-brand-400)' }} />
                      <span style={{ fontFamily: 'monospace', color: 'var(--color-brand-400)', fontSize: '0.8rem', fontWeight: 600 }}>{selectedClient.client_code}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!editing && (
                    <button onClick={startEdit} className="btn btn-secondary btn-sm"><Edit2 size={13} /> Editar</button>
                  )}
                  <button onClick={() => { setSelectedClient(null); setEditing(false); setSaveMsg(null); }} className="btn btn-ghost btn-icon btn-sm"><X size={15} /></button>
                </div>
              </div>
              {!editing && (
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  {selectedClient.phone && <span><Phone size={12} style={{ verticalAlign: 'middle' }} /> {selectedClient.phone}</span>}
                  {selectedClient.email && <span><Mail size={12} style={{ verticalAlign: 'middle' }} /> {selectedClient.email}</span>}
                  {selectedClient.age && <span>Edad: {selectedClient.age}</span>}
                  <span style={{ fontSize: '0.75rem' }}>Registrado: {new Date(selectedClient.created_at).toLocaleDateString('es-BO')}</span>
                </div>
              )}
            </div>

            {/* Alert message */}
            {saveMsg && !editing && (
              <div className={`alert ${saveMsg.type === 'ok' ? 'alert-success' : 'alert-error'} fade-in`}>{saveMsg.text}</div>
            )}

            {/* Edit form */}
            {editing ? (
              <div className="card fade-in">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontWeight: 700, fontSize: '0.9375rem' }}>✏️ Editar Cliente</h3>
                  <button onClick={() => { setEditing(false); setSaveMsg(null); }} className="btn btn-ghost btn-icon btn-sm"><X size={15} /></button>
                </div>

                {saveMsg && <div className={`alert ${saveMsg.type === 'ok' ? 'alert-success' : 'alert-error'} fade-in`} style={{ marginBottom: '1rem' }}>{saveMsg.text}</div>}

                {/* Info básica */}
                <div className="form-grid-2" style={{ marginBottom: '1rem' }}>
                  <div><label className="label">Nombre *</label><input className="input input-sm" value={f('full_name')} onChange={set('full_name')} /></div>
                  <div><label className="label">Teléfono</label><input className="input input-sm" value={f('phone')} onChange={set('phone')} /></div>
                  <div><label className="label">Email</label><input className="input input-sm" type="email" value={f('email')} onChange={set('email')} /></div>
                  <div><label className="label">Edad</label><input className="input input-sm" value={f('age')} onChange={set('age')} placeholder="Ej: 35" /></div>
                  <div>
                    <label className="label">Armazón</label>
                    <select className="input input-sm" value={f('frame_type')} onChange={set('frame_type')}>
                      <option value="">-- Seleccionar --</option>
                      {frameTypes.map(v => <option key={v.value} value={v.label}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Cristales</label>
                    <select className="input input-sm" value={f('crystal_type')} onChange={set('crystal_type')}>
                      <option value="">-- Seleccionar --</option>
                      {crystalTypes.map(v => <option key={v.value} value={v.label}>{v.label}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Fecha Entrega</label><input className="input input-sm" type="date" value={f('delivery_date')} onChange={set('delivery_date')} /></div>
                  <div><label className="label">Hora Entrega</label><input className="input input-sm" type="time" value={f('delivery_time')} onChange={set('delivery_time')} /></div>
                </div>

                {/* LEJOS */}
                <div className="rx-grid" style={{ background: 'var(--color-bg-input)', borderRadius: 10, padding: '0.875rem', marginBottom: '0.75rem', border: '1px solid var(--color-border)' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-brand-400)', marginBottom: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📏 Lejos</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 1fr', gap: '0.4rem', alignItems: 'center', marginBottom: '0.375rem' }}>
                    <span />{['Esfera', 'Cilindro', 'Eje', 'DIP'].map(h => <span key={h} style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>{h}</span>)}
                  </div>
                  {[['O.D.', 'od_sphere', 'od_cylinder', 'od_axis', 'dip_far'], ['O.I.', 'oi_sphere', 'oi_cylinder', 'oi_axis', '']].map(([lbl, s, c, a, d]) => (
                    <div key={lbl} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 1fr', gap: '0.4rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{lbl}</span>
                      <input className="input input-sm" value={f(s)} onChange={set(s)} placeholder="+0.00" style={{ textAlign: 'center' }} />
                      <input className="input input-sm" value={f(c)} onChange={set(c)} placeholder="+0.00" style={{ textAlign: 'center' }} />
                      <input className="input input-sm" value={f(a)} onChange={set(a)} placeholder="0°" style={{ textAlign: 'center' }} />
                      {d ? <input className="input input-sm" value={f(d)} onChange={set(d)} placeholder="0" style={{ textAlign: 'center' }} /> : <span />}
                    </div>
                  ))}
                </div>

                {/* CERCA — colapsable */}
                <div style={{ background: 'var(--color-bg-input)', borderRadius: 10, padding: '0.875rem', marginBottom: '0.75rem', border: '1px solid var(--color-border)' }}>
                  <button type="button" onClick={() => setShowNear(v => !v)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0, fontFamily: 'inherit' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>🔍 Cerca</p>
                    {showNear ? <ChevronUp size={14} color="#a78bfa" /> : <ChevronDown size={14} color="#a78bfa" />}
                  </button>
                  {showNear && (
                    <div className="fade-in" style={{ marginTop: '0.625rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 1fr', gap: '0.4rem', alignItems: 'center', marginBottom: '0.375rem' }}>
                        <span />{['Esfera', 'Cilindro', 'Eje', 'DIP'].map(h => <span key={h} style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>{h}</span>)}
                      </div>
                      {[['O.D.', 'od_sphere_near', 'od_cyl_near', 'od_axis_near', 'od_dip_near'], ['O.I.', 'oi_sphere_near', 'oi_cyl_near', 'oi_axis_near', '']].map(([lbl, s, c, a, d]) => (
                        <div key={lbl} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 1fr', gap: '0.4rem', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{lbl}</span>
                          <input className="input input-sm" value={f(s)} onChange={set(s)} placeholder="+0.00" style={{ textAlign: 'center' }} />
                          <input className="input input-sm" value={f(c)} onChange={set(c)} placeholder="+0.00" style={{ textAlign: 'center' }} />
                          <input className="input input-sm" value={f(a)} onChange={set(a)} placeholder="0°" style={{ textAlign: 'center' }} />
                          {d ? <input className="input input-sm" value={f(d)} onChange={set(d)} placeholder="0" style={{ textAlign: 'center' }} /> : <span />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ADD+ y notas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div><label className="label">ADD+ (Adición)</label><input className="input input-sm" value={f('add_near')} onChange={set('add_near')} placeholder="+1.50" /></div>
                  <div><label className="label">Observaciones</label><input className="input input-sm" value={f('notes')} onChange={set('notes')} placeholder="Recomendaciones, notas..." /></div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => { setEditing(false); setSaveMsg(null); }} className="btn btn-ghost btn-sm"><X size={14} /> Cancelar</button>
                  <button type="button" onClick={saveEdit} disabled={saving} className="btn btn-primary btn-sm">
                    {saving ? 'Guardando...' : <><Save size={14} /> Guardar Cambios</>}
                  </button>
                </div>
              </div>
            ) : (
              /* Prescription read-only view */
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
                  <div className="icon-box icon-box-teal" style={{ width: 32, height: 32 }}><Eye size={14} /></div>
                  <h3 style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Medidas Ópticas</h3>
                </div>

                {/* Extra info */}
                {(selectedClient.frame_type || selectedClient.crystal_type || selectedClient.age) && (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.8rem' }}>
                    {selectedClient.age && <span className="badge badge-gray">Edad: {selectedClient.age}</span>}
                    {selectedClient.frame_type && <span className="badge badge-blue">Armación: {selectedClient.frame_type}</span>}
                    {selectedClient.crystal_type && <span className="badge badge-teal">Cristal: {selectedClient.crystal_type}</span>}
                  </div>
                )}

                {/* Far vision table */}
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-brand-400)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>📏 Lejos</p>
                <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 1fr', gap: '0.375rem', marginBottom: '0.875rem', fontSize: '0.8rem' }}>
                  <span />{['Esfera', 'Cilindro', 'Eje', 'DIP'].map(h => <span key={h} style={{ color: 'var(--color-text-muted)', textAlign: 'center', fontSize: '0.7rem' }}>{h}</span>)}
                  {[['O.D.', selectedClient.od_sphere, selectedClient.od_cylinder, selectedClient.od_axis, selectedClient.dip_far],
                    ['O.I.', selectedClient.oi_sphere, selectedClient.oi_cylinder, selectedClient.oi_axis, null]].map(([lbl, ...vals]) => (
                    <div key={String(lbl)} style={{ display: 'contents' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{lbl}</span>
                      {vals.map((v, i) => (
                        <div key={i} style={{ padding: '0.3rem', background: 'var(--color-bg-input)', borderRadius: 6, textAlign: 'center', color: v ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: v ? 600 : 400 }}>
                          {String(v || '—')}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Near vision — collapsed by default */}
                {(selectedClient.od_sphere_near || selectedClient.oi_sphere_near) && (
                  <>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', marginBottom: '0.5rem' }}>🔍 Cerca</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr 1fr', gap: '0.375rem', marginBottom: '0.875rem', fontSize: '0.8rem' }}>
                      {[['O.D.', selectedClient.od_sphere_near, selectedClient.od_cyl_near, selectedClient.od_axis_near, selectedClient.od_dip_near],
                        ['O.I.', selectedClient.oi_sphere_near, selectedClient.oi_cyl_near, selectedClient.oi_axis_near, null]].map(([lbl, ...vals]) => (
                        <div key={String(lbl)} style={{ display: 'contents' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{lbl}</span>
                          {vals.map((v, i) => (
                            <div key={i} style={{ padding: '0.3rem', background: 'var(--color-bg-input)', borderRadius: 6, textAlign: 'center', color: v ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: v ? 600 : 400 }}>
                              {String(v || '—')}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {selectedClient.add_near && (
                  <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>ADD+: </span>
                    <strong>{selectedClient.add_near}</strong>
                  </div>
                )}
                {selectedClient.notes && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                    💬 {selectedClient.notes}
                  </div>
                )}
              </div>
            )}

            {/* Purchase history */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>📋 Historial de Compras</span>
                <span className="badge badge-gray">{clientSales.length}</span>
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
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
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>{new Date(sale.created_at).toLocaleString('es-BO')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, color: 'var(--color-brand-400)' }}>{fmt(sale.total)}</div>
                        <span className={`badge ${sale.status === 'COMPLETED' ? 'badge-green' : sale.status === 'CANCELLED' ? 'badge-red' : 'badge-yellow'}`} style={{ fontSize: '0.65rem' }}>
                          {sale.status === 'COMPLETED' ? 'Completada' : sale.status === 'CANCELLED' ? 'Cancelada' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                      {(sale.sale_items || []).map((item: any, i: number) => (
                        <span key={i} style={{ fontSize: '0.7rem', background: 'var(--color-bg-input)', color: 'var(--color-text-muted)', padding: '0.125rem 0.5rem', borderRadius: 4 }}>
                          {item.product?.name} ×{item.quantity}
                        </span>
                      ))}
                    </div>
                    {sale.balance > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#fbbf24' }}>⚠️ Saldo pendiente: {fmt(sale.balance)}</div>
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
