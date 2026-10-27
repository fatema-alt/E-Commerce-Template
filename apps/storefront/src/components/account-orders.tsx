"use client";
import Link from "next/link";
import { OrderDetails } from "./order-details";
import { statusLabel } from "./shopping-ui";
import { useSearchParams } from "next/navigation";
import { NewsletterPreferences } from "./newsletter";
import { useEffect, useRef, useState } from "react";
import {
  money,
  shopRequest,
  type Order,
  type Shopper,
} from "../lib/shop-client";
export function Account() {
  const [user, setUser] = useState<Shopper | null>(null);
  const [loading, setLoading] = useState(true);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    shopRequest<{ user: Shopper | null }>("me")
      .then((result) => {
        if (live) setUser(result.user);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <main id="main" className="container main-content account-page">
      <h1>{user ? `Welcome, ${user.firstName}` : "Your account"}</h1>
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="shop-success">
          {notice}
        </p>
      )}
      {loading ? (
        <p>Checking your account…</p>
      ) : user ? (
        <>
          <div className="shop-panel">
            <p>{user.email}</p>
            <div className="action-row">
              <Link className="primary-button" href="/orders">
                Your orders
              </Link>
              <Link className="secondary-button" href="/wishlist">
                Wishlist
              </Link>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await shopRequest("logout", {});
                    setUser(null);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Sign out
              </button>
            </div>
          </div>
          <form
            className="shop-panel"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = new FormData(form);
              setBusy(true);
              setError("");
              try {
                await shopRequest("password", {
                  currentPassword: data.get("currentPassword"),
                  newPassword: data.get("newPassword"),
                });
                setNotice(
                  "Password updated. Other sessions have been signed out.",
                );
                form.reset();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>Change password</h2>
            <fieldset disabled={busy}>
              <label>
                Current password
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={256}
                />
              </label>
              <label>
                New password
                <input
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={256}
                  required
                />
              </label>
              <button className="primary-button">Update password</button>
            </fieldset>
          </form>
          <NewsletterPreferences />
        </>
      ) : (
        <form
          className="shop-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              const result = await shopRequest<{ user: Shopper }>(
                register ? "register" : "login",
                {
                  email: data.get("email"),
                  password: data.get("password"),
                  ...(register ? { name: data.get("name") } : {}),
                },
              );
              setUser(result.user);
              setNotice("You are signed in.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>{register ? "Create an account" : "Sign in"}</h2>
          <fieldset disabled={busy}>
            {register && (
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={120}
                  required
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={12}
                maxLength={256}
                required
              />
            </label>
            <p className="muted small">Use at least 12 characters.</p>
            <button className="primary-button">
              {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
            </button>
          </fieldset>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </button>
          <p className="small">
            Need account help? <Link href="/contact">Contact the store</Link>.
          </p>
        </form>
      )}
      <p>
        <Link href="/orders">Track an order placed on this browser →</Link>
      </p>
    </main>
  );
}
export function OrderHistory({ id }: { id?: string }) {
  const searchParams = useSearchParams();
  const paymentQuery = searchParams.get("payment");

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const paymentLock = useRef(false);
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        if (id) {
          const result = await shopRequest<Order>("orders/" + id);
          if (live) {
            setOrder(result);
            setError("");
          }
        } else {
          const result = await shopRequest<{ items: Order[]; total: number }>(
            `orders?page=${page}`,
          );
          if (live) {
            setError("");
            setItems(result.items);
            setTotal(result.total);
          }
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setLoading(false);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [id, page]);
  return (
    <main id="main" className="container main-content shopping-page">
      <p>
        <Link href="/account">Account</Link> /{" "}
        <Link href="/orders">Orders</Link>
      </p>
      <h1>{id ? "Order details" : "Your orders"}</h1>
      {loading && <p role="status">Loading orders…</p>}
      {error && (
        <div role="alert" className="shop-error">
          {error}
          <p>
            <Link href="/account">Sign in</Link>, or use the same browser you
            used at checkout.
          </p>
        </div>
      )}
      {paymentQuery === "success" && (
        <div
          role="status"
          className="shop-success"
          style={{ marginBottom: "1rem" }}
        >
          Payment gateway returned. The verified payment status is shown on your
          order below.
        </div>
      )}
      {(paymentQuery === "failed" || paymentQuery === "initiate_failed") && (
        <div
          role="alert"
          className="shop-error"
          style={{ marginBottom: "1rem" }}
        >
          Payment could not be completed. Review your payment status and retry
          below if payment is still due.
        </div>
      )}
      {order && order.id === id && (
        <OrderDetails
          order={order}
          paymentAction={
            order.paymentStatus === "UNPAID" &&
            !["CANCELLED", "RETURNED"].includes(order.status) &&
            (order.paymentMethod === "BKASH" ||
              order.paymentMethod === "SSLCOMMERZ") && (
              <div style={{ margin: "1rem 0" }}>
                <button
                  type="button"
                  className="primary-button"
                  disabled={paying}
                  onClick={async () => {
                    if (paymentLock.current) return;
                    paymentLock.current = true;
                    setPaying(true);
                    try {
                      const res = await shopRequest<{ redirectUrl: string }>(
                        "payments/initiate",
                        {
                          orderId: order.id,
                          method: order.paymentMethod,
                        },
                      );
                      if (res.redirectUrl) {
                        window.location.href = res.redirectUrl;
                      }
                    } catch (payErr) {
                      setError(
                        (payErr as Error).message ||
                          "Payment initiation failed",
                      );
                    } finally {
                      paymentLock.current = false;
                      setPaying(false);
                    }
                  }}
                >
                  {paying
                    ? "Connecting to gateway…"
                    : `Complete Payment with ${order.paymentMethod === "BKASH" ? "bKash" : "SSLCommerz"} (${money(order.grandTotal)})`}
                </button>
              </div>
            )
          }
        />
      )}
      {!id && !loading && !error && (
        <>
          <div className="order-list">
            {items.map((item) => (
              <Link
                className="shop-panel"
                key={item.id}
                href={`/orders/${item.id}`}
              >
                <strong>
                  {item.orderNumber && item.orderNumber.length < 30
                    ? item.orderNumber
                    : `#${item.id.slice(-12).toUpperCase()}`}
                </strong>
                <p>
                  {statusLabel(item.status)} · {money(item.grandTotal)}
                </p>
                <span className="small muted">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
          {!items.length && (
            <div className="empty-content">
              No orders yet. <Link href="/shop">Start shopping →</Link>
            </div>
          )}
          <div className="action-row">
            <button
              className="secondary-button"
              disabled={page === 1}
              onClick={() => {
                setLoading(true);
                setPage((p) => p - 1);
              }}
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              className="secondary-button"
              disabled={page * 20 >= total}
              onClick={() => {
                setLoading(true);
                setPage((p) => p + 1);
              }}
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}
