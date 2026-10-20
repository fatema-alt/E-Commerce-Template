import { OrderHistory } from "../../components/account-orders";
export const metadata = {
  title: "Your orders",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <OrderHistory />;
}
