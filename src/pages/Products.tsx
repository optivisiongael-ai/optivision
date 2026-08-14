import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import { Plus, Search, Package, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';

type Category = 'LENTE' | 'MONTURA' | 'MATERIAL' | 'ACCESORIO';

const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: 'LENTE', label: 'Lente', color: 'teal' },
  { value: 'MONTURA', label: 'Montura', color: 'blue' },
  { value: 'MATERIAL', label: 'Material', color: 'purple' },
  { value: 'ACCESORIO', label: 'Accesorio', color: 'yellow' },
];

const fmt = (n: number) => `Bs. ${n.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;

const emptyForm = { sku_code: '', name: '', description: '', category: 'LENTE' as Category, price: '', initial_stock: '0', min_stock_alert: '5', max_discount: '0' };

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

  useEffect(() => { fetchProducts(); }, []);

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

  const openCreate = () => { setForm(emptyForm); setEditId(null); setShowForm(true); setMsg(null); };
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
        // Audit log
        await supabase.from('audit_log').insert({
          user_id: profile?.id, user_email: profile?.email,
          action: 'SKU_EDITADO', entity_type: 'PRODUCT', entity_id: editId,
          description: `Editado: ${payload.name}`,
        });
      }
    } else {
      const res = await supabase.from('products').insert(payload).select().single();
      error = res.error;
      if (!error && res.data) {
        // Set initial inventory for all stores if initial_stock > 0
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
        await supabase.from('audit_log').insert({
          user_id: profile?.id, user_email: profile?.email,
          action: 'SKU_CREADO', entity_type: 'PRODUCT', entity_id: res.data.id,
          description: `Creado: ${payload.name} (${payload.sku_code}) stock inicial: ${form.initial_stock}`,
        });
      }
    }

    if (error) { setMsg({ type: 'error', text: error.message }); }
    else { setMsg({ type: 'ok', text: editId ? '✅ Producto actualizado' : '✅ Producto creado' }); fetchProducts(); setTimeout(() => { setShowForm(false); setMsg(null); }, 1200); }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Desactivar el producto "${name}"? No se eliminará del historial.`)) return;
    setDeleteLoading(id);
    const { error } = await supabase.from('products').update({ active: false }).eq('id', id);
    if (!error) {
      await supabase.from('audit_log').insert({
        user_id: profile?.id, user_email: profile?.email,
        action: 'SKU_BORRADO', entity_type: 'PRODUCT', entity_id: id,
        description: `Desactivado: ${name}`,
      });
      fetchProducts();
    }
    setDeleteLoading(null);
  };

  const getCatStyle = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];

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
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: 520 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-text-primary)' }}>
                {editId ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button onClick={() => setShowForm(false)} className="btn btn-ghost btn-icon"><X size={18} /></button>
            </div>

            {msg && (
              <div className={`alert ${msg.type === 'ok' ? 'alert-success' : 'alert-error'} fade-in`} style={{ marginBottom: '1rem' }}>
                {msg.type === 'error' ? <AlertCircle size={15} /> : <Check size={15} />}
                {msg.text}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="label" htmlFor="sku-code">Código SKU *</label>
                  <input id="sku-code" className="input" required value={form.sku_code} onChange={e => setForm(f => ({ ...f, sku_code: e.target.value }))} placeholder="LNT-001" />
                </div>
                <div>
                  <label className="label" htmlFor="sku-cat">Categoría *</label>
                  <select id="sku-cat" className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="label" htmlFor="sku-initial-stock">Stock Inicial</label>
                  <input id="sku-initial-stock" className="input" type="number" min="0" step="1" value={form.initial_stock} onChange={e => setForm(f => ({ ...f, initial_stock: e.target.value }))} placeholder="0" disabled={!!editId} title={editId ? 'El stock se gestiona en Inventario' : ''} style={{ opacity: editId ? 0.5 : 1 }} />
                  {editId && <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Gestionar en Inventario</span>}
                </div>
                <div>
                  <label className="label" htmlFor="sku-min-alert">Alerta Stock Mínimo</label>
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
          {CATEGORIES.map(c => (
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
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          disabled={deleteLoading === p.id}
                          className="btn btn-danger btn-sm btn-icon" title="Desactivar"
                        >
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
          {CATEGORIES.map(cat => {
            const count = products.filter(p => p.category === cat.value && p.active).length;
            return (
              <div key={cat.value} className="card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 150px' }}>
                <div className={`icon-box icon-box-${cat.color}`} style={{ width: 32, height: 32 }}>
                  <Package size={14} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>{count}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{cat.label}s activos</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
