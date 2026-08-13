import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface Option {
  id: string;
  label: string;
  sublabel?: string;
  price?: number;
}

interface SearchableDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  required?: boolean;
}

export default function SearchableDropdown({
  options, value, onChange, placeholder = 'Seleccionar...', disabled, label, required
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.id === value);
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.sublabel || '').toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatPrice = (p?: number) =>
    p !== undefined ? `Bs. ${p.toLocaleString('es-BO', { minimumFractionDigits: 2 })}` : '';

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      {label && (
        <label className="label">
          {label} {required && <span style={{ color: '#f87171' }}>*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '0.5rem', padding: '0.625rem 0.875rem',
          background: 'var(--color-bg-input)', border: '1px solid var(--color-border)',
          borderRadius: 10, color: selected ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.875rem',
          transition: 'border-color 0.15s',
        }}
      >
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {selected && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-brand-400)', fontWeight: 600 }}>
              {formatPrice(selected.price)}
            </span>
          )}
          {selected && !disabled && (
            <X
              size={14}
              style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onChange(''); }}
            />
          )}
          <ChevronDown
            size={16}
            style={{
              color: 'var(--color-text-muted)',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        </div>
      </button>

      {open && (
        <div className="fade-in" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
          background: 'var(--color-bg-card)', border: '1px solid var(--color-border-light)',
          borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{
            padding: '0.625rem', borderBottom: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <Search size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--color-text-primary)', fontSize: '0.875rem', width: '100%',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                Sin resultados
              </div>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { onChange(opt.id); setOpen(false); setSearch(''); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.625rem 1rem', border: 'none', background: 'transparent',
                    cursor: 'pointer', fontSize: '0.875rem', textAlign: 'left',
                    color: opt.id === value ? 'var(--color-brand-400)' : 'var(--color-text-primary)',
                    borderLeft: opt.id === value ? '2px solid var(--color-brand-500)' : '2px solid transparent',
                    transition: 'background 0.1s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <div style={{ fontWeight: opt.id === value ? 600 : 400 }}>{opt.label}</div>
                    {opt.sublabel && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{opt.sublabel}</div>
                    )}
                  </div>
                  {opt.price !== undefined && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-brand-400)', fontWeight: 600, flexShrink: 0, marginLeft: '0.5rem' }}>
                      {formatPrice(opt.price)}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
