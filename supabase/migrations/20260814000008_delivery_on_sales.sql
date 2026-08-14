-- ── Migration: Delivery date on sales (not clients) ─────────────────────────
-- frame_type / crystal_type / delivery_date / delivery_time belong to the SALE,
-- not to the client profile. These were mistakenly added to 'clients' in
-- migration 20260814000001. We add delivery fields to 'sales' here.

-- Add delivery fields to SALES table
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_time TEXT;

-- Note: frame_type and crystal_type are implicit in the products selected
-- (MONTURA category = frame, MATERIAL = crystal). No extra column needed.

-- Clean up clients table: remove frame_type, crystal_type from clients
-- (data already there is preserved but no longer used by the app)
-- We do NOT drop the columns to avoid data loss; just stop using them.
