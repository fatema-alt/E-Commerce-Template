import Link from "next/link";
import type { Shopper } from "../lib/shop-client";
import { SectionCard } from "./shopping-ui";

export function CheckoutCustomerFields({
  payment,
  user,
  onCityChange,
  onDistrictChange,
}: {
  payment: boolean;
  user: Shopper | null;
  onCityChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
}) {
  return (
    <div hidden={payment} className="shopping-stack">
      <SectionCard title="Contact Information">
        {!user && (
          <p className="muted small">
            Checkout as a guest, or <Link href="/account">sign in</Link> to keep
            orders in your account.
          </p>
        )}
        <div className="form-grid">
          <label>
            Full name
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={[user?.firstName, user?.lastName]
                .filter(Boolean)
                .join(" ")}
            />
          </label>
          <label>
            Mobile number
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              pattern="(?:\+?88)?01[3-9][0-9]{8}"
              title="Enter a Bangladesh mobile number: 01712345678 or +8801712345678"
              maxLength={14}
              defaultValue={user?.phone || ""}
            />
            <small className="muted">For example, 01712345678</small>
          </label>
          <label className="full-field">
            Email address (optional)
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              defaultValue={user?.email}
            />
          </label>
        </div>
      </SectionCard>
      <SectionCard title="Delivery Address">
        <div className="form-grid">
          <label className="full-field">
            Full address
            <input
              name="address"
              autoComplete="street-address"
              required
              minLength={3}
              maxLength={240}
            />
          </label>
          <label>
            City
            <input
              name="city"
              autoComplete="address-level2"
              required
              minLength={2}
              maxLength={120}
              onChange={(e) => onCityChange(e.target.value)}
            />
          </label>
          <label>
            District
            <input
              name="district"
              required
              minLength={2}
              autoComplete="address-level1"
              maxLength={120}
              onChange={(e) => onDistrictChange(e.target.value)}
            />
          </label>
          <label>
            Postal code (optional)
            <input
              name="postalCode"
              autoComplete="postal-code"
              maxLength={20}
            />
          </label>
          <label className="full-field">
            Delivery instructions (optional)
            <textarea name="note" rows={3} maxLength={2000} />
          </label>
        </div>
      </SectionCard>
    </div>
  );
}
