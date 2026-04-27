"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { UsageCounter } from "@/components/drafting/UsageCounter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";

interface Props {
  isAppAdmin?: boolean;
  profile: Profile;
}

export function DashboardNav({ isAppAdmin = false, profile }: Props): JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-3 py-4 px-6 mb-4 border-b">
      <div className="flex w-full items-center justify-between md:w-auto md:flex-row gap-3 overflow-x-auto pb-2 md:pb-0">
        <Link href="/skrivstation" className="flex shrink-0 items-center gap-2 mr-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ss-primary)] text-white">
            <span className="text-sm font-bold">S</span>
          </div>
          <span className="hidden text-sm tracking-widest text-[var(--ss-primary)] md:block">SKOLSKRIBENTEN</span>
        </Link>
        <div className="flex shrink-0 gap-2">
          <Button
            asChild
            variant={pathname === "/skrivstation" ? "default" : "outline"}
            size="sm"
            className="rounded-full"
          >
            <Link href="/skrivstation">Skrivstation</Link>
          </Button>
          <Button
            asChild
            variant={pathname === "/lektionsplanering" ? "default" : "outline"}
            size="sm"
            className="rounded-full"
          >
            <Link href="/lektionsplanering">Lektioner</Link>
          </Button>
          <Button
            asChild
            variant={pathname === "/installningar" ? "default" : "outline"}
            size="sm"
            className="rounded-full"
          >
            <Link href="/installningar">Inställningar</Link>
          </Button>
          <Button
            asChild
            variant={pathname === "/konto" ? "default" : "outline"}
            size="sm"
            className="rounded-full"
          >
            <Link href="/konto">Konto</Link>
          </Button>
          {isAppAdmin ? (
            <Button
              asChild
              variant={pathname === "/admin/support" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
            >
              <Link href="/admin/support">Support</Link>
            </Button>
          ) : null}
          {isAppAdmin ? (
            <Button
              asChild
              variant={pathname === "/admin/planning-sync" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
            >
              <Link href="/admin/planning-sync">Sync</Link>
            </Button>
          ) : null}
          {isAppAdmin ? (
            <Button
              asChild
              variant={pathname === "/admin/ai-governance" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
            >
              <Link href="/admin/ai-governance">AI</Link>
            </Button>
          ) : null}
          {isAppAdmin ? (
            <Button
              asChild
              variant={pathname === "/admin/account-requests" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
            >
              <Link href="/admin/account-requests">Konton</Link>
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end md:ml-auto gap-3 w-full md:w-auto">
        <UsageCounter profile={profile} />
        <SignOutButton size="sm" variant="outline" className="rounded-full" />
      </div>
    </nav>
  );
}
