import { CartCheckout } from "../../components/cart-checkout";
export const metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <CartCheckout checkout />;
}
