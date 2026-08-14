-- ── Fix: Admin puede ver todos los perfiles ──────────────────────────────────

-- 1. Función helper (idempotente)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- 2. Política SELECT para admin (ve todos los perfiles)
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;
CREATE POLICY "profiles_admin_select" ON public.profiles
  FOR SELECT USING (public.current_user_role() = 'ADMIN');

-- La política "profiles_select_own" sigue activa para vendedores (ven solo el suyo).
