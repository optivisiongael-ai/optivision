import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../lib/supabase/auth';
import SearchableDropdown from '../components/shared/SearchableDropdown';
import ReceiptPreview from '../components/shared/ReceiptPreview';
import {
  Search, UserPlus, ShoppingCart, ChevronRight, ChevronLeft,
  Plus, Minus, X, Check, AlertCircle, Eye
} from 'lucide-react';

const fmt = (n: number) => `Bs. ${n.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`;

type SaleItem = { productId: string; name: string; category: string; quantity: number; unitPrice: number; subtotal: number; };

const emptyMeasures = { od_sphere: '', od_cylinder: '', od_axis: '', od_add: '', oi_sphere: '', oi_cylinder: '', oi_axis: '', oi_add: '', dip: '' };
const emptyClient = { full_name: '', phone: '', email: '', ...emptyMeasures };

type Step = 'client' | 'products' | 'receipt';

export default function NewSale() {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('client');

  // Client search
  const [clientSearch, setClientSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState(emptyClient);
  const [searchLoading, setSearchLoading] = useState(false);

  // Products
  const [products, setProducts] = useState<{ lentes: any[]; monturas: any[]; materiales: any[]; accesorios: any[] }>({ lentes: [], monturas: [], materiales: [], accesorios: [] });
  const [selectedLente, setSelectedLente] = useState('');
  const [selectedMontura, setSelectedMontura] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [advancePayment, setAdvancePayment] = useState(0);
  const [notes, setNotes] = useState('');

  // Sale result
  const [saleData, setSaleData] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, sku_code, category, price').eq('active', true).order('name');
    const all = data || [];
    setProducts({
      lentes: all.filter((p: any) => p.category === 'LENTE'),
      monturas: all.filter((p: any) => p.category === 'MONTURA'),
      materiales: all.filter((p: any) => p.category === 'MATERIAL'),
      accesorios: all.filter((p: any) => p.category === 'ACCESORIO'),
    });
  };

  const searchClients = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    const { data } = await supabase.from('clients').select('id, client_code, full_name, phone, email, od_sphere, od_cylinder, od_axis, od_add, oi_sphere, oi_cylinder, oi_axis, oi_add, dip')
      .or(`full_name.ilike.%${q}%,client_code.ilike.%${q}%`).limit(8);
    setSearchResults(data || []);
    setSearchLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchClients(clientSearch), 300);
    return () => clearTimeout(t);
  }, [clientSearch, searchClients]);

  const selectClient = (c: any) => {
    setSelectedClient(c);
    setSearchResults([]);
    setClientSearch('');
    setIsNewClient(false);
  };

  const startNewClient = () => {
    setSelectedClient(null);
    setIsNewClient(true);
    setNewClientForm(emptyClient);
  };

  const toProductStep = () => {
    if (!selectedClient && !isNewClient) { setError('Selecciona o crea un cliente'); return; }
    if (isNewClient && !newClientForm.full_name.trim()) { setError('El nombre del cliente es obligatorio'); return; }
    setError(null);
    setStep('products');
  };

  // Add product to sale
  const addProduct = (productId: string, list: any[]) => {
    if (!productId) return;
    const prod = list.find((p: any) => p.id === productId);
    if (!prod) return;
    setSaleItems(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing) {
        return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice } : i);
      }
      return [...prev, { productId: prod.id, name: prod.name, category: prod.category, quantity: 1, unitPrice: prod.price, subtotal: prod.price }];
    });
  };

  useEffect(() => { if (selectedLente) { addProduct(selectedLente, products.lentes); } }, [selectedLente]);
  useEffect(() => { if (selectedMontura) { addProduct(selectedMontura, products.monturas); } }, [selectedMontura]);
  useEffect(() => { if (selectedMaterial) { addProduct(selectedMaterial, products.materiales); } }, [selectedMaterial]);

  const updateQty = (productId: string, delta: number) => {
    setSaleItems(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const newQty = Math.max(0, i.quantity + delta);
      if (newQty === 0) return i; // use remove button
      return { ...i, quantity: newQty, subtotal: newQty * i.unitPrice };
    }));
  };
  const removeItem = (productId: string) => setSaleItems(prev => prev.filter(i => i.productId !== productId));

  const subtotal = saleItems.reduce((s, i) => s + i.subtotal, 0);
  const total = Math.max(0, subtotal - discount);
  const balance = Math.max(0, total - advancePayment);

  const CATEGORY_LABELS: Record<string, string> = { LENTE: 'Lente', MONTURA: 'Montura', MATERIAL: 'Material', ACCESORIO: 'Accesorio' };

  const handleConfirmSale = async () => {
    setSaving(true); setError(null);
    try {
      // 1. Create client if new
      let clientId = selectedClient?.id;
      if (isNewClient) {
        const clientCode = `OPT-${Date.now().toString().slice(-5)}`;
        const { data: newClient, error: clientError } = await supabase.from('clients').insert({
          ...newClientForm,
          full_name: newClientForm.full_name.trim(),
          phone: newClientForm.phone.trim() || null,
          email: newClientForm.email.trim() || null,
          client_code: clientCode,
          created_by: profile?.id,
          od_sphere: newClientForm.od_sphere || null,
          od_cylinder: newClientForm.od_cylinder || null,
          od_axis: newClientForm.od_axis || null,
          od_add: newClientForm.od_add || null,
          oi_sphere: newClientForm.oi_sphere || null,
          oi_cylinder: newClientForm.oi_cylinder || null,
          oi_axis: newClientForm.oi_axis || null,
          oi_add: newClientForm.oi_add || null,
          dip: newClientForm.dip || null,
        }).select().single();
        if (clientError) throw new Error(clientError.message);
        clientId = newClient.id;
        await supabase.from('audit_log').insert({ user_id: profile?.id, user_email: profile?.email, action: 'CLIENTE_CREADO', entity_type: 'CLIENT', entity_id: clientId, description: `Nuevo cliente: ${newClientForm.full_name} (${clientCode})` });
      }

      // 2. Create sale
      const saleCode = `VNT-${Date.now().toString().slice(-7)}`;
      const { data: newSale, error: saleError } = await supabase.from('sales').insert({
        sale_code: saleCode,
        client_id: clientId,
        store_id: profile?.store_id,
        seller_id: profile?.id,
        subtotal, discount, total, advance_payment: advancePayment, balance,
        status: balance === 0 ? 'COMPLETED' : 'PENDING',
        notes: notes.trim() || null,
      }).select().single();
      if (saleError) throw new Error(saleError.message);

      // 3. Create sale items (triggers inventory deduction)
      const itemsPayload = saleItems.map(i => ({ sale_id: newSale.id, product_id: i.productId, quantity: i.quantity, unit_price: i.unitPrice, subtotal: i.subtotal }));
      const { error: itemsError } = await supabase.from('sale_items').insert(itemsPayload);
      if (itemsError) throw new Error(itemsError.message);

      // 4. Audit log
      await supabase.from('audit_log').insert({ user_id: profile?.id, user_email: profile?.email, action: 'VENTA_CREADA', entity_type: 'SALE', entity_id: newSale.id, description: `Venta ${saleCode} — Total: ${fmt(total)}` });

      // 5. Fetch client for receipt
      const clientData = isNewClient ? { full_name: newClientForm.full_name, client_code: 'OPT-' + Date.now().toString().slice(-5) } : selectedClient;
      const storeRes = await supabase.from('stores').select('name').eq('id', profile?.store_id).single();

      setSaleData({
        saleCode,
        client: clientData,
        storeName: storeRes.data?.name || 'OPTIVISION',
        sellerName: profile?.full_name || profile?.email || '',
        date: new Date().toISOString(),
        items: saleItems,
        subtotal, discount, total, advancePayment, balance,
        notes: notes.trim(),
      });
      setStep('receipt');
    } catch (err: any) {
      setError(err.message || 'Error al registrar la venta');
    }
    setSaving(false);
  };

  const resetForm = () => {
    setStep('client'); setSelectedClient(null); setIsNewClient(false);
    setNewClientForm(emptyClient); setSaleItems([]); setSelectedLente('');
    setSelectedMontura(''); setSelectedMaterial(''); setDiscount(0);
    setAdvancePayment(0); setNotes(''); setSaleData(null); setError(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🛒 Nueva Venta</h1>
          <p className="page-subtitle">Registra una venta y genera la boleta de compra</p>
        </div>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        {[
          { id: 'client', label: '1. Cliente', icon: '👤' },
          { id: 'products', label: '2. Productos', icon: '📦' },
          { id: 'receipt', label: '3. Boleta', icon: '🧾' },
        ].map((s, i, arr) => (
          <>
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', borderRadius: 99,
              background: step === s.id ? 'rgba(6,182,212,0.15)' : 'var(--color-bg-card)',
              border: `1px solid ${step === s.id ? 'rgba(6,182,212,0.4)' : 'var(--color-border)'}`,
              color: step === s.id ? 'var(--color-brand-400)' : 'var(--color-text-muted)',
              fontWeight: step === s.id ? 700 : 500, fontSize: '0.8125rem',
              transition: 'all 0.2s',
            }}>
              {s.icon} {s.label}
            </div>
            {i < arr.length - 1 && <ChevronRight size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
          </>
        ))}
      </div>

      {error && <div className="alert alert-error fade-in" style={{ marginBottom: '1.25rem' }}><AlertCircle size={15} />{error}</div>}

      {/* STEP 1: Client */}
      {step === 'client' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Search existing */}
          {!selectedClient && !isNewClient && (
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text-primary)' }}>🔍 Buscar Cliente</h3>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input
                  className="input" placeholder="Nombre o código (OPT-XXXXX)..."
                  value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                />
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

          {/* Selected existing client */}
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
              {(selectedClient.od_sphere || selectedClient.oi_sphere) && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(6,182,212,0.15)' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Medidas de Lentes</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                    {[
                      { label: 'OD Esfera', val: selectedClient.od_sphere }, { label: 'OD Cilindro', val: selectedClient.od_cylinder },
                      { label: 'OD Eje', val: selectedClient.od_axis }, { label: 'OD Add', val: selectedClient.od_add },
                      { label: 'OI Esfera', val: selectedClient.oi_sphere }, { label: 'OI Cilindro', val: selectedClient.oi_cylinder },
                      { label: 'OI Eje', val: selectedClient.oi_axis }, { label: 'OI Add', val: selectedClient.oi_add },
                      { label: 'DIP', val: selectedClient.dip },
                    ].filter(i => i.val).map(i => (
                      <div key={i.label}><span style={{ color: 'var(--color-text-muted)' }}>{i.label}: </span><strong>{i.val}</strong></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* New client form */}
          {isNewClient && (
            <div className="card fade-in">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>👤 Nuevo Cliente</h3>
                <button onClick={() => setIsNewClient(false)} className="btn btn-ghost btn-icon btn-sm"><X size={15} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Basic info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="label">Nombre Completo *</label>
                    <input className="input" required value={newClientForm.full_name} onChange={e => setNewClientForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Juan Pérez" />
                  </div>
                  <div>
                    <label className="label">Teléfono</label>
                    <input className="input" value={newClientForm.phone} onChange={e => setNewClientForm(f => ({ ...f, phone: e.target.value }))} placeholder="+591 70000000" />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input className="input" type="email" value={newClientForm.email} onChange={e => setNewClientForm(f => ({ ...f, email: e.target.value }))} placeholder="cliente@email.com" />
                  </div>
                </div>

                {/* Lens measurements */}
                <div>
                  <p className="section-title" style={{ marginBottom: '0.875rem' }}>🔭 Medidas de Lentes (Opcional)</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.75rem' }}>
                    {[
                      { key: 'od_sphere', label: 'OD Esfera' }, { key: 'od_cylinder', label: 'OD Cilindro' },
                      { key: 'od_axis', label: 'OD Eje' }, { key: 'od_add', label: 'OD Add' },
                      { key: 'oi_sphere', label: 'OI Esfera' }, { key: 'oi_cylinder', label: 'OI Cilindro' },
                      { key: 'oi_axis', label: 'OI Eje' }, { key: 'oi_add', label: 'OI Add' },
                      { key: 'dip', label: 'DIP' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="label">{label}</label>
                        <input className="input input-sm" value={(newClientForm as any)[key]} onChange={e => setNewClientForm(f => ({ ...f, [key]: e.target.value }))} placeholder="0.00" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={toProductStep} className="btn btn-primary btn-lg" id="btn-next-products">
              Continuar con Productos <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Products */}
      {step === 'products' && (
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left: product selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: '1.25rem', color: 'var(--color-text-primary)' }}>📦 Selección de Productos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <SearchableDropdown
                  label="Lentes"
                  placeholder="Seleccionar lente..."
                  options={products.lentes.map(p => ({ id: p.id, label: p.name, sublabel: p.sku_code, price: p.price }))}
                  value={selectedLente}
                  onChange={v => setSelectedLente(v)}
                />
                <SearchableDropdown
                  label="Monturas"
                  placeholder="Seleccionar montura..."
                  options={products.monturas.map(p => ({ id: p.id, label: p.name, sublabel: p.sku_code, price: p.price }))}
                  value={selectedMontura}
                  onChange={v => setSelectedMontura(v)}
                />
                <SearchableDropdown
                  label="Materiales"
                  placeholder="Seleccionar material..."
                  options={products.materiales.map(p => ({ id: p.id, label: p.name, sublabel: p.sku_code, price: p.price }))}
                  value={selectedMaterial}
                  onChange={v => setSelectedMaterial(v)}
                />
                {products.accesorios.length > 0 && (
                  <SearchableDropdown
                    label="Accesorios (Opcional)"
                    placeholder="Seleccionar accesorio..."
                    options={products.accesorios.map(p => ({ id: p.id, label: p.name, sublabel: p.sku_code, price: p.price }))}
                    value=""
                    onChange={v => { if (v) addProduct(v, products.accesorios); }}
                  />
                )}
              </div>
            </div>

            {/* Items list */}
            {saleItems.length > 0 && (
              <div className="card fade-in">
                <h4 style={{ fontWeight: 700, marginBottom: '1rem', color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
                  Items seleccionados ({saleItems.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {saleItems.map(item => (
                    <div key={item.productId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem', background: 'var(--color-bg-input)', borderRadius: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{CATEGORY_LABELS[item.category]} · {fmt(item.unitPrice)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <button onClick={() => updateQty(item.productId, -1)} className="btn btn-ghost btn-icon btn-sm" disabled={item.quantity <= 1}><Minus size={12} /></button>
                        <span style={{ width: 24, textAlign: 'center', fontWeight: 700, fontSize: '0.875rem' }}>{item.quantity}</span>
                        <button onClick={() => updateQty(item.productId, 1)} className="btn btn-ghost btn-icon btn-sm"><Plus size={12} /></button>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--color-brand-400)', fontSize: '0.875rem', minWidth: 70, textAlign: 'right' }}>{fmt(item.subtotal)}</span>
                      <button onClick={() => removeItem(item.productId)} className="btn btn-danger btn-icon btn-sm"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="card">
              <label className="label" htmlFor="sale-notes">Notas de la Venta</label>
              <textarea id="sale-notes" className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones, instrucciones de entrega..." style={{ resize: 'vertical' }} />
            </div>
          </div>

          {/* Right: summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1rem' }}>
            <div className="card">
              <h4 style={{ fontWeight: 700, marginBottom: '1.25rem', color: 'var(--color-text-primary)' }}>💰 Resumen de Venta</h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
                  <span style={{ fontWeight: 600 }}>{fmt(subtotal)}</span>
                </div>
                <div>
                  <label className="label" style={{ marginBottom: '0.375rem' }}>Descuento (Bs.)</label>
                  <input className="input input-sm" type="number" min="0" step="0.01" value={discount || ''} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} placeholder="0.00" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(6,182,212,0.08)', borderRadius: 10, border: '1px solid rgba(6,182,212,0.2)' }}>
                  <span style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>TOTAL</span>
                  <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--color-brand-400)' }}>{fmt(total)}</span>
                </div>
                <div className="divider" style={{ margin: '0.25rem 0' }} />
                <div>
                  <label className="label" style={{ marginBottom: '0.375rem' }}>Adelanto Pagado (Bs.)</label>
                  <input className="input input-sm" type="number" min="0" step="0.01" max={total} value={advancePayment || ''} onChange={e => setAdvancePayment(parseFloat(e.target.value) || 0)} placeholder="0.00" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: balance > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)', borderRadius: 8, border: `1px solid ${balance > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Saldo pendiente</span>
                  <span style={{ fontWeight: 700, color: balance > 0 ? '#fbbf24' : '#34d399' }}>{balance > 0 ? fmt(balance) : '✓ Pagado'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <button
                  id="btn-confirm-sale"
                  onClick={handleConfirmSale}
                  disabled={saleItems.length === 0 || saving}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
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

      {/* STEP 3: Receipt */}
      {step === 'receipt' && saleData && (
        <div className="fade-in" style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
            <Check size={16} />
            <div>
              <strong>¡Venta registrada exitosamente!</strong>
              <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Código: <code style={{ fontFamily: 'monospace' }}>{saleData.saleCode}</code></p>
            </div>
          </div>
          <ReceiptPreview
            saleCode={saleData.saleCode}
            clientName={saleData.client?.full_name || 'N/A'}
            clientCode={saleData.client?.client_code || ''}
            storeName={saleData.storeName}
            sellerName={saleData.sellerName}
            date={saleData.date}
            items={saleData.items}
            subtotal={saleData.subtotal}
            discount={saleData.discount}
            total={saleData.total}
            advancePayment={saleData.advancePayment}
            balance={saleData.balance}
            notes={saleData.notes}
          />
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <button onClick={resetForm} className="btn btn-primary btn-lg">
              <ShoppingCart size={18} /> Nueva Venta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
