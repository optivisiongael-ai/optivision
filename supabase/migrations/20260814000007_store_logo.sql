-- ── Agregar logo_url a tiendas y bucket de storage ───────────────────────────

-- 1. Agregar columna logo_url a la tabla stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Crear bucket para logos de tiendas (público para que aparezca en recibos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-logos', 'store-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Policy de storage: ADMIN puede subir, todos pueden leer
DROP POLICY IF EXISTS "store_logos_admin_upload" ON storage.objects;
CREATE POLICY "store_logos_admin_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'store-logos' AND
    public.current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "store_logos_admin_update" ON storage.objects;
CREATE POLICY "store_logos_admin_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'store-logos' AND
    public.current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "store_logos_admin_delete" ON storage.objects;
CREATE POLICY "store_logos_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'store-logos' AND
    public.current_user_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "store_logos_public_read" ON storage.objects;
CREATE POLICY "store_logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'store-logos');
