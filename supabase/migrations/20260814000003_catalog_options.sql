-- ── catalog_options: lista de valores configurables por el admin ──────────────
-- Tipos: 'PRODUCT_CATEGORY' | 'FRAME_TYPE' | 'CRYSTAL_TYPE'

CREATE TABLE IF NOT EXISTS public.catalog_options (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type       TEXT NOT NULL,   -- PRODUCT_CATEGORY, FRAME_TYPE, CRYSTAL_TYPE
  value      TEXT NOT NULL,
  label      TEXT NOT NULL,
  color      TEXT DEFAULT 'gray',   -- badge color (solo para PRODUCT_CATEGORY)
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (type, value)
);

-- RLS
ALTER TABLE public.catalog_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_select_all" ON public.catalog_options
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "catalog_admin_write" ON public.catalog_options
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- ── Seed: categorías de producto ─────────────────────────────────────────────
INSERT INTO public.catalog_options (type, value, label, color, sort_order) VALUES
  ('PRODUCT_CATEGORY', 'LENTE',     'Lente',     'teal',   1),
  ('PRODUCT_CATEGORY', 'MONTURA',   'Montura',   'blue',   2),
  ('PRODUCT_CATEGORY', 'MATERIAL',  'Material',  'purple', 3),
  ('PRODUCT_CATEGORY', 'ACCESORIO', 'Accesorio', 'yellow', 4)
ON CONFLICT (type, value) DO NOTHING;

-- ── Seed: tipos de armación ───────────────────────────────────────────────────
INSERT INTO public.catalog_options (type, value, label, sort_order) VALUES
  ('FRAME_TYPE', 'Metal',   'Metal',   1),
  ('FRAME_TYPE', 'Acetato', 'Acetato', 2),
  ('FRAME_TYPE', 'Nylon',   'Nylon',   3),
  ('FRAME_TYPE', 'TR90',    'TR90',    4),
  ('FRAME_TYPE', 'Madera',  'Madera',  5),
  ('FRAME_TYPE', 'Titanio', 'Titanio', 6),
  ('FRAME_TYPE', 'Otra',    'Otra',    99)
ON CONFLICT (type, value) DO NOTHING;

-- ── Seed: tipos de cristal ────────────────────────────────────────────────────
INSERT INTO public.catalog_options (type, value, label, sort_order) VALUES
  ('CRYSTAL_TYPE', 'Orgánico',         'Orgánico',          1),
  ('CRYSTAL_TYPE', 'Foto Blue (Grey)', 'Foto Blue (Grey)',   2),
  ('CRYSTAL_TYPE', 'Foto Blue (Brown)','Foto Blue (Brown)',  3),
  ('CRYSTAL_TYPE', 'Fotocromático',    'Fotocromático',      4),
  ('CRYSTAL_TYPE', 'CR-39',            'CR-39',              5),
  ('CRYSTAL_TYPE', 'Policarbonato',    'Policarbonato',      6),
  ('CRYSTAL_TYPE', 'Hi-Index 1.67',   'Hi-Index 1.67',      7),
  ('CRYSTAL_TYPE', 'Hi-Index 1.74',   'Hi-Index 1.74',      8),
  ('CRYSTAL_TYPE', 'Mineral',         'Mineral',             9)
ON CONFLICT (type, value) DO NOTHING;
