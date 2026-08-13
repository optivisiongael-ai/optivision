-- ============================================================
-- OPTIVISION — Migración inicial
-- Crea todas las tablas del sistema con índices y triggers
-- ============================================================

-- ── Extensiones ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tiendas ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stores (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Perfiles de usuario ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'VENDEDOR' CHECK (role IN ('ADMIN', 'VENDEDOR')),
  active      BOOLEAN NOT NULL DEFAULT true,
  store_id    UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Configuración de alertas de stock por tienda ─────────────
CREATE TABLE IF NOT EXISTS public.store_alert_config (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id             UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  alerts_enabled       BOOLEAN NOT NULL DEFAULT false,
  low_stock_threshold  INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold BETWEEN 1 AND 100),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id)
);

-- ── Productos / SKUs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_code    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL CHECK (category IN ('LENTE', 'MONTURA', 'MATERIAL', 'ACCESORIO')),
  price       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Inventario por tienda ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id       UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  quantity       INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  UNIQUE (product_id, store_id)
);

-- ── Logs de sincronización ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id     UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  status       TEXT NOT NULL CHECK (status IN ('PENDING', 'SYNCING', 'SUCCESS', 'ERROR')),
  triggered_by TEXT,
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Clientes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_code TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  -- Medidas de lentes (OD = Ojo Derecho, OI = Ojo Izquierdo)
  od_sphere   TEXT, od_cylinder TEXT, od_axis TEXT, od_add TEXT,
  oi_sphere   TEXT, oi_cylinder TEXT, oi_axis TEXT, oi_add TEXT,
  dip         TEXT, -- Distancia Interpupilar
  notes       TEXT,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Ventas ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_code       TEXT NOT NULL UNIQUE,
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  store_id        UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  seller_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  advance_payment NUMERIC(12, 2) NOT NULL DEFAULT 0,
  balance         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Items de venta ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sale_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id     UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12, 2) NOT NULL,
  subtotal    NUMERIC(12, 2) NOT NULL
);

-- ── Audit log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  description TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_role        ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_products_category    ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_active      ON public.products(active);
CREATE INDEX IF NOT EXISTS idx_inventory_store      ON public.inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product    ON public.inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_clients_code         ON public.clients(client_code);
CREATE INDEX IF NOT EXISTS idx_clients_name         ON public.clients USING gin(to_tsvector('simple', full_name));
CREATE INDEX IF NOT EXISTS idx_sales_seller         ON public.sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_client         ON public.sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_store          ON public.sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale      ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_audit_user           ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created        ON public.audit_log(created_at DESC);

-- ── Función y trigger de descuento de inventario ─────────────
-- Al insertar sale_items, descuenta automáticamente del inventario de la tienda
CREATE OR REPLACE FUNCTION public.fn_discount_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_store_id UUID;
BEGIN
  -- Obtener la tienda de la venta
  SELECT store_id INTO v_store_id FROM public.sales WHERE id = NEW.sale_id;
  
  IF v_store_id IS NOT NULL AND NEW.product_id IS NOT NULL THEN
    -- Upsert inventory row y descontar cantidad
    INSERT INTO public.inventory (product_id, store_id, quantity)
    VALUES (NEW.product_id, v_store_id, -NEW.quantity)
    ON CONFLICT (product_id, store_id)
    DO UPDATE SET
      quantity = GREATEST(0, public.inventory.quantity - NEW.quantity),
      last_synced_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_discount_inventory ON public.sale_items;
CREATE TRIGGER trg_discount_inventory
  AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_discount_inventory();

-- ── Función de creación automática de perfil ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'VENDEDOR')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
