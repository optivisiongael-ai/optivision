-- ── Fix definitivo: VENDEDORs pueden ver productos y catálogo ─────────────────
-- El problema: la policy products_select_all tiene 'active = true' en USING
-- pero puede interferir con cómo Supabase evalúa el JWT en producción.
-- Solución: política más simple sin la condición extra.

-- 1. Products: cualquier usuario autenticado puede hacer SELECT
DROP POLICY IF EXISTS "products_select_all" ON public.products;
CREATE POLICY "products_select_all" ON public.products
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 2. Inventory: cualquier usuario autenticado puede hacer SELECT
DROP POLICY IF EXISTS "inventory_select_all" ON public.inventory;
CREATE POLICY "inventory_select_all" ON public.inventory
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 3. Catalog options: cualquier usuario autenticado puede ver el catálogo
DROP POLICY IF EXISTS "catalog_select_all" ON public.catalog_options;
CREATE POLICY "catalog_select_all" ON public.catalog_options
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 4. Stores: cualquier usuario autenticado puede ver las tiendas activas
DROP POLICY IF EXISTS "stores_select_all" ON public.stores;
CREATE POLICY "stores_select_all" ON public.stores
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 5. Store alert config: cualquier usuario autenticado puede ver la config de su tienda
DROP POLICY IF EXISTS "alert_config_select" ON public.store_alert_config;
CREATE POLICY "alert_config_select" ON public.store_alert_config
  FOR SELECT USING (auth.uid() IS NOT NULL);
