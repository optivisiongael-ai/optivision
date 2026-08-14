-- ============================================================
-- OPTIVISION — Migración: descuentos por ítem + anulaciones
-- ============================================================

-- 1. Descuento por ítem en sale_items
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason TEXT;

-- 2. Campos de anulación en sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cancellation_status TEXT
    CHECK (cancellation_status IN ('PENDING','APPROVED','REJECTED'))
    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. Descuento máximo por ítem en configuración de tienda
ALTER TABLE public.store_alert_config
  ADD COLUMN IF NOT EXISTS max_discount_per_item NUMERIC(12,2) NOT NULL DEFAULT 500;

-- 4. Índice en cancellation_status para dashboard rápido
CREATE INDEX IF NOT EXISTS idx_sales_cancellation
  ON public.sales(cancellation_status)
  WHERE cancellation_status = 'PENDING';

-- 5. Función para restaurar inventario al anular una venta
CREATE OR REPLACE FUNCTION public.fn_restore_inventory_on_cancel(p_sale_id UUID)
RETURNS VOID AS $$
DECLARE
  v_store_id UUID;
  item RECORD;
BEGIN
  SELECT store_id INTO v_store_id FROM public.sales WHERE id = p_sale_id;
  IF v_store_id IS NULL THEN RETURN; END IF;
  FOR item IN
    SELECT product_id, quantity FROM public.sale_items WHERE sale_id = p_sale_id
  LOOP
    IF item.product_id IS NOT NULL THEN
      INSERT INTO public.inventory (product_id, store_id, quantity)
      VALUES (item.product_id, v_store_id, item.quantity)
      ON CONFLICT (product_id, store_id)
      DO UPDATE SET
        quantity = public.inventory.quantity + item.quantity,
        last_synced_at = now();
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Función para ajuste de inventario al editar un ítem
CREATE OR REPLACE FUNCTION public.fn_adjust_inventory_for_item_edit(
  p_store_id     UUID,
  p_old_product  UUID,
  p_old_qty      INTEGER,
  p_new_product  UUID,
  p_new_qty      INTEGER
)
RETURNS VOID AS $$
BEGIN
  IF p_old_product IS NOT NULL THEN
    INSERT INTO public.inventory (product_id, store_id, quantity)
    VALUES (p_old_product, p_store_id, p_old_qty)
    ON CONFLICT (product_id, store_id)
    DO UPDATE SET
      quantity = public.inventory.quantity + p_old_qty,
      last_synced_at = now();
  END IF;
  IF p_new_product IS NOT NULL THEN
    INSERT INTO public.inventory (product_id, store_id, quantity)
    VALUES (p_new_product, p_store_id, -p_new_qty)
    ON CONFLICT (product_id, store_id)
    DO UPDATE SET
      quantity = GREATEST(0, public.inventory.quantity - p_new_qty),
      last_synced_at = now();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
