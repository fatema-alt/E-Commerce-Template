"use client";
import Link from "next/link";
import { BrandLogo } from "./brand-logo";
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
  const [showPassword, setShowPassword] = useState(false);
  const authLock = useRef(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
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
  useEffect(() => {
    let live = true;
    if (user)
      void shopRequest<{ items: Order[] }>("orders?page=1")
        .then((result) => {
          if (live) setRecentOrders(result.items.slice(0, 3));
        })
        .catch(() => {
          /* The orders page exposes retry and access errors. */
        });
    return () => {
      live = false;
    };
  }, [user]);
  return (
    <main
      id="main"
      className={`container main-content account-page ${user ? "account-dashboard shopping-page" : "account-auth"}`}
    >
      {user && (
        <header>
          <h1>Welcome, {user.firstName}</h1>
          <p className="muted">Manage your account and follow your orders.</p>
        </header>
      )}
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
                    setRecentOrders([]);
                    setNotice("You have been signed out.");
                    setError("");
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
          {recentOrders.length > 0 && (
            <section className="shop-panel">
              <h2>Recent orders</h2>
              <div className="account-recent-orders">
                {recentOrders.map((order) => (
                  <Link key={order.id} href={`/orders/${order.id}`}>
                    <strong>
                      {order.orderNumber.length < 30
                        ? order.orderNumber
                        : `#${order.id.slice(-12)}`}
                    </strong>
                    <span>
                      {statusLabel(order.status)} ? {money(order.grandTotal)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
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
          className="shop-panel auth-card"
          onSubmit={async (e) => {
            e.preventDefault();
            if (authLock.current) return;
            authLock.current = true;
            const data = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            setNotice("");
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
              authLock.current = false;
              setBusy(false);
            }
          }}
        >
          <Link href="/" className="auth-brand" aria-label="DS Mart homepage">
            <BrandLogo />
          </Link>
          <h1>{register ? "Create your account" : "Welcome Back"}</h1>
          <p className="muted">
            {register
              ? "Join DS Mart for easier shopping and order tracking."
              : "Sign in to your DS Mart account"}
          </p>
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
              <span className="auth-password">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  minLength={register ? 12 : undefined}
                  maxLength={256}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
            {register && (
              <p className="muted small">Use at least 12 characters.</p>
            )}
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
              setShowPassword(false);
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
