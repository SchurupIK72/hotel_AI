import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hotel AI Manager",
  description: "Tenant-safe staff workspace for AI hotel operations",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

