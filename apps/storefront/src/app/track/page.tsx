import { TrackOrder } from "../../components/track-order";
export const metadata = {
  title: "Track your order",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <TrackOrder />;
}
