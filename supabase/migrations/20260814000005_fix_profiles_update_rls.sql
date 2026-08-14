-- ── Fix: RLS UPDATE en profiles necesita WITH CHECK ─────────────────────────

-- Admin puede actualizar cualquier perfil (con WITH CHECK para que no sea bloqueado)
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');

-- El propio usuario puede actualizar su perfil (con WITH CHECK)
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
