import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { themeScript } from "@/lib/theme-init";
import "./globals.css";

// AdminShell waits for a browser-side session check before rendering children.
// Routes behind this gate cannot provide an instant static shell.
export const instant = false;

export const metadata: Metadata = {
  title: "Commerce Suite Admin",
  description: "Commerce Suite Administration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Suspense
          fallback={
            <div className="p-6 text-sm text-slate-500">Loading admin...</div>
          }
        >
          <AdminShell>{children}</AdminShell>
        </Suspense>
      </body>
    </html>
  );
}
