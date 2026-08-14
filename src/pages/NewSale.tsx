import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavGuard } from '../lib/navGuard';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import SearchableDropdown from '../components/shared/SearchableDropdown';
import { Search, UserPlus, ShoppingCart, ChevronRight, ChevronLeft,
  Plus, Minus, X, Check, AlertCircle, Link, Tag
} from 'lucide-react';
import { fetchCatalogByTypes } from '../lib/useCatalog';
import type { CatalogOption } from '../lib/useCatalog';
import { todayStr, TIME_SLOTS } from '../lib/dateUtils';

const fmt = (n: number) => `Bs. ${n.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;
const APP_URL = window.location.origin + window.location.pathname;

type SaleItem = {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  itemMaxDiscount: number; // from product.max_discount
  discountAmount: number;
  discountReason: string;
  subtotal: number; // (unitPrice - discountAmount) * quantity
};

const DISCOUNT_REASONS = ['Promoción', 'Cliente frecuente', 'Producto con detalle', 'Cortesía', 'Otro'];
const emptyMeasures = { od_sphere: '', od_cylinder: '', od_axis: '', od_add: '', oi_sphere: '', oi_cylinder: '', oi_axis: '', oi_add: '', dip: '' };
const emptyClient = { full_name: '', phone: '', email: '', ...emptyMeasures };
type Step = 'client' | 'products' | 'done';

export default function NewSale() {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('client');

  // Client
  const [clientSearch, setClientSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState(emptyClient);
  const [searchLoading, setSearchLoading] = useState(false);

  // Products — dynamic, keyed by category value
  const [productsByCategory, setProductsByCategory] = useState<Record<string, any[]>>({});
  const [categories, setCategories] = useState<CatalogOption[]>([]);
  const [selectedByCategory, setSelectedByCategory] = useState<Record<string, string>>({});
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [advancePayment, setAdvancePayment] = useState(0);
  const [notes, setNotes] = useState('');

  // Result
  const [saleId, setSaleId] = useState<string | null>(null);
  const [saleCode, setSaleCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [frameTypes, setFrameTypes] = useState<CatalogOption[]>([]);
  const [crystalTypes, setCrystalTypes] = useState<CatalogOption[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('id, name, sku_code, category, price, max_discount').eq('active', true).order('name'),
      fetchCatalogByTypes(['FRAME_TYPE', 'CRYSTAL_TYPE', 'PRODUCT_CATEGORY']),
    ]).then(([productsRes, cat]) => {
      const all = productsRes.data || [];
      const grouped: Record<string, any[]> = {};
      for (const p of all) {
        if (!grouped[p.category]) grouped[p.category] = [];
        grouped[p.category].push(p);
      }
      setProductsByCategory(grouped);
      setFrameTypes(cat.FRAME_TYPE || []);
      setCrystalTypes(cat.CRYSTAL_TYPE || []);
      setCategories(cat.PRODUCT_CATEGORY || []);
    });
  }, [profile?.id]);

  const { setGuard } = useNavGuard();
  const navigate = useNavigate();

  const handleFinalizar = useCallback(() => {
    setGuard(null);
    navigate('/ventas');
  }, [setGuard, navigate]);

  const handlePrintBoleta = useCallback(() => {
    if (!saleId) return;
    window.open(boletalink, '_blank');
  }, [saleId, boletalink]);

  // Register/clear nav guard when sale is in progress
  useEffect(() => {
    const active = step !== 'client' || saleItems.length > 0;
    setGuard(active ? 'Tienes una venta sin confirmar. Si navegas ahora perderás todo el progreso.' : null);
    return () => setGuard(null);
  }, [step, saleItems.length, setGuard]);

  // Guard: warn on unsaved sale in progress
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (step !== 'client' || saleItems.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [step, saleItems.length]);

  const searchClients = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    const { data } = await supabase.from('clients').select('id, client_code, full_name, phone, email, od_sphere, od_cylinder, od_axis, od_add, oi_sphere, oi_cylinder, oi_axis, oi_add, dip')
      .or(`full_name.ilike.%${q}%,client_code.ilike.%${q}%`).limit(8);
    setSearchResults(data || []);
    setSearchLoading(false);
  }, []);

  useEffect(() => { const t = setTimeout(() => searchClients(clientSearch), 300); return () => clearTimeout(t); }, [clientSearch, searchClients]);

  const selectClient = (c: any) => { setSelectedClient(c); setSearchResults([]); setClientSearch(''); setIsNewClient(false); };
  const startNewClient = () => { setSelectedClient(null); setIsNewClient(true); setNewClientForm(emptyClient); };

  const toProductStep = () => {
    if (!selectedClient && !isNewClient) { setError('Selecciona o crea un cliente'); return; }
    if (isNewClient && !newClientForm.full_name.trim()) { setError('El nombre del cliente es obligatorio'); return; }
    setError(null); setStep('products');
  };

  const addProduct = (productId: string, list: any[]) => {
    if (!productId) return;
    const prod = list.find((p: any) => p.id === productId);
    if (!prod) return;
    setSaleItems(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing) {
        return prev.map(i => i.productId === productId
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * (i.unitPrice - i.discountAmount) }
          : i);
      }
      return [...prev, { productId: prod.id, name: prod.name, category: prod.category, quantity: 1, unitPrice: prod.price, itemMaxDiscount: prod.max_discount ?? 0, discountAmount: 0, discountReason: '', subtotal: prod.price }];
    });
  };

  // When a product is selected from any category dropdown, add it to saleItems
  const handleCategorySelect = (catValue: string, productId: string) => {
    if (!productId) return;
    const list = productsByCategory[catValue] || [];
    addProduct(productId, list);
    setSelectedByCategory(prev => ({ ...prev, [catValue]: '' })); // reset after adding
  };

  const updateQty = (productId: string, delta: number) => {
    setSaleItems(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const newQty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: newQty, subtotal: newQty * (i.unitPrice - i.discountAmount) };
    }));
  };

  const updateItemDiscount = (productId: string, val: number) => {
    setSaleItems(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const cap = i.itemMaxDiscount > 0 ? Math.min(i.itemMaxDiscount, i.unitPrice) : i.unitPrice;
      const disc = Math.min(Math.max(0, val), cap);
      return { ...i, discountAmount: disc, subtotal: i.quantity * (i.unitPrice - disc) };
    }));
  };

  const updateItemDiscountReason = (productId: string, reason: string) => {
    setSaleItems(prev => prev.map(i => i.productId !== productId ? i : { ...i, discountReason: reason }));
  };

  const removeItem = (productId: string) => setSaleItems(prev => prev.filter(i => i.productId !== productId));

  const grossSubtotal = saleItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const totalDiscount = saleItems.reduce((s, i) => s + i.discountAmount * i.quantity, 0);
  const subtotal = saleItems.reduce((s, i) => s + i.subtotal, 0);
  const total = subtotal;
  const balance = Math.max(0, total - advancePayment);

  // Build category label map dynamically from catalog
  const categoryLabelMap = Object.fromEntries(categories.map(c => [c.value, c.label]));


  const handleConfirmSale = async () => {
    // Validate discounts with reasons
    const missingReason = saleItems.find(i => i.discountAmount > 0 && !i.discountReason);
    if (missingReason) { setError(`Ingresa el motivo del descuento para: ${missingReason.name}`); return; }

    setSaving(true); setError(null);
    try {
      let clientId = selectedClient?.id;
      if (isNewClient) {
        const clientCode = `OPT-${Date.now().toString().slice(-5)}`;
        const { data: newClient, error: ce } = await supabase.from('clients').insert({
          full_name: newClientForm.full_name.trim(),
          phone: (newClientForm as any).phone?.trim() || null,
          email: (newClientForm as any).email?.trim() || null,
          client_code: clientCode, created_by: profile?.id,
          // Lejos
          od_sphere: (newClientForm as any).od_sphere || null,
          od_cylinder: (newClientForm as any).od_cylinder || null,
          od_axis: (newClientForm as any).od_axis || null,
          od_add: (newClientForm as any).od_add || null,
          oi_sphere: (newClientForm as any).oi_sphere || null,
          oi_cylinder: (newClientForm as any).oi_cylinder || null,
          oi_axis: (newClientForm as any).oi_axis || null,
          oi_add: (newClientForm as any).oi_add || null,
          dip: (newClientForm as any).dip || null,
          dip_far: (newClientForm as any).dip_far || null,
          // Cerca
          od_sphere_near: (newClientForm as any).od_sphere_near || null,
          od_cyl_near: (newClientForm as any).od_cyl_near || null,
          od_axis_near: (newClientForm as any).od_axis_near || null,
          od_dip_near: (newClientForm as any).od_dip_near || null,
          oi_sphere_near: (newClientForm as any).oi_sphere_near || null,
          oi_cyl_near: (newClientForm as any).oi_cyl_near || null,
          oi_axis_near: (newClientForm as any).oi_axis_near || null,
          add_near: (newClientForm as any).add_near || null,
          // Extras
          frame_type: (newClientForm as any).frame_type || null,
          crystal_type: (newClientForm as any).crystal_type || null,
          age: (newClientForm as any).age || null,
          delivery_date: (newClientForm as any).delivery_date || null,
          delivery_time: (newClientForm as any).delivery_time || null,
          notes: (newClientForm as any).notes || null,
        }).select().single();
        if (ce) throw new Error(ce.message);
        clientId = newClient.id;
        await supabase.from('audit_log').insert({ user_id: profile?.id, user_email: profile?.email, action: 'CLIENTE_CREADO', entity_type: 'CLIENT', entity_id: clientId, description: `Nuevo cliente: ${newClientForm.full_name} (${clientCode})` });
      }

      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const seq = Date.now().toString().slice(-4);
      const saleCodeGen = `VNT-${yy}${mm}${dd}-${seq}`;
      const { data: newSale, error: se } = await supabase.from('sales').insert({
        sale_code: saleCodeGen, client_id: clientId, store_id: profile?.store_id, seller_id: profile?.id,
        subtotal: grossSubtotal, discount: totalDiscount, total, advance_payment: advancePayment, balance,
        status: balance === 0 ? 'COMPLETED' : 'PENDING',
        notes: notes.trim() || null,
      }).select().single();
      if (se) throw new Error(se.message);

      const itemsPayload = saleItems.map(i => ({
        sale_id: newSale.id, product_id: i.productId, quantity: i.quantity,
        unit_price: i.unitPrice, discount_amount: i.discountAmount,
        discount_reason: i.discountReason || null, subtotal: i.subtotal,
      }));
      const { error: ie } = await supabase.from('sale_items').insert(itemsPayload);
      if (ie) throw new Error(ie.message);

      await supabase.from('audit_log').insert({
        user_id: profile?.id, user_email: profile?.email,
        action: 'VENTA_CREADA', entity_type: 'SALE', entity_id: newSale.id,
        description: `Venta ${saleCodeGen} — Total: ${fmt(total)}${totalDiscount > 0 ? ` (Descuento: ${fmt(totalDiscount)})` : ''}`,
      });

      setSaleId(newSale.id);
      setSaleCode(saleCodeGen);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Error al registrar la venta');
    }
    setSaving(false);
  };

  const boletalink = saleId ? `${APP_URL}#/boleta/${saleId}` : '';

  const copyLink = () => {
    if (!boletalink) return;
    navigator.clipboard.writeText(boletalink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const resetForm = () => {
    setStep('client'); setSelectedClient(null); setIsNewClient(false);
    setNewClientForm(emptyClient); setSaleItems([]); setSelectedByCategory({});
    setAdvancePayment(0);
    setNotes(''); setSaleId(null); setSaleCode(null); setError(null); setCopied(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🛒 Nueva Venta</h1>
          <p className="page-subtitle">Registra una venta paso a paso</p>
        </div>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        {[
          { id: 'client', label: '1. Cliente', icon: '👤' },
          { id: 'products', label: '2. Productos', icon: '📦' },
          { id: 'done', label: '3. Confirmación', icon: '✅' },
        ].map((s, i, arr) => (
          <>
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', borderRadius: 99,
              background: step === s.id ? 'rgba(6,182,212,0.15)' : 'var(--color-bg-card)',
              border: `1px solid ${step === s.id ? 'rgba(6,182,212,0.4)' : 'var(--color-border)'}`,
              color: step === s.id ? 'var(--color-brand-400)' : 'var(--color-text-muted)',
              fontWeight: step === s.id ? 700 : 500, fontSize: '0.8125rem',
            }}>
              {s.icon} {s.label}
            </div>
            {i < arr.length - 1 && <ChevronRight size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
          </>
        ))}
      </div>

      {error && <div className="alert alert-error fade-in" style={{ marginBottom: '1.25rem' }}><AlertCircle size={15} />{error}</div>}

      {/* ── STEP 1: CLIENT ── */}
      {step === 'client' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!selectedClient && !isNewClient && (
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text-primary)' }}>🔍 Buscar Cliente</h3>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input className="input" placeholder="Nombre o código (OPT-XXXXX)..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} style={{ paddingLeft: '2.5rem' }} />
              </div>
              {searchLoading && <div className="spinner" style={{ margin: '1rem auto' }} />}
              {searchResults.length > 0 && (
                <div style={{ marginTop: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                  {searchResults.map(c => (
                    <button key={c.id} onClick={() => selectClient(c)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', fontFamily: 'inherit', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(6,182,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--color-brand-400)', flexShrink: 0 }}>
                        {c.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{c.full_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{c.client_code} {c.phone ? `· ${c.phone}` : ''}</div>
                      </div>
                      <ChevronRight size={15} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                  ))}
                </div>
              )}
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                <button onClick={startNewClient} className="btn btn-secondary" style={{ width: '100%' }}>
                  <UserPlus size={16} /> Registrar Nuevo Cliente
                </button>
              </div>
            </div>
          )}

          {selectedClient && (
            <div className="card fade-in" style={{ border: '1px solid rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, color: 'var(--color-brand-400)' }}>✅ Cliente Seleccionado</h3>
                <button onClick={() => { setSelectedClient(null); setClientSearch(''); }} className="btn btn-ghost btn-icon btn-sm"><X size={15} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.875rem' }}>
                <div><span style={{ color: 'var(--color-text-muted)' }}>Nombre: </span><strong>{selectedClient.full_name}</strong></div>
                <div><span style={{ color: 'var(--color-text-muted)' }}>Código: </span><span style={{ fontFamily: 'monospace', color: 'var(--color-brand-400)' }}>{selectedClient.client_code}</span></div>
                {selectedClient.phone && <div><span style={{ color: 'var(--color-text-muted)' }}>Tel: </span>{selectedClient.phone}</div>}
              </div>
            </div>
          )}

          {isNewClient && (
            <div className="card fade-in">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontWeight: 700 }}>👤 Nuevo Cliente</h3>
                <button onClick={() => setIsNewClient(false)} className="btn btn-ghost btn-icon btn-sm"><X size={15} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label className="label">Nombre Completo *</label><input className="input" required value={newClientForm.full_name} onChange={e => setNewClientForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Juan Pérez" /></div>
                  <div><label className="label">Teléfono</label><input className="input" value={newClientForm.phone} onChange={e => setNewClientForm(f => ({ ...f, phone: e.target.value }))} placeholder="+591 70000000" /></div>
                  <div><label className="label">Email</label><input className="input" type="email" value={newClientForm.email} onChange={e => setNewClientForm(f => ({ ...f, email: e.target.value }))} placeholder="cliente@email.com" /></div>
                </div>
                <div>
                  <p className="section-title" style={{ marginBottom: '0.875rem' }}>🔭 Medidas Ópticas (Opcional)</p>

                  {/* Info básica del paciente */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div><label className="label">Edad</label><input className="input input-sm" value={(newClientForm as any).age || ''} onChange={e => setNewClientForm(f => ({ ...f, age: e.target.value }))} placeholder="Ej: 35" /></div>
                    <div><label className="label">Armazón</label>
                      <select className="input input-sm" value={(newClientForm as any).frame_type || ''} onChange={e => setNewClientForm(f => ({ ...f, frame_type: e.target.value }))}>
                        <option value="">-- Seleccionar --</option>
                        {frameTypes.map(v => <option key={v.value} value={v.label}>{v.label}</option>)}
                      </select>
                    </div>
                    <div><label className="label">Tipo de Cristal</label>
                      <select className="input input-sm" value={(newClientForm as any).crystal_type || ''} onChange={e => setNewClientForm(f => ({ ...f, crystal_type: e.target.value }))}>
                        <option value="">-- Seleccionar --</option>
                        {crystalTypes.map(v => <option key={v.value} value={v.label}>{v.label}</option>)}
                      </select>
                    </div>
                    <div><label className="label">Entrega</label><input className="input input-sm" type="date" min={todayStr()} value={(newClientForm as any).delivery_date || ''} onChange={e => setNewClientForm(f => ({ ...f, delivery_date: e.target.value }))} /></div>
                    <div><label className="label">Hora Entrega</label>
                      <select className="input input-sm" value={(newClientForm as any).delivery_time || ''} onChange={e => setNewClientForm(f => ({ ...f, delivery_time: e.target.value }))}>
                        <option value="">-- Hora --</option>
                        {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* LEJOS */}
                  <div style={{ background: 'var(--color-bg-input)', borderRadius: 10, padding: '0.875rem', marginBottom: '0.75rem', border: '1px solid var(--color-border)' }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-brand-400)', marginBottom: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📏 Lejos</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}></span>
                      {['Esfera', 'Cilindro', 'Eje', 'DIP'].map(h => <span key={h} style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>{h}</span>)}
                    </div>
                    {[['O.D.', 'od_sphere', 'od_cylinder', 'od_axis', 'dip_far'], ['O.I.', 'oi_sphere', 'oi_cylinder', 'oi_axis', '']].map(([label, s, c, a, d]) => (
                      <div key={label} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'center', marginBottom: '0.375rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</span>
                        <input className="input input-sm" value={(newClientForm as any)[s] || ''} onChange={e => setNewClientForm(f => ({ ...f, [s]: e.target.value }))} placeholder="+0.00" style={{ textAlign: 'center' }} />
                        <input className="input input-sm" value={(newClientForm as any)[c] || ''} onChange={e => setNewClientForm(f => ({ ...f, [c]: e.target.value }))} placeholder="+0.00" style={{ textAlign: 'center' }} />
                        <input className="input input-sm" value={(newClientForm as any)[a] || ''} onChange={e => setNewClientForm(f => ({ ...f, [a]: e.target.value }))} placeholder="0°" style={{ textAlign: 'center' }} />
                        {d ? <input className="input input-sm" value={(newClientForm as any)[d] || ''} onChange={e => setNewClientForm(f => ({ ...f, [d]: e.target.value }))} placeholder="0" style={{ textAlign: 'center' }} /> : <span />}
                      </div>
                    ))}
                  </div>

                  {/* CERCA */}
                  <div style={{ background: 'var(--color-bg-input)', borderRadius: 10, padding: '0.875rem', marginBottom: '0.75rem', border: '1px solid var(--color-border)' }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#a78bfa', marginBottom: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔍 Cerca</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span />
                      {['Esfera', 'Cilindro', 'Eje', 'DIP'].map(h => <span key={h} style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>{h}</span>)}
                    </div>
                    {[['O.D.', 'od_sphere_near', 'od_cyl_near', 'od_axis_near', 'od_dip_near'], ['O.I.', 'oi_sphere_near', 'oi_cyl_near', 'oi_axis_near', '']].map(([label, s, c, a, d]) => (
                      <div key={label} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'center', marginBottom: '0.375rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</span>
                        <input className="input input-sm" value={(newClientForm as any)[s] || ''} onChange={e => setNewClientForm(f => ({ ...f, [s]: e.target.value }))} placeholder="+0.00" style={{ textAlign: 'center' }} />
                        <input className="input input-sm" value={(newClientForm as any)[c] || ''} onChange={e => setNewClientForm(f => ({ ...f, [c]: e.target.value }))} placeholder="+0.00" style={{ textAlign: 'center' }} />
                        <input className="input input-sm" value={(newClientForm as any)[a] || ''} onChange={e => setNewClientForm(f => ({ ...f, [a]: e.target.value }))} placeholder="0°" style={{ textAlign: 'center' }} />
                        {d ? <input className="input input-sm" value={(newClientForm as any)[d] || ''} onChange={e => setNewClientForm(f => ({ ...f, [d]: e.target.value }))} placeholder="0" style={{ textAlign: 'center' }} /> : <span />}
                      </div>
                    ))}
                  </div>

                  {/* ADD+ y Observaciones */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                    <div>
                      <label className="label">ADD+ (Adición)</label>
                      <input className="input input-sm" value={(newClientForm as any).add_near || ''} onChange={e => setNewClientForm(f => ({ ...f, add_near: e.target.value }))} placeholder="+1.50" />
                    </div>
                    <div>
                      <label className="label">Observaciones</label>
                      <input className="input input-sm" value={(newClientForm as any).notes || ''} onChange={e => setNewClientForm(f => ({ ...f, notes: e.target.value }))} placeholder="Recomendaciones, alergias, notas..." />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={toProductStep} className="btn btn-primary btn-lg">
              Continuar con Productos <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: PRODUCTS ── */}
      {step === 'products' && (
        <div className="sale-grid fade-in">
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>📦 Selección de Productos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {categories.length === 0 && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem' }}>
                    ⚠️ Sin categorías configuradas. Ve a Productos → ⚙️ Gestionar Catálogo.
                  </p>
                )}
                {categories.map(cat => (
                  <SearchableDropdown
                    key={cat.value}
                    label={cat.label + 's'}
                    placeholder={`Seleccionar ${cat.label.toLowerCase()}...`}
                    options={(productsByCategory[cat.value] || []).map((p: any) => ({ id: p.id, label: p.name, sublabel: p.sku_code, price: p.price }))}
                    value={selectedByCategory[cat.value] || ''}
                    onChange={v => handleCategorySelect(cat.value, v)}
                  />
                ))}
              </div>
            </div>

            {/* Items list with per-item discounts */}
            {saleItems.length > 0 && (
              <div className="card fade-in">
                <h4 style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.9rem' }}>
                  Items seleccionados ({saleItems.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {saleItems.map(item => (
                    <div key={item.productId} style={{ padding: '0.875rem', background: 'var(--color-bg-input)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
                      {/* Item header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: item.discountAmount > 0 || true ? '0.625rem' : 0 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {categoryLabelMap[item.category] || item.category} · {fmt(item.unitPrice)}
                            {item.discountAmount > 0 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>− {fmt(item.discountAmount)}/u</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <button onClick={() => updateQty(item.productId, -1)} className="btn btn-ghost btn-icon btn-sm" disabled={item.quantity <= 1}><Minus size={12} /></button>
                          <span style={{ width: 24, textAlign: 'center', fontWeight: 700, fontSize: '0.875rem' }}>{item.quantity}</span>
                          <button onClick={() => updateQty(item.productId, 1)} className="btn btn-ghost btn-icon btn-sm"><Plus size={12} /></button>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--color-brand-400)', fontSize: '0.875rem', minWidth: 80, textAlign: 'right' }}>{fmt(item.subtotal)}</span>
                        <button onClick={() => removeItem(item.productId)} className="btn btn-danger btn-icon btn-sm"><X size={12} /></button>
                      </div>
                      {/* Discount row */}
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
                        <Tag size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                        <div style={{ position: 'relative', flex: '0 0 110px' }}>
                          <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--color-text-muted)', pointerEvents: 'none' }}>Bs.</span>
                          <input
                            type="number" min="0" max={item.itemMaxDiscount > 0 ? item.itemMaxDiscount : undefined} step="0.01"
                            value={item.discountAmount || ''}
                            onChange={e => updateItemDiscount(item.productId, parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="input input-sm"
                            style={{ paddingLeft: '2rem' }}
                            title={item.itemMaxDiscount > 0 ? `Máx. ${fmt(item.itemMaxDiscount)} por ítem` : 'Sin límite de descuento configurado'}
                          />
                        </div>
                        {item.discountAmount > 0 && (
                          <select
                            value={item.discountReason}
                            onChange={e => updateItemDiscountReason(item.productId, e.target.value)}
                            className="input input-sm"
                            style={{ flex: 1 }}
                          >
                            <option value="">— Motivo *</option>
                            {DISCOUNT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        )}
                        {item.discountAmount === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Descuento opcional{item.itemMaxDiscount > 0 ? ` (máx. ${fmt(item.itemMaxDiscount)})` : ''}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <label className="label" htmlFor="sale-notes">Notas de la Venta</label>
              <textarea id="sale-notes" className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones, instrucciones de entrega..." style={{ resize: 'vertical' }} />
            </div>
          </div>

          {/* Right: summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1rem' }}>
            <div className="card">
              <h4 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>💰 Resumen de Venta</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
                  <span style={{ fontWeight: 600 }}>{fmt(grossSubtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: '#f59e0b' }}>Descuentos aplicados</span>
                    <span style={{ fontWeight: 600, color: '#f59e0b' }}>− {fmt(totalDiscount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(6,182,212,0.08)', borderRadius: 10, border: '1px solid rgba(6,182,212,0.2)' }}>
                  <span style={{ fontWeight: 800 }}>TOTAL</span>
                  <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--color-brand-400)' }}>{fmt(total)}</span>
                </div>
                <div className="divider" style={{ margin: '0.25rem 0' }} />
                <div>
                  <label className="label" style={{ marginBottom: '0.375rem' }}>Adelanto Pagado (Bs.)</label>
                  <input className="input input-sm" type="number" min="0" step="0.01" max={total} value={advancePayment || ''} onChange={e => setAdvancePayment(parseFloat(e.target.value) || 0)} placeholder="0.00" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: balance > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)', borderRadius: 8, border: `1px solid ${balance > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
                  <span style={{ fontWeight: 700 }}>Saldo pendiente</span>
                  <span style={{ fontWeight: 700, color: balance > 0 ? '#fbbf24' : '#34d399' }}>{balance > 0 ? fmt(balance) : '✓ Pagado'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <button id="btn-confirm-sale" onClick={handleConfirmSale} disabled={saleItems.length === 0 || saving} className="btn btn-primary" style={{ width: '100%' }}>
                  {saving ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Registrando...</> : <><Check size={16} /> Confirmar Venta</>}
                </button>
                <button onClick={() => setStep('client')} className="btn btn-ghost" style={{ width: '100%' }}>
                  <ChevronLeft size={15} /> Volver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: DONE ── */}
      {step === 'done' && saleId && (
        <div className="fade-in" style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Success card */}
          <div className="card" style={{ textAlign: 'center', padding: '2.5rem 2rem', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '2rem' }}>✅</div>
            <h2 style={{ fontWeight: 800, fontSize: '1.375rem', marginBottom: '0.375rem' }}>¡Venta registrada!</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              Código: <code style={{ fontFamily: 'monospace', color: 'var(--color-brand-400)', fontWeight: 700 }}>{saleCode}</code>
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
              <span style={{ background: 'rgba(6,182,212,0.1)', padding: '0.25rem 0.75rem', borderRadius: 99, color: 'var(--color-brand-400)', fontWeight: 600 }}>Total: {fmt(total)}</span>
              {totalDiscount > 0 && <span style={{ background: 'rgba(245,158,11,0.1)', padding: '0.25rem 0.75rem', borderRadius: 99, color: '#f59e0b', fontWeight: 600 }}>Descuento: {fmt(totalDiscount)}</span>}
              {balance > 0 && <span style={{ background: 'rgba(239,68,68,0.1)', padding: '0.25rem 0.75rem', borderRadius: 99, color: '#ef4444', fontWeight: 600 }}>Saldo: {fmt(balance)}</span>}
            </div>
          </div>

          {/* Link card */}
          <div className="card">
            <h4 style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link size={16} /> Link de Boleta del Cliente
            </h4>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <input
                readOnly value={boletalink}
                className="input input-sm"
                style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.75rem', background: 'var(--color-bg-base)' }}
              />
              <button onClick={copyLink} className={`btn btn-sm ${copied ? 'btn-secondary' : 'btn-primary'}`} style={{ flexShrink: 0 }}>
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Comparte este link con el cliente para que vea el detalle de su compra.
              {(selectedClient?.phone || newClientForm.phone) && ' También puedes enviarlo por WhatsApp.'}
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <button onClick={handlePrintBoleta} className="btn btn-secondary btn-lg" style={{ width: '100%' }}>
              🖨️ Imprimir Boleta
            </button>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={resetForm} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                <ShoppingCart size={18} /> Nueva Venta
              </button>
              <button onClick={handleFinalizar} className="btn btn-secondary btn-lg" style={{ flex: 1 }}>
                ✓ Finalizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
