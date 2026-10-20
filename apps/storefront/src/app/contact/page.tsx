import { Suspense } from "react";
import { getCmsConfig } from "../../lib/cms";
export const metadata = { title: "Contact us" };
async function Content() {
  const config = await getCmsConfig();
  const contact = config.settings.contact;
  return (
    <main id="main" className="container main-content">
      <h1>Contact {config.siteName}</h1>
      <section className="shop-panel">
        <h2>How can we help?</h2>
        <p>
          For product questions, delivery updates or account assistance, contact
          our team. Include your order number when asking about an order.
        </p>
        {contact?.email && (
          <p>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </p>
        )}
        {contact?.phone && (
          <p>
            <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>
              {contact.phone}
            </a>
          </p>
        )}
        {contact?.address && <address>{contact.address}</address>}
        {!contact?.email && !contact?.phone && (
          <p>Contact details will be available here soon.</p>
        )}
      </section>
    </main>
  );
}
export default function Page() {
  return (
    <Suspense
      fallback={
        <main id="main" className="container main-content">
          Loading contact details…
        </main>
      }
    >
      <Content />
    </Suspense>
  );
}
