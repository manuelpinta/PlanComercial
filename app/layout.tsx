import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plan Comercial · Pinta",
  description: "Plan de acciones comerciales con histórico en MySQL",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
