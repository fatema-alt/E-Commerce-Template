"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "../lib/cart";
import type { Product } from "../lib/storefront";
import { money } from "../lib/shop-client";
import { WishlistButton } from "./shopping-actions";

export function ProductPurchase({
  product,
  variantId,
  onVariantChange,
}: {
  product: Product;
  variantId: string;
  onVariantChange: (id: string) => void;
}) {
  const cart = useCart();
  const router = useRouter();
  const variants = product.variants || [];
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const variant = variants.find((v) => v.id === variantId);
  const needsVariant = variants.length > 0 && !variant;
  const available = variants.length
    ? (variant?.availableStock ?? 0)
    : product.availableStock;
  const inCart =
    cart.lines.find(
      (line) => line.productId === product.id && line.variantId === variant?.id,
    )?.quantity ?? 0;
  const limit = Math.max(0, Math.min(10000, available) - inCart);
  const count = Number(quantity);
  const valid =
    /^\d+$/.test(quantity) &&
    Number.isSafeInteger(count) &&
    count >= 1 &&
    count <= limit;
  const price = variant?.price ?? product.price;
  const compare = needsVariant
    ? null
    : variant
      ? variant.compareAtPrice
      : product.compareAtPrice;
  const saving = compare && compare > price ? compare - price : 0;
  const totalStock = variants.length
    ? variants.reduce((sum, v) => sum + v.availableStock, 0)
    : available;
  const quantityError =
    !needsVariant && limit > 0 && !valid
      ? `Enter a whole quantity from 1 to ${limit}.`
      : "";
  function changeQuantity(value: string) {
    setQuantity(value);
    setMessage("");
    setError("");
  }
  function chooseVariant(id: string) {
    onVariantChange(id);
    setQuantity("1");
    setMessage("");
    setError("");
  }
  function add(checkout: boolean) {
    if (lock.current || !valid || needsVariant || available < 1) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    setError("");
    let navigating = false;
    try {
      cart.add(
        {
          productId: product.id,
          variantId: variant?.id,
          variantName: variant?.name,
          slug: product.slug,
          name: product.name,
          imageUrl:
            product.images?.find(
              (image) => variant && image.variantId === variant.id,
            )?.url || product.imageUrl,
          quantity: count,
          price,
        },
        available,
      );
      setMessage(
        `${count} ${count === 1 ? "item" : "items"} added to your cart.`,
      );
      setQuantity("1");
      if (checkout) {
        router.push("/checkout");
        navigating = true;
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update your cart. Please try again.",
      );
    } finally {
      if (!navigating) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <div className="purchase-actions">
      <div className="pdp-price-block">
        <div className="pdp-price-line">
          <span className="purchase-price">
            {needsVariant && variants.length > 1 ? "From " : ""}
            {money(
              needsVariant ? Math.min(...variants.map((v) => v.price)) : price,
            )}
          </span>
          {saving > 0 && (
            <span className="pdp-discount">
              {Math.round((saving / compare!) * 100)}% off
            </span>
          )}
        </div>
        {saving > 0 && (
          <p className="pdp-savings">
            <del>{money(compare!)}</del>
            <span>You save {money(saving)}</span>
          </p>
        )}
        <p className="pdp-price-note">
          Delivery charges and any applicable tax are shown at checkout.
        </p>
      </div>
      <p
        className={`pdp-availability ${totalStock < 1 || (!needsVariant && available < 1) ? "unavailable" : ""}`}
        role="status"
      >
        <span aria-hidden="true">●</span>{" "}
        {totalStock < 1
          ? "Currently out of stock"
          : needsVariant
            ? "Choose an option to check availability"
            : available < 1
              ? "This option is out of stock"
              : available <= 5
                ? `Only ${available} left in stock`
                : "In stock and ready to order"}
      </p>
      {variants.length > 0 && (
        <fieldset className="pdp-variants">
          <legend>
            Choose an option{variant && <span>: {variant.name}</span>}
          </legend>
          <div className="pdp-option-grid">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                className="pdp-option"
                aria-pressed={v.id === variantId}
                disabled={v.availableStock < 1}
                onClick={() => chooseVariant(v.id)}
              >
                <strong>{v.name}</strong>
                <small>
                  {v.availableStock > 0 ? money(v.price) : "Out of stock"}
                </small>
              </button>
            ))}
          </div>
          {needsVariant && (
            <p className="muted small">
              Select an available option before adding to your bag.
            </p>
          )}
        </fieldset>
      )}
      {variant?.attributes && Object.keys(variant.attributes).length > 0 && (
        <dl className="pdp-variant-facts">
          {Object.entries(variant.attributes).map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {(variant?.sku || product.sku) && (
        <p className="pdp-sku">SKU: {variant?.sku || product.sku}</p>
      )}
      <div className="pdp-buy-controls">
        <label htmlFor="product-quantity">Quantity</label>
        <div className="pdp-quantity-row">
          <div className="pdp-stepper">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={needsVariant || count <= 1 || !valid || busy}
              onClick={() => changeQuantity(String(count - 1))}
            >
              −
            </button>
            <input
              id="product-quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={limit || 1}
              step={1}
              value={quantity}
              disabled={needsVariant || limit < 1 || busy}
              aria-invalid={Boolean(quantityError)}
              aria-describedby="quantity-help"
              onChange={(event) => changeQuantity(event.target.value)}
              onBlur={() => {
                if (!valid && limit > 0 && !needsVariant)
                  changeQuantity(
                    String(
                      Math.max(
                        1,
                        Math.min(
                          limit,
                          Number.isFinite(count) ? Math.floor(count) : 1,
                        ),
                      ),
                    ),
                  );
              }}
            />
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={needsVariant || !valid || count >= limit || busy}
              onClick={() => changeQuantity(String(count + 1))}
            >
              +
            </button>
          </div>
          {inCart > 0 && (
            <span className="small muted">{inCart} already in your cart</span>
          )}
        </div>
        <p
          id="quantity-help"
          className={quantityError ? "pdp-inline-error" : "muted small"}
        >
          {quantityError ||
            (!needsVariant && available > 0 && limit === 0
              ? "All available stock is already in your cart."
              : "Stock and prices are checked again at checkout.")}
        </p>
        <div className="pdp-primary-actions">
          <button
            type="button"
            className="primary-button"
            disabled={busy || !valid || needsVariant || available < 1}
            onClick={() => add(false)}
          >
            {busy
              ? "Adding…"
              : available < 1 && !needsVariant
                ? "Out of stock"
                : "Add to cart"}
          </button>
          <button
            type="button"
            className="secondary-button pdp-buy-now"
            disabled={busy || !valid || needsVariant || available < 1}
            onClick={() => add(true)}
          >
            Buy now <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true">
        {message && (
          <p className="pdp-cart-success">
            ✓ {message} <Link href="/cart">View cart →</Link>
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
      <div className="pdp-secondary-actions">
        <div>
          <WishlistButton product={product} />
        </div>
        <ShareProduct name={product.name} />
      </div>
    </div>
  );
}
function ShareProduct({ name }: { name: string }) {
  const [notice, setNotice] = useState("");
  return (
    <div>
      <button
        type="button"
        className="secondary-button"
        onClick={async () => {
          try {
            if (navigator.share)
              await navigator.share({ title: name, url: window.location.href });
            else {
              await navigator.clipboard.writeText(window.location.href);
              setNotice("Product link copied.");
            }
          } catch (error) {
            if (!(error instanceof Error && error.name === "AbortError"))
              setNotice(
                "Unable to share. Copy the link from your address bar.",
              );
          }
        }}
      >
        Share ↗
      </button>
      <span className="small" role="status">
        {notice}
      </span>
    </div>
  );
}
