-- ── Migration: store_id on clients table ─────────────────────────────────────
-- Clients belong to a store (the store where they were registered).
-- Without this column, vendedores can see clients from other stores.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

-- Backfill: set store_id from the creator's store (best-effort, for existing data)
UPDATE public.clients c
SET store_id = p.store_id
FROM public.profiles p
WHERE p.id = c.created_by
  AND c.store_id IS NULL;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_clients_store_id ON public.clients(store_id);

-- RLS: vendedores can only see clients from their own store
-- (ADMIN can see all - handled in app with profile.role check)
