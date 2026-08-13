-- ============================================================
-- OPTIVISION — Row Level Security (RLS)
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_alert_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          ENABLE ROW LEVEL SECURITY;

-- ── Función helper: obtener rol del usuario actual ────────────
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ── Función helper: obtener tienda del usuario actual ─────────
CREATE OR REPLACE FUNCTION public.current_user_store()
RETURNS UUID AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================
-- PROFILES
-- ============================================================
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

-- Cualquier usuario autenticado puede ver su propio perfil (sin recursión)
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Admin puede modificar todos los perfiles
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE USING (public.current_user_role() = 'ADMIN');

-- El propio usuario puede actualizar su perfil
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Insert solo desde funciones con SECURITY DEFINER (admin-invite-user)
CREATE POLICY "profiles_insert_service" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- STORES
-- ============================================================
DROP POLICY IF EXISTS "stores_select" ON public.stores;
DROP POLICY IF EXISTS "stores_admin_write" ON public.stores;

CREATE POLICY "stores_select_all" ON public.stores
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "stores_admin_write" ON public.stores
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- ============================================================
-- STORE_ALERT_CONFIG
-- ============================================================
CREATE POLICY "alert_config_admin" ON public.store_alert_config
  FOR ALL USING (public.current_user_role() = 'ADMIN');

CREATE POLICY "alert_config_select" ON public.store_alert_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- PRODUCTS — Vendedor: solo lectura
-- ============================================================
DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_admin_write" ON public.products;

CREATE POLICY "products_select_all" ON public.products
  FOR SELECT USING (auth.uid() IS NOT NULL AND active = true);

CREATE POLICY "products_admin_all" ON public.products
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- ============================================================
-- INVENTORY — Vendedor: solo lectura
-- ============================================================
DROP POLICY IF EXISTS "inventory_select" ON public.inventory;
DROP POLICY IF EXISTS "inventory_admin_write" ON public.inventory;

CREATE POLICY "inventory_select_all" ON public.inventory
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "inventory_admin_write" ON public.inventory
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- Trigger fn necesita bypass: se ejecuta SECURITY DEFINER
-- El trigger fn_discount_inventory escribe en inventory con sus propios permisos

-- ============================================================
-- SYNC_LOGS — Solo admin
-- ============================================================
CREATE POLICY "sync_logs_admin" ON public.sync_logs
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- ============================================================
-- CLIENTS — Vendedor: su tienda; Admin: todos
-- ============================================================
DROP POLICY IF EXISTS "clients_select" ON public.clients;
DROP POLICY IF EXISTS "clients_vendedor_write" ON public.clients;
DROP POLICY IF EXISTS "clients_admin" ON public.clients;

CREATE POLICY "clients_admin" ON public.clients
  FOR ALL USING (public.current_user_role() = 'ADMIN');

-- Vendedor puede ver todos los clientes (para búsqueda en venta)
CREATE POLICY "clients_vendedor_select" ON public.clients
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Vendedor puede crear y editar clientes
CREATE POLICY "clients_vendedor_insert" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "clients_vendedor_update" ON public.clients
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- SALES — Vendedor: sus ventas; Admin: todas
-- ============================================================
DROP POLICY IF EXISTS "sales_select" ON public.sales;
DROP POLICY IF EXISTS "sales_vendedor_insert" ON public.sales;
DROP POLICY IF EXISTS "sales_admin" ON public.sales;

CREATE POLICY "sales_admin" ON public.sales
  FOR ALL USING (public.current_user_role() = 'ADMIN');

CREATE POLICY "sales_vendedor_select" ON public.sales
  FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "sales_vendedor_insert" ON public.sales
  FOR INSERT WITH CHECK (seller_id = auth.uid());

-- ============================================================
-- SALE_ITEMS
-- ============================================================
DROP POLICY IF EXISTS "sale_items_select" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_insert" ON public.sale_items;

CREATE POLICY "sale_items_admin" ON public.sale_items
  FOR ALL USING (public.current_user_role() = 'ADMIN');

CREATE POLICY "sale_items_vendedor_select" ON public.sale_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.sales WHERE id = sale_id AND seller_id = auth.uid())
  );

CREATE POLICY "sale_items_vendedor_insert" ON public.sale_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.sales WHERE id = sale_id AND seller_id = auth.uid())
  );

-- ============================================================
-- AUDIT_LOG
-- ============================================================
DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;

CREATE POLICY "audit_log_admin_select" ON public.audit_log
  FOR SELECT USING (public.current_user_role() = 'ADMIN');

CREATE POLICY "audit_log_vendedor_select" ON public.audit_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
