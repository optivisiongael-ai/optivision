import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import { fetchCatalogByTypes } from '../lib/useCatalog';
import type { CatalogOption } from '../lib/useCatalog';
import {
  Plus, Search, Package, Edit2, Trash2, X, Check,
  AlertCircle, ChevronDown, ChevronUp, Settings2, PackagePlus,
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
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="Nueva opción..."
          onKeyDown={e => { if (e.key === 'Enter' && newLabel.trim()) { onAdd(newLabel.trim(), isCategory ? { color: newColor } : {}); setNewLabel(''); } }}
        />
        {isCategory && (
          <select className="input input-sm" style={{ width: 80, fontSize: '0.75rem' }} value={newColor} onChange={e => setNewColor(e.target.value)}>
            {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button
          onClick={() => { if (newLabel.trim()) { onAdd(newLabel.trim(), isCategory ? { color: newColor } : {}); setNewLabel(''); } }}
          className="btn btn-primary btn-sm btn-icon"
          disabled={!newLabel.trim()}
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Main Products Component ───────────────────────────────────────────────────
export default function Products() {
  const { profile } = useAuth();
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

  useEffect(() => { fetchProducts(); fetchCatalog(); }, []);

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
    // Load stores + current inventory for this product
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
      const qty = parseInt(s.add);
      const newQty = s.current + qty;
      const { error } = await supabase.from('inventory')
        .upsert({ product_id: restockProduct.id, store_id: s.store_id, quantity: newQty }, { onConflict: 'product_id,store_id' });
      if (error) { errors.push(s.store_name); continue; }
      await supabase.from('audit_log').insert({
        user_id: profile?.id, user_email: profile?.email,
        action: 'STOCK_REPLENISHMENT',
        entity_type: 'PRODUCT', entity_id: restockProduct.id,
        description: `Reabastecimiento: ${restockProduct.name} (${restockProduct.sku_code}) — Tienda: ${s.store_name} +${qty} unidades (${s.current} → ${newQty})`,
      });
    }

    if (errors.length > 0) {
      setRestockMsg({ type: 'error', text: `Error en tiendas: ${errors.join(', ')}` });
    } else {
      setRestockMsg({ type: 'ok', text: '✅ Stock actualizado correctamente' });
      setTimeout(() => { setRestockProduct(null); setRestockMsg(null); }, 1200);
    }
    setRestockSaving(false);
  };

  const openEdit = (p: any) => {
    setForm({ sku_code: p.sku_code, name: p.name, description: p.description || '', category: p.category, price: String(p.price), initial_stock: '0', min_stock_alert: String(p.min_stock_alert ?? 5), max_discount: String(p.max_discount ?? 0) });
    setEditId(p.id); setShowForm(true); setMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    const payload = {
      sku_code: form.sku_code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      price: parseFloat(form.price) || 0,
      max_discount: parseFloat(form.max_discount) || 0,
      min_stock_alert: parseInt(form.min_stock_alert) || 5,
      active: true,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from('products').update(payload).eq('id', editId));
      if (!error) {
        await supabase.from('audit_log').insert({ user_id: profile?.id, user_email: profile?.email, action: 'SKU_EDITADO', entity_type: 'PRODUCT', entity_id: editId, description: `Editado: ${payload.name}` });
      }
    } else {
      const res = await supabase.from('products').insert(payload).select().single();
      error = res.error;
      if (!error && res.data) {
        const initialQty = parseInt(form.initial_stock) || 0;
        if (initialQty > 0) {
          const { data: stores } = await supabase.from('stores').select('id');
          if (stores && stores.length > 0) {
            await supabase.from('inventory').upsert(
              stores.map((s: any) => ({ product_id: res.data.id, store_id: s.id, quantity: initialQty })),
              { onConflict: 'product_id,store_id' }
            );
          }
        }
        await supabase.from('audit_log').insert({ user_id: profile?.id, user_email: profile?.email, action: 'SKU_CREADO', entity_type: 'PRODUCT', entity_id: res.data.id, description: `Creado: ${payload.name} (${payload.sku_code}) stock inicial: ${form.initial_stock}` });
      }
    }

    if (error) { setMsg({ type: 'error', text: error.message }); }
    else { setMsg({ type: 'ok', text: editId ? '✅ Producto actualizado' : '✅ Producto creado' }); fetchProducts(); setTimeout(() => { setShowForm(false); setMsg(null); }, 1200); }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Desactivar "${name}"?`)) return;
    setDeleteLoading(id);
    const { error } = await supabase.from('products').update({ active: false }).eq('id', id);
    if (!error) { await supabase.from('audit_log').insert({ user_id: profile?.id, user_email: profile?.email, action: 'SKU_BORRADO', entity_type: 'PRODUCT', entity_id: id, description: `Desactivado: ${name}` }); fetchProducts(); }
    setDeleteLoading(null);
  };

  // ── Catalog CRUD ──────────────────────────────────────────────
  const addCatalogOption = async (type: string, label: string, extra?: Partial<CatalogOption>) => {
    const value = label.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    const maxOrder = Math.max(0, ...(type === 'PRODUCT_CATEGORY' ? categories : type === 'FRAME_TYPE' ? frameTypes : crystalTypes).map(o => o.sort_order));
    await supabase.from('catalog_options').insert({ type, value, label, sort_order: maxOrder + 1, color: extra?.color || 'gray', active: true });
    fetchCatalog();
  };

  const removeCatalogOption = async (id: string) => {
    if (!confirm('¿Eliminar esta opción del catálogo?')) return;
    await supabase.from('catalog_options').update({ active: false }).eq('id', id);
    fetchCatalog();
  };

  const editCatalogOption = async (id: string, label: string) => {
    await supabase.from('catalog_options').update({ label }).eq('id', id);
    fetchCatalog();
  };

  const getCatStyle = (catValue: string) => categories.find(c => c.value === catValue) || { color: 'gray', label: catValue };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Productos / SKUs</h1>
          <p className="page-subtitle">Gestiona el catálogo de lentes, monturas, materiales y accesorios</p>
        </div>
        <button id="btn-add-product" onClick={openCreate} className="btn btn-primary">
          <Plus size={16} /> Nuevo Producto
        </button>
      </div>

      {/* Form modal */}
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
                  <input id="sku-code" className="input" required value={form.sku_code} onChange={e => setForm(f => ({ ...f, sku_code: e.target.value }))} placeholder="LNT-001" />
                </div>
                <div>
                  <label className="label" htmlFor="sku-cat">Categoría *</label>
                  <select id="sku-cat" className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {categories.length === 0 && <option value="">Sin categorías</option>}
                    {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="sku-name">Nombre del Producto *</label>
                <input id="sku-name" className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Lente Antirreflejo UV400" />
              </div>
              <div>
                <label className="label" htmlFor="sku-desc">Descripción</label>
                <textarea id="sku-desc" className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción opcional..." style={{ resize: 'vertical' }} />
              </div>
              <div>
                <label className="label" htmlFor="sku-price">Precio (Bs.) *</label>
                <input id="sku-price" className="input" required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="form-grid-3">
                <div>
                  <label className="label" htmlFor="sku-initial-stock">Stock Inicial</label>
                  <input id="sku-initial-stock" className="input" type="number" min="0" step="1" value={form.initial_stock} onChange={e => setForm(f => ({ ...f, initial_stock: e.target.value }))} placeholder="0" disabled={!!editId} style={{ opacity: editId ? 0.5 : 1 }} />
                  {editId && <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Gestionar en Inventario</span>}
                </div>
                <div>
                  <label className="label" htmlFor="sku-min-alert">Alerta Stock Mín.</label>
                  <input id="sku-min-alert" className="input" type="number" min="1" step="1" value={form.min_stock_alert} onChange={e => setForm(f => ({ ...f, min_stock_alert: e.target.value }))} placeholder="5" />
                </div>
                <div>
                  <label className="label" htmlFor="sku-max-disc">Descuento Máx. (Bs.)</label>
                  <input id="sku-max-disc" className="input" type="number" min="0" step="0.01" value={form.max_discount} onChange={e => setForm(f => ({ ...f, max_discount: e.target.value }))} placeholder="0.00" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Guardando...</> : <><Check size={15} /> {editId ? 'Actualizar' : 'Crear Producto'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input className="input" placeholder="Buscar por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.25rem' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          <button onClick={() => setFilterCat('ALL')} className={`btn btn-sm ${filterCat === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}>Todos</button>
          {categories.map(c => (
            <button key={c.value} onClick={() => setFilterCat(c.value)} className={`btn btn-sm ${filterCat === c.value ? 'btn-primary' : 'btn-secondary'}`}>{c.label}</button>
          ))}
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{filtered.length} productos</span>
      </div>

      {/* Table */}
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
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={s.add}
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
    </div>
  );
}
