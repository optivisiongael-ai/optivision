-- ── Migration: Stock, Descuento por Producto y Prescripción Completa ────────
-- Fecha: 2026-08-14

-- ── products: descuento máximo y alerta de stock mínimo ─────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS max_discount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock_alert   INTEGER       NOT NULL DEFAULT 5;

-- ── clients: medidas completas (lejos + cerca + datos extra) ────────────────
-- Lejos (far vision) — ya existen: od_sphere, od_cylinder, od_axis, od_add, oi_sphere, oi_cylinder, oi_axis, oi_add, dip
-- Añadimos: DIP far (renaming conceptual), cerca, ADD+, frame, crystal, age
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS dip_far        TEXT,   -- DIP lejos (antes 'dip' era genérico)
  ADD COLUMN IF NOT EXISTS od_sphere_near TEXT,   -- Cerca OD Esfera
  ADD COLUMN IF NOT EXISTS od_cyl_near    TEXT,   -- Cerca OD Cilindro
  ADD COLUMN IF NOT EXISTS od_axis_near   TEXT,   -- Cerca OD Eje
  ADD COLUMN IF NOT EXISTS od_dip_near    TEXT,   -- Cerca OD DIP
  ADD COLUMN IF NOT EXISTS oi_sphere_near TEXT,   -- Cerca OI Esfera
  ADD COLUMN IF NOT EXISTS oi_cyl_near    TEXT,   -- Cerca OI Cilindro
  ADD COLUMN IF NOT EXISTS oi_axis_near   TEXT,   -- Cerca OI Eje
  ADD COLUMN IF NOT EXISTS add_near       TEXT,   -- ADD+ (adición lectura)
  ADD COLUMN IF NOT EXISTS frame_type     TEXT,   -- Metal, Acetato, Nylon, TR90...
  ADD COLUMN IF NOT EXISTS crystal_type   TEXT,   -- Orgánico, Foto Blue, CR39...
  ADD COLUMN IF NOT EXISTS age            TEXT,   -- Edad del paciente
  ADD COLUMN IF NOT EXISTS delivery_date  DATE,   -- Fecha de entrega prometida
  ADD COLUMN IF NOT EXISTS delivery_time  TEXT;   -- Hora de entrega (e.g. "17:00")
