-- These triggers only reject edits to historical snapshots/final ledger rows.
-- Operational fields (status, balances, version) remain writable.
CREATE FUNCTION commerce_order_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Order snapshots cannot be deleted';
  END IF;
  IF TG_TABLE_NAME = 'orders' THEN
    IF ROW(NEW."orderNumber",NEW."customerName",NEW."customerEmail",NEW."customerPhone",NEW."paymentMethod",NEW.currency,NEW.subtotal,NEW."discountTotal",NEW."shippingTotal",NEW."taxTotal",NEW."grandTotal",NEW."customerNote",NEW."placedAt")
       IS DISTINCT FROM ROW(OLD."orderNumber",OLD."customerName",OLD."customerEmail",OLD."customerPhone",OLD."paymentMethod",OLD.currency,OLD.subtotal,OLD."discountTotal",OLD."shippingTotal",OLD."taxTotal",OLD."grandTotal",OLD."customerNote",OLD."placedAt") THEN
      RAISE EXCEPTION 'Order commercial/customer snapshot is immutable';
    END IF;
  ELSIF TG_TABLE_NAME = 'order_items' THEN
    IF ROW(NEW."orderId",NEW."skuSnapshot",NEW."nameSnapshot",NEW."variantSnapshot",NEW.quantity,NEW."unitPrice",NEW."discountTotal",NEW."taxTotal",NEW."lineTotal")
       IS DISTINCT FROM ROW(OLD."orderId",OLD."skuSnapshot",OLD."nameSnapshot",OLD."variantSnapshot",OLD.quantity,OLD."unitPrice",OLD."discountTotal",OLD."taxTotal",OLD."lineTotal") THEN
      RAISE EXCEPTION 'Order item snapshot is immutable';
    END IF;
  ELSE
    RAISE EXCEPTION 'Order address snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER orders_snapshot_guard BEFORE UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION commerce_order_snapshot_guard();
CREATE TRIGGER order_items_snapshot_guard BEFORE UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION commerce_order_snapshot_guard();
CREATE TRIGGER order_addresses_snapshot_guard BEFORE UPDATE OR DELETE ON order_addresses FOR EACH ROW EXECUTE FUNCTION commerce_order_snapshot_guard();

CREATE FUNCTION commerce_order_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'order_events' THEN
    RAISE EXCEPTION 'Final order ledger and audit records are immutable';
  ELSIF OLD.status = 'SUCCEEDED' THEN
    RAISE EXCEPTION 'Final order ledger and audit records are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_events_immutable BEFORE UPDATE OR DELETE ON order_events FOR EACH ROW EXECUTE FUNCTION commerce_order_audit_guard();
CREATE TRIGGER order_final_payments_immutable BEFORE UPDATE OR DELETE ON order_payment_transactions FOR EACH ROW EXECUTE FUNCTION commerce_order_audit_guard();
