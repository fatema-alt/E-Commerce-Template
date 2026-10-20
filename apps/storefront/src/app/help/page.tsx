import Link from "next/link";
export const metadata = { title: "Shopping help" };
export default function Page() {
  return (
    <main id="main" className="container main-content">
      <h1>Shopping help</h1>
      <div className="cms-faq">
        <details open>
          <summary>How do I place an order?</summary>
          <p>
            Choose a product and variant, add it to your cart, then proceed to
            checkout. Review your delivery details and the verified order total
            before placing your order.
          </p>
        </details>
        <details>
          <summary>Can I checkout without an account?</summary>
          <p>
            Yes. Guest orders remain available on the browser used at checkout.
            Create an account before ordering if you want access from other
            devices.
          </p>
        </details>
        <details>
          <summary>How do I track my order?</summary>
          <p>
            Open <Link href="/orders">Your orders</Link> to see order status and
            shipment tracking. Sign in for account orders, or use your original
            browser for guest orders.
          </p>
        </details>
        <details>
          <summary>Which payment methods are available?</summary>
          <p>
            Checkout displays the currently available payment methods. Cash on
            Delivery is supported. Other payment methods are available only when
            enabled by the store.
          </p>
        </details>
        <details>
          <summary>Why did a cart price change?</summary>
          <p>
            Catalog prices and stock are verified at checkout. If an offer ends
            or availability changes, review the updated cart before placing your
            order.
          </p>
        </details>
        <details>
          <summary>How do I get account or order help?</summary>
          <p>
            <Link href="/contact">Contact the store</Link> with your order
            number. Never share your password.
          </p>
        </details>
      </div>
    </main>
  );
}
