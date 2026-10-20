import { CartCheckout } from "../../components/cart-checkout";
export const metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <CartCheckout />;
}
