import { toProductHtml } from "@commerce/product-content";
import { money, type CheckoutMethod } from "../lib/shop-client";

export function PaymentInstructions({
  method,
  amount,
}: {
  method: CheckoutMethod;
  amount: string | number;
}) {
  return (
    <section
      className="bank-details"
      aria-label={`${method.name} instructions`}
      style={{ overflowWrap: "anywhere" }}
    >
      <strong>{method.name}</strong>
      <dl>
        {Object.entries(method.details).map(([key, value]) => (
          <div key={key}>
            <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div
        className="product-rich-content"
        dangerouslySetInnerHTML={{ __html: toProductHtml(method.instruction) }}
      />
      <p>
        Transfer {money(amount)} using the instructions above, then submit your
        reference. Your payment will await verification.
      </p>
    </section>
  );
}
