-- ── Fix: RLS policies para INSERT con WITH CHECK ────────────────────────────
-- En Supabase/PostgreSQL, FOR ALL con solo USING no aplica a INSERT.
-- Se necesita WITH CHECK para que los admins puedan insertar filas.

-- Products
DROP POLICY IF EXISTS "products_admin_all" ON public.products;
CREATE POLICY "products_admin_all" ON public.products
  FOR ALL
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');

-- Inventory
DROP POLICY IF EXISTS "inventory_admin_write" ON public.inventory;
CREATE POLICY "inventory_admin_write" ON public.inventory
  FOR ALL
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');

-- Stores
DROP POLICY IF EXISTS "stores_admin_write" ON public.stores;
CREATE POLICY "stores_admin_write" ON public.stores
  FOR ALL
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');

-- Catalog options
DROP POLICY IF EXISTS "catalog_admin_write" ON public.catalog_options;
CREATE POLICY "catalog_admin_write" ON public.catalog_options
  FOR ALL
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');

-- Store alert config
DROP POLICY IF EXISTS "alert_config_admin" ON public.store_alert_config;
CREATE POLICY "alert_config_admin" ON public.store_alert_config
  FOR ALL
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');
