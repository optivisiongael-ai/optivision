import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import { Warehouse, RefreshCw, Edit2, AlertTriangle, Check, X, Settings2 } from 'lucide-react';

export default function Inventory() {
  const { profile } = useAuth();
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [alertConfigs, setAlertConfigs] = useState<Record<string, any>>({});
  const [selectedStore, setSelectedStore] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  // Alert config modal
  const [alertModal, setAlertModal] = useState<{ storeId: string; storeName: string } | null>(null);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(10);
  const [alertSaving, setAlertSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [storesRes, productsRes, invRes, alertRes] = await Promise.all([
      supabase.from('stores').select('*').eq('active', true).order('name'),
      supabase.from('products').select('id, sku_code, name, category').eq('active', true).order('name'),
      supabase.from('inventory').select('*'),
      supabase.from('store_alert_config').select('*'),
    ]);
    const storeList = storesRes.data || [];
    setStores(storeList);
    setProducts(productsRes.data || []);
    setInventory(invRes.data || []);
    const cfgMap: Record<string, any> = {};
    (alertRes.data || []).forEach((c: any) => { cfgMap[c.store_id] = c; });
    setAlertConfigs(cfgMap);
    if (storeList.length > 0 && !selectedStore) setSelectedStore(storeList[0].id);
    setLoading(false);
  };

  const storeInventory = inventory.filter(i => i.store_id === selectedStore);
  const getQty = (productId: string) => storeInventory.find(i => i.product_id === productId)?.quantity ?? 0;
  const getInvId = (productId: string) => storeInventory.find(i => i.product_id === productId)?.id;
  const storeCfg = alertConfigs[selectedStore];

  const handleEdit = (productId: string, currentQty: number) => {
    setEditingItem(productId);
    setEditQty(String(currentQty));
  };

  const handleSaveQty = async (productId: string) => {
    setSaving(true);
    const newQty = parseInt(editQty) || 0;
    const invId = getInvId(productId);

    if (invId) {
      await supabase.from('inventory').update({ quantity: newQty, last_synced_at: new Date().toISOString() }).eq('id', invId);
    } else {
      await supabase.from('inventory').insert({ product_id: productId, store_id: selectedStore, quantity: newQty });
    }

    await supabase.from('audit_log').insert({
      user_id: profile?.id, user_email: profile?.email,
      action: 'INVENTARIO_EDITADO', entity_type: 'INVENTORY', entity_id: productId,
      description: `Stock actualizado a ${newQty} uds en tienda ${stores.find(s => s.id === selectedStore)?.name}`,
    });

    setEditingItem(null);
    loadAll();
    setSaving(false);
  };

  const handleSync = async () => {
    setSyncLoading(true);
    setMsg(null);
    await supabase.from('sync_logs').insert({
      store_id: selectedStore,
      status: 'SUCCESS',
      triggered_by: profile?.email,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      notes: 'Sincronización manual desde panel admin',
    });
    setMsg({ type: 'ok', text: '✅ Sincronización registrada correctamente' });
    setTimeout(() => setMsg(null), 3000);
    setSyncLoading(false);
  };

  const openAlertConfig = (storeId: string, storeName: string) => {
    const cfg = alertConfigs[storeId];
    setAlertEnabled(cfg?.alerts_enabled ?? false);
    setAlertThreshold(cfg?.low_stock_threshold ?? 10);
    setAlertModal({ storeId, storeName });
  };

  const saveAlertConfig = async () => {
    if (!alertModal) return;
    setAlertSaving(true);
    const existing = alertConfigs[alertModal.storeId];
    if (existing) {
      await supabase.from('store_alert_config').update({ alerts_enabled: alertEnabled, low_stock_threshold: alertThreshold, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('store_alert_config').insert({ store_id: alertModal.storeId, alerts_enabled: alertEnabled, low_stock_threshold: alertThreshold });
    }
    setAlertModal(null);
    setAlertSaving(false);
    loadAll();
  };

  const CATEGORY_LABELS: Record<string, string> = { LENTE: 'Lente', MONTURA: 'Montura', MATERIAL: 'Material', ACCESORIO: 'Accesorio' };
  const CATEGORY_COLORS: Record<string, string> = { LENTE: 'teal', MONTURA: 'blue', MATERIAL: 'purple', ACCESORIO: 'yellow' };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🏪 Inventario por Tienda</h1>
          <p className="page-subtitle">Administra el stock de cada tienda y configura alertas de bajo inventario</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {selectedStore && (
            <>
              <button onClick={() => openAlertConfig(selectedStore, stores.find(s => s.id === selectedStore)?.name)} className="btn btn-secondary">
                <Settings2 size={15} /> Configurar Alerta
              </button>
              <button onClick={handleSync} disabled={syncLoading} className="btn btn-primary">
                <RefreshCw size={15} style={{ animation: syncLoading ? 'spin 0.7s linear infinite' : 'none' }} />
                {syncLoading ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            </>
          )}
        </div>
      </div>

      {msg && <div className={`alert ${msg.type === 'ok' ? 'alert-success' : 'alert-error'} fade-in`} style={{ marginBottom: '1.5rem' }}>{msg.text}</div>}

      {/* Store selector */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {stores.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedStore(s.id)}
              className={`btn btn-sm ${selectedStore === s.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              🏪 {s.name}
            </button>
          ))}
        </div>
        {selectedStore && storeCfg && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`badge ${storeCfg.alerts_enabled ? 'badge-yellow' : 'badge-gray'}`}>
              <AlertTriangle size={10} />
              {storeCfg.alerts_enabled ? `Alerta: ≤${storeCfg.low_stock_threshold} uds` : 'Alertas desactivadas'}
            </span>
          </div>
        )}
      </div>

      {/* Inventory table */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><div className="spinner spinner-lg" /></div>
      ) : !selectedStore ? (
        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem' }}>Crea tiendas en Configuración primero.</p>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th style={{ textAlign: 'center' }}>Stock</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Sin productos en el catálogo</td></tr>
              ) : products.map(p => {
                const qty = getQty(p.id);
                const isLow = storeCfg?.alerts_enabled && qty <= storeCfg.low_stock_threshold;
                const isEditing = editingItem === p.id;
                return (
                  <tr key={p.id} style={{ background: isLow ? 'rgba(245,158,11,0.04)' : undefined }}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-brand-400)' }}>{p.sku_code}</span></td>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td><span className={`badge badge-${CATEGORY_COLORS[p.category] || 'gray'}`}>{CATEGORY_LABELS[p.category] || p.category}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      {isEditing ? (
                        <input
                          type="number" min="0" value={editQty}
                          onChange={e => setEditQty(e.target.value)}
                          autoFocus
                          style={{
                            width: 80, textAlign: 'center', background: 'var(--color-bg-input)',
                            border: '1px solid var(--color-brand-600)', borderRadius: 8,
                            color: 'var(--color-text-primary)', padding: '0.25rem 0.5rem', fontFamily: 'inherit',
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveQty(p.id); if (e.key === 'Escape') setEditingItem(null); }}
                        />
                      ) : (
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: isLow ? '#fbbf24' : 'var(--color-text-primary)' }}>
                          {qty}
                          {isLow && <AlertTriangle size={12} style={{ marginLeft: 4, color: '#fbbf24', verticalAlign: 'middle' }} />}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${qty === 0 ? 'badge-red' : isLow ? 'badge-yellow' : 'badge-green'}`}>
                        {qty === 0 ? 'Sin stock' : isLow ? 'Stock bajo' : 'OK'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        {isEditing ? (
                          <>
                            <button onClick={() => handleSaveQty(p.id)} disabled={saving} className="btn btn-success btn-sm btn-icon">
                              {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Check size={14} />}
                            </button>
                            <button onClick={() => setEditingItem(null)} className="btn btn-ghost btn-sm btn-icon"><X size={14} /></button>
                          </>
                        ) : (
                          <button onClick={() => handleEdit(p.id, qty)} className="btn btn-ghost btn-sm btn-icon" title="Editar stock"><Edit2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Alert config modal */}
      {alertModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>
                🔔 Advertencia de Insuficiencia
              </h2>
              <button onClick={() => setAlertModal(null)} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
              Tienda: <strong style={{ color: 'var(--color-text-primary)' }}>{alertModal.storeName}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', cursor: 'pointer' }}>
                <div
                  onClick={() => setAlertEnabled(v => !v)}
                  style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: alertEnabled ? 'var(--color-brand-600)' : 'var(--color-border)',
                    position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2, left: alertEnabled ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'white', transition: 'left 0.2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }} />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {alertEnabled ? 'Alertas activadas' : 'Alertas desactivadas'}
                </span>
              </label>

              {alertEnabled && (
                <div className="fade-in">
                  <label className="label">Advertir cuando queden (unidades)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <input
                      type="range" min="1" max="100" value={alertThreshold}
                      onChange={e => setAlertThreshold(parseInt(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--color-brand-500)' }}
                    />
                    <select
                      className="input input-sm"
                      value={alertThreshold}
                      onChange={e => setAlertThreshold(parseInt(e.target.value))}
                      style={{ width: 80 }}
                    >
                      {Array.from({ length: 100 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div className="alert alert-warning" style={{ marginTop: '0.875rem', padding: '0.625rem 0.875rem' }}>
                    <AlertTriangle size={14} />
                    Se mostrará alerta cuando el stock sea ≤ <strong>{alertThreshold} unidades</strong>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button onClick={() => setAlertModal(null)} className="btn btn-secondary">Cancelar</button>
                <button onClick={saveAlertConfig} disabled={alertSaving} className="btn btn-primary">
                  {alertSaving ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Guardando...</> : <><Check size={15} /> Guardar Configuración</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
