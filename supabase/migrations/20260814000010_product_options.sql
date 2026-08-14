-- ── Migration: product options & selected_option on sale_items ───────────────
-- Products can now define their own comma-separated variants/options
-- (e.g., "Rojo, Azul, Negro" for frames; "CR-39, Hi-Index 1.67" for lenses)
-- These appear as dropdowns when selling or restocking.

-- Add options field to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS options TEXT; -- Comma-separated, e.g. "Metal negro, Acetato azul, TR90 transparente"

-- Add selected_option to sale_items (which variant was sold)
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS selected_option TEXT;

-- Remove hardcoded FRAME_TYPE and CRYSTAL_TYPE catalog entries
-- (Product-level options replace these generic catalog types)
DELETE FROM public.catalog_options WHERE type IN ('FRAME_TYPE', 'CRYSTAL_TYPE');
