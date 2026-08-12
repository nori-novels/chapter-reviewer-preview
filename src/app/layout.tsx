import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/Toast/Toast";

export const metadata: Metadata = {
  title: "Chapter Reviewer Preview",
  description: "Public static preview of the Nori Novels chapter reviewer",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
