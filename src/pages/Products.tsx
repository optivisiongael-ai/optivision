import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import { fetchCatalogByTypes } from '../lib/useCatalog';
import type { CatalogOption } from '../lib/useCatalog';
import {
  Plus, Search, Package, Edit2, Trash2, X, Check,
  AlertCircle, ChevronDown, ChevronUp, Settings2, PackagePlus,
  RefreshCw, AlertTriangle, Warehouse,
} from 'lucide-react';

const fmt = (n: number) => `Bs. ${n.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;

const emptyForm = {
  sku_code: '', name: '', description: '', category: '',
  price: '', initial_stock: '0', min_stock_alert: '5', max_discount: '0',
};

// ── Catalog Manager ───────────────────────────────────────────────────────────
function CatalogSection({
  title, color: _color, options, onAdd, onRemove, onEdit,
}: {
  title: string; color: string;
  options: CatalogOption[];
  onAdd: (label: string, extra?: Partial<CatalogOption>) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, label: string) => void;
}) {
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('gray');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const COLORS = ['teal', 'blue', 'purple', 'yellow', 'green', 'red', 'gray'];
  const isCategory = title.toLowerCase().includes('categor');

  return (
    <div style={{ background: 'var(--color-bg-input)', borderRadius: 12, padding: '1rem', border: '1px solid var(--color-border)', flex: '1 1 260px' }}>
      <p style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: `var(--color-brand-400)`, marginBottom: '0.875rem' }}>
        {title}
      </p>

      {/* Existing items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.875rem' }}>
        {options.length === 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Sin opciones</p>
        )}
        {options.map(opt => (
          <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-bg-base)', borderRadius: 8, padding: '0.375rem 0.5rem' }}>
            {editingId === opt.id ? (
              <>
                <input
                  className="input input-sm"
                  style={{ flex: 1, fontSize: '0.8rem' }}
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  autoFocus
                />
                <button onClick={() => { onEdit(opt.id, editLabel); setEditingId(null); }} className="btn btn-primary btn-sm btn-icon" title="Guardar"><Check size={12} /></button>
                <button onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm btn-icon"><X size={12} /></button>
              </>
            ) : (
              <>
                {isCategory && opt.color && (
                  <span className={`badge badge-${opt.color}`} style={{ fontSize: '0.65rem', minWidth: 50, textAlign: 'center' }}>{opt.label}</span>
                )}
                {!isCategory && <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--color-text-primary)' }}>{opt.label}</span>}
                {isCategory && <span style={{ flex: 1 }} />}
                <button onClick={() => { setEditingId(opt.id); setEditLabel(opt.label); }} className="btn btn-ghost btn-sm btn-icon" title="Editar"><Edit2 size={12} /></button>
                <button onClick={() => onRemove(opt.id)} className="btn btn-danger btn-sm btn-icon" title="Eliminar"><Trash2 size={12} /></button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new */}
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        <input
          className="input input-sm"
          style={{ flex: 1, fontSize: '0.8rem' }}
          placeholder="Nueva opción..."
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && newLabel.trim()) {
              onAdd(newLabel.trim(), isCategory ? { color: newColor } : undefined);
              setNewLabel('');
            }
          }}
        />
        {isCategory && (
          <select
            className="input input-sm"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            style={{ width: 80, fontSize: '0.75rem' }}
          >
            {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button
          onClick={() => {
            if (!newLabel.trim()) return;
            onAdd(newLabel.trim(), isCategory ? { color: newColor } : undefined);
            setNewLabel('');
          }}
          className="btn btn-primary btn-sm btn-icon"
          title="Agregar"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main Products Component ───────────────────────────────────────────────────
export default function Products() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'catalog' | 'inventory'>(
    searchParams.get('tab') === 'inventory' ? 'inventory' : 'catalog'
  );
  const switchTab = (t: 'catalog' | 'inventory') => {
    setTab(t);
    setSearchParams(t === 'catalog' ? {} : { tab: t }, { replace: true });
  };

  // ── Catalog state ──────────────────────────────────────────────────────────
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);

  // Replenishment modal
  const [restockProduct, setRestockProduct] = useState<any | null>(null);
  const [storeInventory, setStoreInventory] = useState<{ store_id: string; store_name: string; current: number; add: string }[]>([]);
  const [restockSaving, setRestockSaving] = useState(false);
  const [restockMsg, setRestockMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  // Catalog options
  const [categories, setCategories] = useState<CatalogOption[]>([]);
  const [frameTypes, setFrameTypes] = useState<CatalogOption[]>([]);
  const [crystalTypes, setCrystalTypes] = useState<CatalogOption[]>([]);

  // ── Inventory tab state ────────────────────────────────────────────────────
  const [invStores, setInvStores] = useState<any[]>([]);
  const [invInventory, setInvInventory] = useState<any[]>([]);
  const [invAlertConfigs, setInvAlertConfigs] = useState<Record<string, any>>({});
  const [invSelectedStore, setInvSelectedStore] = useState('');
  const [invLoading, setInvLoading] = useState(false);
  const [invLoaded, setInvLoaded] = useState(false);
  const [invEditingItem, setInvEditingItem] = useState<string | null>(null);
  const [invEditQty, setInvEditQty] = useState('');
  const [invSaving, setInvSaving] = useState(false);
  const [invSyncLoading, setInvSyncLoading] = useState(false);
  const [invMsg, setInvMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [alertModal, setAlertModal] = useState<{ storeId: string; storeName: string } | null>(null);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(10);
  const [alertSaving, setAlertSaving] = useState(false);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { fetchProducts(); fetchCatalog(); }, []);
  useEffect(() => { if (tab === 'inventory' && !invLoaded) loadInventory(); }, [tab]);

  // ── Catalog functions ──────────────────────────────────────────────────────
  const fetchCatalog = async () => {
    const cat = await fetchCatalogByTypes(['PRODUCT_CATEGORY', 'FRAME_TYPE', 'CRYSTAL_TYPE']);
    setCategories(cat.PRODUCT_CATEGORY || []);
    setFrameTypes(cat.FRAME_TYPE || []);
    setCrystalTypes(cat.CRYSTAL_TYPE || []);
  };

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku_code.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'ALL' || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const openCreate = () => {
    const defaultCat = categories[0]?.value || '';
    setForm({ ...emptyForm, category: defaultCat });
    setEditId(null); setShowForm(true); setMsg(null);
  };

  const openRestock = async (p: any) => {
    setRestockProduct(p);
    setRestockMsg(null);
    const [storesRes, invRes] = await Promise.all([
      supabase.from('stores').select('id, name').eq('active', true).order('name'),
      supabase.from('inventory').select('store_id, quantity').eq('product_id', p.id),
    ]);
    const invMap: Record<string, number> = {};
    for (const i of invRes.data || []) invMap[i.store_id] = i.quantity;
    setStoreInventory((storesRes.data || []).map((s: any) => ({
      store_id: s.id, store_name: s.name,
      current: invMap[s.id] ?? 0, add: '',
    })));
  };

  const handleRestock = async () => {
    if (!restockProduct) return;
    setRestockSaving(true); setRestockMsg(null);
    const toUpdate = storeInventory.filter(s => parseInt(s.add) > 0);
    if (toUpdate.length === 0) { setRestockMsg({ type: 'error', text: 'Ingresa al menos una cantidad a reponer.' }); setRestockSaving(false); return; }

    const errors: string[] = [];
    for (const s of toUpdate) {
      const addQty = parseInt(s.add) || 0;
      const { data: existing } = await supabase.from('inventory')
        .select('id, quantity').eq('product_id', restockProduct.id).eq('store_id', s.store_id).single();
      if (existing) {
        const { error } = await supabase.from('inventory')
          .update({ quantity: existing.quantity + addQty, last_synced_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) errors.push(s.store_name);
      } else {
        const { error } = await supabase.from('inventory')
          .insert({ product_id: restockProduct.id, store_id: s.store_id, quantity: addQty });
        if (error) errors.push(s.store_name);
      }
    }
    await supabase.from('audit_log').insert({
      user_id: profile?.id, user_email: profile?.email,
      action: 'REPOSICION_STOCK', entity_type: 'PRODUCT', entity_id: restockProduct.id,
      description: `Reposición de stock para ${restockProduct.name}: ${toUpdate.map(s => `${s.store_name}+${s.add}`).join(', ')}`,
    });
    if (errors.length > 0) {
      setRestockMsg({ type: 'error', text: `Error en: ${errors.join(', ')}` });
    } else {
      setRestockMsg({ type: 'ok', text: '✅ Stock repuesto correctamente' });
      setTimeout(() => { setRestockProduct(null); }, 1500);
    }
    setRestockSaving(false);
  };

  const openEdit = (p: any) => {
    setForm({
      sku_code: p.sku_code, name: p.name, description: p.description || '',
      category: p.category, price: String(p.price), initial_stock: '0',
      min_stock_alert: String(p.min_stock_alert ?? 5), max_discount: String(p.max_discount ?? 0),
    });
    setEditId(p.id); setShowForm(true); setMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku_code.trim() || !form.name.trim() || !form.category || !form.price) {
      setMsg({ type: 'error', text: 'Completa todos los campos obligatorios.' }); return;
    }
    setSaving(true); setMsg(null);
    const payload = {
      sku_code: form.sku_code.trim().toUpperCase(), name: form.name.trim(),
      description: form.description.trim() || null, category: form.category,
      price: parseFloat(form.price) || 0,
      min_stock_alert: parseInt(form.min_stock_alert) || 0,
      max_discount: parseFloat(form.max_discount) || 0,
    };
    if (editId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editId);
      if (error) { setMsg({ type: 'error', text: error.message }); setSaving(false); return; }
      setMsg({ type: 'ok', text: '✅ Producto actualizado' });
    } else {
      const { data: newProd, error } = await supabase.from('products').insert({ ...payload, active: true }).select().single();
      if (error) { setMsg({ type: 'error', text: error.message }); setSaving(false); return; }
      const initStock = parseInt(form.initial_stock) || 0;
      if (initStock > 0) {
        const { data: stores } = await supabase.from('stores').select('id').eq('active', true);
        if (stores && stores.length > 0) {
          await supabase.from('inventory').insert(stores.map((s: any) => ({ product_id: newProd.id, store_id: s.id, quantity: initStock })));
        }
      }
      await supabase.from('audit_log').insert({
        user_id: profile?.id, user_email: profile?.email,
        action: 'PRODUCTO_CREADO', entity_type: 'PRODUCT', entity_id: newProd.id,
        description: `Nuevo producto: ${newProd.name} (${newProd.sku_code})`,
      });
      setMsg({ type: 'ok', text: '✅ Producto creado correctamente' });
    }
    setSaving(false);
    fetchProducts();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Desactivar "${name}"?`)) return;
    setDeleteLoading(id);
    await supabase.from('products').update({ active: false }).eq('id', id);
    await supabase.from('audit_log').insert({
      user_id: profile?.id, user_email: profile?.email,
      action: 'PRODUCTO_DESACTIVADO', entity_type: 'PRODUCT', entity_id: id,
      description: `Producto desactivado: ${name}`,
    });
    setDeleteLoading(null);
    fetchProducts();
  };

  const addCatalogOption = async (type: string, label: string, extra?: Partial<CatalogOption>) => {
    await supabase.from('catalog_options').insert({ type, label, color: extra?.color || 'gray', value: label.toUpperCase().replace(/\s+/g, '_') });
    fetchCatalog();
  };
  const removeCatalogOption = async (id: string) => {
    await supabase.from('catalog_options').delete().eq('id', id);
    fetchCatalog();
  };
  const editCatalogOption = async (id: string, label: string) => {
    await supabase.from('catalog_options').update({ label, value: label.toUpperCase().replace(/\s+/g, '_') }).eq('id', id);
    fetchCatalog();
  };

  const getCatStyle = (catValue: string) => categories.find(c => c.value === catValue) || { color: 'gray', label: catValue };

  // ── Inventory functions ────────────────────────────────────────────────────
  const loadInventory = async () => {
    setInvLoading(true);
    const [storesRes, invRes, alertRes] = await Promise.all([
      supabase.from('stores').select('*').eq('active', true).order('name'),
      supabase.from('inventory').select('*'),
      supabase.from('store_alert_config').select('*'),
    ]);
    const storeList = storesRes.data || [];
    setInvStores(storeList);
    setInvInventory(invRes.data || []);
    const cfgMap: Record<string, any> = {};
    (alertRes.data || []).forEach((c: any) => { cfgMap[c.store_id] = c; });
    setInvAlertConfigs(cfgMap);
    if (storeList.length > 0 && !invSelectedStore) setInvSelectedStore(storeList[0].id);
    setInvLoading(false);
    setInvLoaded(true);
  };

  const invStoreData = invInventory.filter(i => i.store_id === invSelectedStore);
  const getInvQty = (productId: string) => invStoreData.find(i => i.product_id === productId)?.quantity ?? 0;
  const getInvRecordId = (productId: string) => invStoreData.find(i => i.product_id === productId)?.id;
  const storeInvCfg = invAlertConfigs[invSelectedStore];

  const handleInvEdit = (productId: string, qty: number) => { setInvEditingItem(productId); setInvEditQty(String(qty)); };

  const handleSaveInvQty = async (productId: string) => {
    setInvSaving(true);
    const newQty = parseInt(invEditQty) || 0;
    const invId = getInvRecordId(productId);
    if (invId) {
      await supabase.from('inventory').update({ quantity: newQty, last_synced_at: new Date().toISOString() }).eq('id', invId);
    } else {
      await supabase.from('inventory').insert({ product_id: productId, store_id: invSelectedStore, quantity: newQty });
    }
    await supabase.from('audit_log').insert({
      user_id: profile?.id, user_email: profile?.email,
      action: 'INVENTARIO_EDITADO', entity_type: 'INVENTORY', entity_id: productId,
      description: `Stock actualizado a ${newQty} uds en tienda ${invStores.find(s => s.id === invSelectedStore)?.name}`,
    });
    setInvEditingItem(null);
    setInvSaving(false);
    loadInventory();
  };

  const handleInvSync = async () => {
    setInvSyncLoading(true); setInvMsg(null);
    await supabase.from('sync_logs').insert({
      store_id: invSelectedStore, status: 'SUCCESS', triggered_by: profile?.email,
      started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
      notes: 'Sincronización manual desde panel admin',
    });
    setInvMsg({ type: 'ok', text: '✅ Sincronización registrada correctamente' });
    setTimeout(() => setInvMsg(null), 3000);
    setInvSyncLoading(false);
  };

  const openAlertConfig = (storeId: string, storeName: string) => {
    const cfg = invAlertConfigs[storeId];
    setAlertEnabled(cfg?.alerts_enabled ?? false);
    setAlertThreshold(cfg?.low_stock_threshold ?? 10);
    setAlertModal({ storeId, storeName });
  };

  const saveAlertConfig = async () => {
    if (!alertModal) return;
    setAlertSaving(true);
    const existing = invAlertConfigs[alertModal.storeId];
    if (existing) {
      await supabase.from('store_alert_config').update({ alerts_enabled: alertEnabled, low_stock_threshold: alertThreshold, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('store_alert_config').insert({ store_id: alertModal.storeId, alerts_enabled: alertEnabled, low_stock_threshold: alertThreshold });
    }
    setAlertModal(null); setAlertSaving(false);
    loadInventory();
  };

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Productos</h1>
          <p className="page-subtitle">Catálogo de productos e inventario por tienda</p>
        </div>
        {tab === 'catalog' && (
          <button id="btn-add-product" onClick={openCreate} className="btn btn-primary">
            <Plus size={16} /> Nuevo Producto
          </button>
        )}
        {tab === 'inventory' && invSelectedStore && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => openAlertConfig(invSelectedStore, invStores.find(s => s.id === invSelectedStore)?.name)} className="btn btn-secondary">
              <Settings2 size={15} /> Configurar Alerta
            </button>
            <button onClick={handleInvSync} disabled={invSyncLoading} className="btn btn-primary">
              <RefreshCw size={15} style={{ animation: invSyncLoading ? 'spin 0.7s linear infinite' : 'none' }} />
              {invSyncLoading ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0' }}>
        {([
          { id: 'catalog', label: '📦 Catálogo', icon: Package },
          { id: 'inventory', label: '🏪 Inventario', icon: Warehouse },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            style={{
              padding: '0.625rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600,
              color: tab === t.id ? 'var(--color-brand-400)' : 'var(--color-text-muted)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--color-brand-400)' : 'transparent'}`,
              marginBottom: -1, transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════ CATALOG TAB ══════════════ */}
      {tab === 'catalog' && (
        <>
          {/* Product form modal */}
          {showForm && (
            <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div className="card modal-content fade-in" style={{ width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontWeight: 700, fontSize: '1.125rem' }}>{editId ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                  <button onClick={() => setShowForm(false)} className="btn btn-ghost btn-icon"><X size={18} /></button>
                </div>

                {msg && (
                  <div className={`alert ${msg.type === 'ok' ? 'alert-success' : 'alert-error'} fade-in`} style={{ marginBottom: '1rem' }}>
                    {msg.type === 'error' ? <AlertCircle size={15} /> : <Check size={15} />} {msg.text}
                  </div>
                )}

                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-grid-2">
                    <div>
                      <label className="label" htmlFor="sku-code">Código SKU *</label>
                      <input id="sku-code" className="input" required value={form.sku_code} onChange={e => setForm(f => ({ ...f, sku_code: e.target.value }))} placeholder="MONT-001" />
                    </div>
                    <div>
                      <label className="label" htmlFor="prod-name">Nombre *</label>
                      <input id="prod-name" className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Montura Ray-Ban..." />
                    </div>
                    <div>
                      <label className="label" htmlFor="prod-cat">Categoría *</label>
                      <select id="prod-cat" className="input" required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                        <option value="">-- Seleccionar --</option>
                        {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="prod-price">Precio (Bs.) *</label>
                      <input id="prod-price" className="input" type="number" min="0" step="0.01" required value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
                    </div>
                    {!editId && (
                      <div>
                        <label className="label" htmlFor="init-stock">Stock Inicial</label>
                        <input id="init-stock" className="input" type="number" min="0" value={form.initial_stock} onChange={e => setForm(f => ({ ...f, initial_stock: e.target.value }))} />
                      </div>
                    )}
                    <div>
                      <label className="label" htmlFor="max-disc">Descuento Máximo (Bs.)</label>
                      <input id="max-disc" className="input" type="number" min="0" step="0.01" value={form.max_discount} onChange={e => setForm(f => ({ ...f, max_discount: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="label" htmlFor="min-stock">Alerta Stock Mínimo (uds)</label>
                      <input id="min-stock" className="input" type="number" min="0" value={form.min_stock_alert} onChange={e => setForm(f => ({ ...f, min_stock_alert: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="prod-desc">Descripción</label>
                    <textarea id="prod-desc" className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción opcional..." style={{ resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancelar</button>
                    <button id="btn-save-product" type="submit" disabled={saving} className="btn btn-primary">
                      {saving ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Guardando...</> : <><Check size={16} /> {editId ? 'Guardar Cambios' : 'Crear Producto'}</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Search & filter */}
          <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input className="input" style={{ paddingLeft: '2.375rem' }} placeholder="Buscar por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input" style={{ flex: '0 0 180px' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="ALL">Todas las categorías</option>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Product table */}
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                    {search || filterCat !== 'ALL' ? 'Sin resultados con los filtros actuales' : 'No hay productos. Crea el primero.'}
                  </td></tr>
                ) : filtered.map(p => {
                  const cat = getCatStyle(p.category);
                  return (
                    <tr key={p.id}>
                      <td><span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-brand-400)' }}>{p.sku_code}</span></td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        {p.description && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{p.description}</div>}
                      </td>
                      <td><span className={`badge badge-${cat.color}`}>{cat.label}</span></td>
                      <td style={{ fontWeight: 700, color: 'var(--color-brand-400)' }}>{fmt(p.price)}</td>
                      <td><span className={`badge ${p.active ? 'badge-green' : 'badge-red'}`}>{p.active ? 'Activo' : 'Inactivo'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => openEdit(p)} className="btn btn-ghost btn-sm btn-icon" title="Editar"><Edit2 size={14} /></button>
                          {p.active && (
                            <button onClick={() => openRestock(p)} className="btn btn-secondary btn-sm btn-icon" title="Reponer stock"><PackagePlus size={14} /></button>
                          )}
                          {p.active && (
                            <button onClick={() => handleDelete(p.id, p.name)} disabled={deleteLoading === p.id} className="btn btn-danger btn-sm btn-icon" title="Desactivar">
                              {deleteLoading === p.id ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Trash2 size={14} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary by category */}
          {!loading && products.length > 0 && (
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {categories.map(cat => {
                const count = products.filter(p => p.category === cat.value && p.active).length;
                return (
                  <div key={cat.value} className="card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 150px' }}>
                    <div className={`icon-box icon-box-${cat.color}`} style={{ width: 32, height: 32 }}><Package size={14} /></div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{count}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{cat.label}s activos</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Catalog Manager ── */}
          <div className="card fade-in" style={{ marginTop: '2rem', padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => setShowCatalog(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div className="icon-box icon-box-purple" style={{ width: 32, height: 32 }}><Settings2 size={14} /></div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>⚙️ Gestionar Catálogo</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Categorías de producto, tipos de armazón y cristal</div>
                </div>
              </div>
              {showCatalog ? <ChevronUp size={18} color="var(--color-text-muted)" /> : <ChevronDown size={18} color="var(--color-text-muted)" />}
            </button>

            {showCatalog && (
              <div className="fade-in" style={{ padding: '0 1.5rem 1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <CatalogSection
                    title="Categorías de Producto"
                    color="teal"
                    options={categories}
                    onAdd={(label, extra) => addCatalogOption('PRODUCT_CATEGORY', label, extra)}
                    onRemove={removeCatalogOption}
                    onEdit={editCatalogOption}
                  />
                  <CatalogSection
                    title="Tipos de Armazón"
                    color="blue"
                    options={frameTypes}
                    onAdd={(label) => addCatalogOption('FRAME_TYPE', label)}
                    onRemove={removeCatalogOption}
                    onEdit={editCatalogOption}
                  />
                  <CatalogSection
                    title="Tipos de Cristal"
                    color="purple"
                    options={crystalTypes}
                    onAdd={(label) => addCatalogOption('CRYSTAL_TYPE', label)}
                    onRemove={removeCatalogOption}
                    onEdit={editCatalogOption}
                  />
                </div>
              </div>
            )}

            {/* ── Replenishment Modal ─────────────────────────────── */}
            {restockProduct && (
              <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                <div className="card modal-content fade-in" style={{ width: '100%', maxWidth: 460 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div>
                      <h2 style={{ fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <PackagePlus size={18} style={{ color: 'var(--color-brand-400)' }} /> Reponer Stock
                      </h2>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {restockProduct.name} <span style={{ fontFamily: 'monospace', color: 'var(--color-brand-400)' }}>({restockProduct.sku_code})</span>
                      </p>
                    </div>
                    <button onClick={() => setRestockProduct(null)} className="btn btn-ghost btn-icon"><X size={18} /></button>
                  </div>

                  {restockMsg && (
                    <div className={`alert ${restockMsg.type === 'ok' ? 'alert-success' : 'alert-error'} fade-in`} style={{ marginBottom: '1rem' }}>
                      {restockMsg.type === 'ok' ? <Check size={15} /> : <AlertCircle size={15} />} {restockMsg.text}
                    </div>
                  )}

                  {storeInventory.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem' }}>Cargando tiendas...</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      {storeInventory.map((s, idx) => (
                        <div key={s.store_id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 110px', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', background: 'var(--color-bg-input)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.store_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              Stock actual: <strong style={{ color: s.current === 0 ? '#ef4444' : s.current <= 5 ? '#f59e0b' : 'var(--color-brand-400)' }}>{s.current}</strong>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>+ unidades</span>
                          <input
                            className="input" type="number" min="0" step="1" placeholder="0" value={s.add}
                            onChange={e => setStoreInventory(prev => prev.map((si, i) => i === idx ? { ...si, add: e.target.value } : si))}
                            style={{ textAlign: 'center' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => setRestockProduct(null)} className="btn btn-secondary">Cancelar</button>
                    <button onClick={handleRestock} disabled={restockSaving} className="btn btn-primary">
                      {restockSaving
                        ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Guardando...</>
                        : <><PackagePlus size={15} /> Reponer Stock</>}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════ INVENTORY TAB ══════════════ */}
      {tab === 'inventory' && (
        <>
          {invMsg && <div className={`alert ${invMsg.type === 'ok' ? 'alert-success' : 'alert-error'} fade-in`} style={{ marginBottom: '1.5rem' }}>{invMsg.text}</div>}

          {/* Store selector */}
          <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {invStores.map(s => (
                <button
                  key={s.id}
                  onClick={() => setInvSelectedStore(s.id)}
                  className={`btn btn-sm ${invSelectedStore === s.id ? 'btn-primary' : 'btn-secondary'}`}
                >
                  🏪 {s.name}
                </button>
              ))}
            </div>
            {invSelectedStore && storeInvCfg && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`badge ${storeInvCfg.alerts_enabled ? 'badge-yellow' : 'badge-gray'}`}>
                  <AlertTriangle size={10} />
                  {storeInvCfg.alerts_enabled ? `Alerta: ≤${storeInvCfg.low_stock_threshold} uds` : 'Alertas desactivadas'}
                </span>
              </div>
            )}
          </div>

          {/* Inventory table */}
          {invLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><div className="spinner spinner-lg" /></div>
          ) : !invSelectedStore ? (
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
                  ) : products.filter(p => p.active).map(p => {
                    const qty = getInvQty(p.id);
                    const isLow = storeInvCfg?.alerts_enabled && qty <= storeInvCfg.low_stock_threshold;
                    const isEditing = invEditingItem === p.id;
                    const cat = getCatStyle(p.category);
                    return (
                      <tr key={p.id} style={{ background: isLow ? 'rgba(245,158,11,0.04)' : undefined }}>
                        <td><span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-brand-400)' }}>{p.sku_code}</span></td>
                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                        <td><span className={`badge badge-${cat.color}`}>{cat.label}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          {isEditing ? (
                            <input
                              type="number" min="0" value={invEditQty}
                              onChange={e => setInvEditQty(e.target.value)}
                              autoFocus
                              style={{ width: 80, textAlign: 'center', background: 'var(--color-bg-input)', border: '1px solid var(--color-brand-600)', borderRadius: 8, color: 'var(--color-text-primary)', padding: '0.25rem 0.5rem', fontFamily: 'inherit' }}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveInvQty(p.id); if (e.key === 'Escape') setInvEditingItem(null); }}
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
                                <button onClick={() => handleSaveInvQty(p.id)} disabled={invSaving} className="btn btn-success btn-sm btn-icon">
                                  {invSaving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Check size={14} />}
                                </button>
                                <button onClick={() => setInvEditingItem(null)} className="btn btn-ghost btn-sm btn-icon"><X size={14} /></button>
                              </>
                            ) : (
                              <button onClick={() => handleInvEdit(p.id, qty)} className="btn btn-ghost btn-sm btn-icon" title="Editar stock"><Edit2 size={14} /></button>
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
                  <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>🔔 Advertencia de Insuficiencia</h2>
                  <button onClick={() => setAlertModal(null)} className="btn btn-ghost btn-icon"><X size={18} /></button>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                  Tienda: <strong style={{ color: 'var(--color-text-primary)' }}>{alertModal.storeName}</strong>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', cursor: 'pointer' }}>
                    <div
                      onClick={() => setAlertEnabled(v => !v)}
                      style={{ width: 44, height: 24, borderRadius: 12, background: alertEnabled ? 'var(--color-brand-600)' : 'var(--color-border)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <div style={{ position: 'absolute', top: 2, left: alertEnabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {alertEnabled ? 'Alertas activadas' : 'Alertas desactivadas'}
                    </span>
                  </label>
                  {alertEnabled && (
                    <div className="fade-in">
                      <label className="label">Advertir cuando queden (unidades)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input type="range" min="1" max="100" value={alertThreshold} onChange={e => setAlertThreshold(parseInt(e.target.value))} style={{ flex: 1, accentColor: 'var(--color-brand-500)' }} />
                        <select className="input input-sm" value={alertThreshold} onChange={e => setAlertThreshold(parseInt(e.target.value))} style={{ width: 80 }}>
                          {Array.from({ length: 100 }, (_, i) => i + 1).map(n => (<option key={n} value={n}>{n}</option>))}
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
        </>
      )}
    </div>
  );
}
