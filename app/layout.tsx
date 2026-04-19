import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Skolskribenten",
    template: "%s | Skolskribenten",
  },
  description:
    "Skolskribenten hjälper svenska lärare att skriva pedagogisk dokumentation med GDPR-säker struktur.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
