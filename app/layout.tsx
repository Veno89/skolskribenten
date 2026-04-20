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
      <body>
        <a
          href="#main-content"
          className="sr-only fixed left-4 top-4 z-[1000] rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--ss-neutral-900)] shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-[var(--ss-primary)] focus:ring-offset-2"
        >
          Hoppa till innehållet
        </a>
        {children}
      </body>
    </html>
  );
}
