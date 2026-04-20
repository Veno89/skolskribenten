import type { Metadata } from "next";
import { KontoClient } from "@/app/(dashboard)/konto/KontoClient";
import { loadDashboardProfile } from "@/lib/dashboard/load-dashboard-profile";

export const metadata: Metadata = {
  title: "Konto",
  description: "Hantera ditt abonnemang, se användning och uppgradera till Pro.",
};

interface Props {
  searchParams?: {
    payment?: string | string[];
  };
}

export default async function KontoPage({ searchParams }: Props): Promise<JSX.Element> {
  const { profile } = await loadDashboardProfile({ nextPath: "/konto" });

  const paymentParam = Array.isArray(searchParams?.payment)
    ? searchParams.payment[0]
    : searchParams?.payment;
  const paymentStatus =
    paymentParam === "success" || paymentParam === "cancelled" ? paymentParam : null;

  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-6xl px-6 py-16 lg:px-8">
      <KontoClient profile={profile!} paymentStatus={paymentStatus} />
    </main>
  );
}
