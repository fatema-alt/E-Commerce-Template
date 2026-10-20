import { Account } from "../../components/account-orders";
export const metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Account />;
}
