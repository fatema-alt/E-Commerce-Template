import { CartCheckout } from "../../../components/cart-checkout";

export const metadata = {
  title: "Choose Your Payment Method",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <CartCheckout checkout payment />;
}
