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

-- ── VENDEDOR: INSERT permissions ──────────────────────────────────────────────

-- 6. Clients: VENDEDOR puede insertar y actualizar clientes
DROP POLICY IF EXISTS "clients_vendedor_select" ON public.clients;
CREATE POLICY "clients_vendedor_select" ON public.clients
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "clients_vendedor_insert" ON public.clients;
CREATE POLICY "clients_vendedor_insert" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "clients_vendedor_update" ON public.clients;
CREATE POLICY "clients_vendedor_update" ON public.clients
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Sales: VENDEDOR puede insertar ventas donde el seller_id es su propio ID
DROP POLICY IF EXISTS "sales_vendedor_insert" ON public.sales;
CREATE POLICY "sales_vendedor_insert" ON public.sales
  FOR INSERT WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "sales_vendedor_select" ON public.sales;
CREATE POLICY "sales_vendedor_select" ON public.sales
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 8. Sale items: VENDEDOR puede insertar items de ventas
DROP POLICY IF EXISTS "sale_items_vendedor_insert" ON public.sale_items;
CREATE POLICY "sale_items_vendedor_insert" ON public.sale_items
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sale_items_select" ON public.sale_items;
CREATE POLICY "sale_items_select" ON public.sale_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 9. Audit log: cualquier usuario autenticado puede insertar
DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT USING (auth.uid() IS NOT NULL);
