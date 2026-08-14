import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import {
  Users, Plus, KeyRound, Copy, Check, Store, X,
  AlertCircle, Eye, EyeOff, Pencil
} from 'lucide-react';

// ── User Management ────────────────────────────────────────────
function UserManagement() {
  const { profile } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('VENDEDOR');
  const [storeId, setStoreId] = useState('');
  const [stores, setStores] = useState<any[]>([]);
  const [createMsg, setCreateMsg] = useState<{ type: 'ok' | 'error'; text: string; password?: string } | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [copiedCreate, setCopiedCreate] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'ok' | 'error'; text: string; password?: string; userId?: string } | null>(null);
  const [resetLoadingId, setResetLoadingId] = useState<string | null>(null);
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);
  const [copiedReset, setCopiedReset] = useState(false);
  const [storeAssignId, setStoreAssignId] = useState<string | null>(null);
  const [storeAssignVal, setStoreAssignVal] = useState('');
  const [storeAssignLoading, setStoreAssignLoading] = useState(false);
  const [storeAssignMsg, setStoreAssignMsg] = useState<{ type: 'ok'|'error'; text: string } | null>(null);

  useEffect(() => {
    fetchUsers();
    supabase.from('stores').select('id, name').eq('active', true).order('name').then(({ data }) => setStores(data || []));
  }, []);

  const fetchUsers = async () => {
    setUsersLoading(true);
    const { data } = await supabase.from('profiles').select('id, email, full_name, role, active, store_id, stores(name)').neq('role', 'ADMIN').order('created_at', { ascending: false });
    setUsers(data || []);
    setUsersLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    // Vendedor must have a store
    if (role === 'VENDEDOR' && !storeId) {
      setCreateMsg({ type: 'error', text: '⚠️ Debes asignar una tienda al vendedor.' });
      return;
    }
    setCreateLoading(true); setCreateMsg(null);
    try {
      const res = await fetch('/api/admin-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'optivision-secret-k7x9m2p4' },
        body: JSON.stringify({ action: 'create', email: email.trim(), role, store_id: role === 'VENDEDOR' ? storeId || null : null, invited_by: profile?.email }),
      });
      const data = await res.json();
      if (!data?.success) {
        setCreateMsg({ type: 'error', text: data?.error || 'Error al crear usuario' });
      } else {
        setCreateMsg({ type: 'ok', text: '✅ Usuario creado', password: data.generated_password });
        setEmail(''); setRole('VENDEDOR'); setStoreId('');
        fetchUsers();
      }
    } catch (err: any) {
      setCreateMsg({ type: 'error', text: err.message || 'Error de conexión' });
    }
    setCreateLoading(false);
  };

  const handleResetPassword = async (userEmail: string, userId: string) => {
    setResetLoadingId(userId); setResetMsg(null);
    try {
      const res = await fetch('/api/admin-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'optivision-secret-k7x9m2p4' },
        body: JSON.stringify({ action: 'reset', email: userEmail, invited_by: profile?.email }),
      });
      const data = await res.json();
      if (!data?.success) {
        setResetMsg({ type: 'error', text: data?.error || 'Error al resetear', userId });
      } else {
        setResetMsg({ type: 'ok', text: '✅ Password reseteado', password: data.generated_password, userId });
      }
    } catch (err: any) { setResetMsg({ type: 'error', text: err.message, userId }); }
    setResetLoadingId(null);
  };

  const handleToggleActive = async (userId: string, current: boolean) => {
    setToggleLoadingId(userId);
    await supabase.from('profiles').update({ active: !current }).eq('id', userId);
    fetchUsers();
    setToggleLoadingId(null);
  };

  const handleChangeStore = async (userId: string) => {
    if (!storeAssignVal) {
      setStoreAssignMsg({ type: 'error', text: 'Selecciona una tienda.' });
      return;
    }
    setStoreAssignLoading(true);
    setStoreAssignMsg(null);
    const { error } = await supabase
      .from('profiles')
      .update({ store_id: storeAssignVal })
      .eq('id', userId);
    if (error) {
      setStoreAssignMsg({ type: 'error', text: `Error: ${error.message}` });
      setStoreAssignLoading(false);
      return;
    }
    setStoreAssignMsg({ type: 'ok', text: '✅ Tienda asignada' });
    setTimeout(() => {
      setStoreAssignId(null);
      setStoreAssignVal('');
      setStoreAssignMsg(null);
    }, 1000);
    fetchUsers();
    setStoreAssignLoading(false);
  };

  const copy = (text: string, type: 'create' | 'reset') => {
    navigator.clipboard.writeText(text);
    if (type === 'create') { setCopiedCreate(true); setTimeout(() => setCopiedCreate(false), 2000); }
    else { setCopiedReset(true); setTimeout(() => setCopiedReset(false), 2000); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Create user */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
          <div className="icon-box icon-box-teal"><Plus size={18} /></div>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>Crear Usuario</h3>
        </div>

        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 420 }}>
          <div>
            <label className="label" htmlFor="new-user-email">Email</label>
            <input id="new-user-email" className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vendedor@optica.com" />
          </div>
          <div>
            <label className="label" htmlFor="new-user-role">Rol</label>
            <select id="new-user-role" className="input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="VENDEDOR">Vendedor</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          {/* Store — always required for VENDEDOR */}
          <div>
            <label className="label" htmlFor="new-user-store">
              Tienda Asignada {role === 'VENDEDOR' && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            <select
              id="new-user-store"
              className="input"
              value={storeId}
              onChange={e => setStoreId(e.target.value)}
              required={role === 'VENDEDOR'}
            >
              <option value="">-- Seleccionar tienda --</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {role === 'ADMIN' && <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Administradores tienen acceso a todas las tiendas.</p>}
          </div>

          <button type="submit" disabled={createLoading} className="btn btn-primary">
            {createLoading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Creando...</> : <><Users size={15} /> Crear Usuario</>}
          </button>

          {createMsg && (
            <div className={`alert ${createMsg.type === 'ok' ? 'alert-success' : 'alert-error'} fade-in`}>
              {createMsg.type === 'error' ? <AlertCircle size={15} /> : <Check size={15} />}
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600 }}>{createMsg.text}</p>
                {createMsg.password && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <p style={{ fontSize: '0.8rem', marginBottom: '0.375rem' }}>🔑 Contraseña temporal:</p>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-input)', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <span style={{ flex: 1, padding: '0.375rem 0.75rem', fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{createMsg.password}</span>
                      <button type="button" onClick={() => copy(createMsg.password!, 'create')} style={{ padding: '0.375rem 0.625rem', background: 'rgba(16,185,129,0.15)', border: 'none', cursor: 'pointer', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                        {copiedCreate ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Users list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div className="icon-box icon-box-blue"><Users size={18} /></div>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>Vendedores</h3>
        </div>
        <div>
          {usersLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
          ) : users.length === 0 ? (
            <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Sin usuarios creados</p>
          ) : users.map(u => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: u.active ? 'transparent' : 'rgba(239,68,68,0.04)',
              flexWrap: 'wrap',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(6,182,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--color-brand-400)', flexShrink: 0 }}>
                {u.email.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.full_name || u.email}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {u.email}
                  {u.stores?.name && ` · ${u.stores.name}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className={`badge ${u.role === 'ADMIN' ? 'badge-teal' : 'badge-blue'}`}>{u.role}</span>
                {!u.active && <span className="badge badge-red">Inactivo</span>}
                {!u.stores?.name && u.role === 'VENDEDOR' && <span className="badge badge-yellow" title="Sin tienda asignada">⚠️ Sin tienda</span>}
                <button
                  onClick={() => { setStoreAssignId(u.id); setStoreAssignVal(u.store_id || ''); }}
                  className="btn btn-ghost btn-sm"
                  title="Cambiar tienda"
                >
                  <Store size={13} /> {u.stores?.name || 'Asignar tienda'}
                </button>
                <button
                  onClick={() => handleToggleActive(u.id, u.active)}
                  disabled={toggleLoadingId === u.id}
                  className={`btn btn-sm ${u.active ? 'btn-danger' : 'btn-success'}`}
                >
                  {toggleLoadingId === u.id ? '...' : u.active ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  onClick={() => handleResetPassword(u.email, u.id)}
                  disabled={resetLoadingId === u.id || !u.active}
                  className="btn btn-secondary btn-sm"
                >
                  <KeyRound size={13} />
                  {resetLoadingId === u.id ? 'Reseteando...' : 'Reset'}
                </button>
              </div>
              {/* Inline store selector */}
              {storeAssignId === u.id && (
                <div style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem', background: 'var(--color-bg-input)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                      className="input input-sm"
                      value={storeAssignVal}
                      onChange={e => { setStoreAssignVal(e.target.value); setStoreAssignMsg(null); }}
                      style={{ flex: 1 }}
                    >
                      <option value="">-- Seleccionar tienda --</option>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button onClick={() => handleChangeStore(u.id)} disabled={storeAssignLoading} className="btn btn-primary btn-sm">
                      {storeAssignLoading ? '...' : <><Check size={13} /> Guardar</>}
                    </button>
                    <button onClick={() => { setStoreAssignId(null); setStoreAssignMsg(null); }} className="btn btn-ghost btn-sm"><X size={13} /></button>
                  </div>
                  {storeAssignMsg && (
                    <p style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: storeAssignMsg.type === 'ok' ? '#34d399' : '#f87171', fontWeight: 600 }}>
                      {storeAssignMsg.text}
                    </p>
                  )}
                </div>
              )}
              {resetMsg && resetMsg.userId === u.id && (
                <div className={`alert ${resetMsg.type === 'ok' ? 'alert-success' : 'alert-error'} fade-in`} style={{ width: '100%', padding: '0.5rem 0.75rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{resetMsg.text}</span>
                  {resetMsg.password && (
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-input)', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(16,185,129,0.3)', marginTop: 4 }}>
                      <span style={{ flex: 1, padding: '0.25rem 0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{resetMsg.password}</span>
                      <button type="button" onClick={() => copy(resetMsg.password!, 'reset')} style={{ padding: '0.25rem 0.5rem', background: 'rgba(16,185,129,0.15)', border: 'none', cursor: 'pointer', color: '#34d399', fontSize: '0.7rem', display: 'flex', gap: '0.25rem' }}>
                        {copiedReset ? <Check size={11} /> : <Copy size={11} />}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Store Management ────────────────────────────────────────────
function StoreManagement() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [logoUploading, setLogoUploading] = useState<string | null>(null); // storeId being uploaded

  useEffect(() => { fetchStores(); }, []);

  const fetchStores = async () => {
    setLoading(true);
    const { data } = await supabase.from('stores').select('*').order('name');
    setStores(data || []);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    const payload = { name: form.name.trim(), address: form.address.trim(), phone: form.phone.trim(), active: true };
    const { data: savedStore, error } = editId
      ? await supabase.from('stores').update(payload).eq('id', editId).select().single()
      : await supabase.from('stores').insert(payload).select().single();
    if (error) { setMsg({ type: 'error', text: error.message }); }
    else {
      // Upsert store_alert_config with max discount
      if (savedStore?.id) {
        await supabase.from('store_alert_config').upsert({
          store_id: savedStore.id,
          max_discount_per_item: parseFloat((form as any).maxDiscount) || 500,
          alerts_enabled: false, low_stock_threshold: 10,
        }, { onConflict: 'store_id' });
      }
      setMsg({ type: 'ok', text: editId ? '✅ Tienda actualizada' : '✅ Tienda creada' }); fetchStores(); setTimeout(() => { setShowForm(false); setMsg(null); }, 1200);
    }
    setSaving(false);
  };

  const toggleActive = async (storeId: string, current: boolean) => {
    await supabase.from('stores').update({ active: !current }).eq('id', storeId);
    fetchStores();
  };

  const uploadLogo = async (storeId: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    setLogoUploading(storeId);
    const ext = file.name.split('.').pop();
    const path = `${storeId}/logo.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('store-logos')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { alert('Error al subir logo: ' + upErr.message); setLogoUploading(null); return; }
    const { data: { publicUrl } } = supabase.storage.from('store-logos').getPublicUrl(path);
    await supabase.from('stores').update({ logo_url: publicUrl }).eq('id', storeId);
    fetchStores();
    setLogoUploading(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div className="icon-box icon-box-green"><Store size={18} /></div>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>Tiendas ({stores.length})</h3>
        </div>
        <button onClick={() => { setForm({ name: '', address: '', phone: '' }); setEditId(null); setShowForm(true); setMsg(null); }} className="btn btn-primary btn-sm">
          <Plus size={14} /> Nueva Tienda
        </button>
      </div>

      {showForm && (
        <div className="card fade-in" style={{ border: '1px solid var(--color-brand-700)', background: 'rgba(8,145,178,0.06)' }}>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-grid-2">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Tienda Centro" />
              </div>
              <div>
                <label className="label">Dirección</label>
                <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Av. Ayacucho 123" />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+591 70000000" />
              </div>

            </div>
            {msg && <div className={`alert ${msg.type === 'ok' ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary btn-sm">Cancelar</button>
              <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
                {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear Tienda'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {loading ? <div className="spinner" /> : stores.map(s => (
          <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', opacity: s.active ? 1 : 0.65 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              {/* Logo preview */}
              <div style={{ position: 'relative' }}>
                <label htmlFor={`logo-upload-${s.id}`} style={{ cursor: 'pointer', display: 'block' }} title="Click para cambiar el logo">
                  {s.logo_url
                    ? <img src={s.logo_url} alt="Logo" style={{ height: 52, width: 52, objectFit: 'contain', borderRadius: 8, border: '2px solid var(--color-border)', background: 'white', padding: 2 }} />
                    : <div style={{ height: 52, width: 52, borderRadius: 8, border: '2px dashed var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'var(--color-text-muted)' }}>🏪</div>
                  }
                  <div style={{ position: 'absolute', bottom: -4, right: -4, background: 'var(--color-brand-500)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>
                    {logoUploading === s.id ? '⏳' : '📷'}
                  </div>
                </label>
                <input
                  id={`logo-upload-${s.id}`}
                  type="file" accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(s.id, f); e.target.value = ''; }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button onClick={() => { setForm({ name: s.name, address: s.address || '', phone: s.phone || '', maxDiscount: 500 } as any); setEditId(s.id); setShowForm(true); setMsg(null); }} className="btn btn-ghost btn-icon btn-sm">
                  <Pencil size={13} />
                </button>
                <button onClick={() => toggleActive(s.id, s.active)}
                  className={`btn btn-sm ${s.active ? 'btn-danger' : 'btn-success'}`}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>
                  {s.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>{s.name}</div>
              {s.address && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{s.address}</div>}
              {s.phone && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{s.phone}</div>}
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.375rem' }}>
                {s.logo_url ? '✅ Logo personalizado' : '⬆️ Click en el ícono para subir logo'}
              </div>
            </div>
            <span className={`badge ${s.active ? 'badge-green' : 'badge-red'}`} style={{ alignSelf: 'flex-start' }}>
              {s.active ? 'Activa' : 'Inactiva'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Profile Section ─────────────────────────────────────────────
function ProfileSection() {
  const { profile } = useAuth();
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { setPwdMsg({ type: 'error', text: 'Las contraseñas no coinciden' }); return; }
    if (newPwd.length < 6) { setPwdMsg({ type: 'error', text: 'Mínimo 6 caracteres' }); return; }
    setPwdLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) { setPwdMsg({ type: 'error', text: error.message }); }
    else { setPwdMsg({ type: 'ok', text: '✅ Contraseña actualizada' }); setNewPwd(''); setConfirmPwd(''); }
    setPwdLoading(false);
  };

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-brand-700), var(--color-brand-500))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.25rem', color: 'white' }}>
          {(profile?.email || '?').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{profile?.email}</div>
          <span className="badge badge-teal">⚡ {profile?.role}</span>
        </div>
      </div>

      <div className="divider" />
      <h4 style={{ fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text-primary)' }}>Cambiar Contraseña</h4>
      <form onSubmit={handleChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div style={{ position: 'relative' }}>
          <input className="input" type={showPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Nueva contraseña" style={{ paddingRight: '2.5rem' }} />
          <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <input className="input" type={showPwd ? 'text' : 'password'} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Confirmar contraseña" />
        {pwdMsg && <div className={`alert ${pwdMsg.type === 'ok' ? 'alert-success' : 'alert-error'}`}>{pwdMsg.text}</div>}
        <button type="submit" disabled={pwdLoading} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
          {pwdLoading ? 'Guardando...' : 'Actualizar Contraseña'}
        </button>
      </form>
    </div>
  );
}

// ── Settings Page ───────────────────────────────────────────────
type Tab = 'users' | 'stores' | 'profile';

export default function Settings() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN';
  const [tab, setTab] = useState<Tab>(isAdmin ? 'users' : 'profile');

  const allTabs: { id: Tab; label: string; icon: string; adminOnly?: boolean }[] = [
    { id: 'users', label: 'Usuarios', icon: '👥', adminOnly: true },
    { id: 'stores', label: 'Tiendas', icon: '🏪', adminOnly: true },
    { id: 'profile', label: 'Mi Perfil', icon: '👤' },
  ];
  const tabs = allTabs.filter(t => !t.adminOnly || isAdmin);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ Configuración</h1>
          <p className="page-subtitle">{isAdmin ? 'Gestiona usuarios, tiendas y configuración del sistema' : 'Gestiona tu perfil y contraseña'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '0.625rem 1.25rem', border: 'none', cursor: 'pointer',
              background: 'transparent', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600,
              color: tab === t.id ? 'var(--color-brand-400)' : 'var(--color-text-muted)',
              borderBottom: tab === t.id ? '2px solid var(--color-brand-500)' : '2px solid transparent',
              transition: 'all 0.15s',
              gap: '0.5rem', display: 'flex', alignItems: 'center',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="fade-in" key={tab}>
        {tab === 'users' && isAdmin && <UserManagement />}
        {tab === 'stores' && isAdmin && <StoreManagement />}
        {tab === 'profile' && <ProfileSection />}
      </div>
    </div>
  );
}
