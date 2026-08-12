import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/Toast/Toast";

// Self-hosted at build time, matching the reviewer's own typography. Without
// it every sans surface silently falls back to system-ui.
const figtree = Figtree({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chapter Reviewer Preview",
  description: "Public static preview of the Nori Novels chapter reviewer",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={figtree.className}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
