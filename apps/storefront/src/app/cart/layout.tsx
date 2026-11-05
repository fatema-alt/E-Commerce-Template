import type { ReactNode } from "react";

export const metadata = { title: "Shopping bag", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
