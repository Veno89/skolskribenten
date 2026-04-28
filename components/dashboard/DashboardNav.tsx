"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { UsageCounter } from "@/components/drafting/UsageCounter";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types";

interface Props {
  isAppAdmin?: boolean;
  profile: Profile;
}

export function DashboardNav({ isAppAdmin = false, profile }: Props): JSX.Element {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const primaryLinks = [
    { href: "/skrivstation", label: "Skrivstation" },
    { href: "/lektionsplanering", label: "Lektioner" },
    { href: "/installningar", label: "Inställningar" },
    { href: "/konto", label: "Konto" },
  ];
  const adminLinks = isAppAdmin
    ? [
        { href: "/admin/support", label: "Support" },
        { href: "/admin/planning-sync", label: "Sync" },
        { href: "/admin/ai-governance", label: "AI" },
        { href: "/admin/account-requests", label: "Konton" },
      ]
    : [];
  const navLinks = [...primaryLinks, ...adminLinks];

  const renderNavLink = (link: { href: string; label: string }, className = "rounded-full") => (
    <Button
      key={link.href}
      asChild
      variant={pathname === link.href ? "default" : "outline"}
      size="sm"
      className={className}
    >
      <Link href={link.href} onClick={() => setIsMenuOpen(false)}>
        {link.label}
      </Link>
    </Button>
  );

  return (
    <nav className="mb-4 border-b bg-white/80 px-4 py-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <Link href="/skrivstation" className="flex shrink-0 items-center gap-2 md:mr-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ss-primary)] text-white">
            <span className="text-sm font-bold">S</span>
          </div>
          <span className="hidden text-sm tracking-widest text-[var(--ss-primary)] md:block">SKOLSKRIBENTEN</span>
        </Link>

        <div className="hidden shrink-0 gap-2 md:flex">
          {navLinks.map((link) => renderNavLink(link))}
        </div>

        <div className="ml-auto hidden shrink-0 items-center justify-end gap-3 md:flex">
          <UsageCounter profile={profile} />
          <SignOutButton size="sm" variant="outline" className="rounded-full" />
        </div>

        <button
          type="button"
          aria-label={isMenuOpen ? "Stäng meny" : "Öppna meny"}
          aria-expanded={isMenuOpen}
          title={isMenuOpen ? "Stäng meny" : "Öppna meny"}
          onClick={() => setIsMenuOpen((current) => !current)}
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--ss-neutral-200)] bg-white text-[var(--ss-neutral-900)] shadow-sm md:hidden"
        >
          <span className="sr-only">{isMenuOpen ? "Stäng meny" : "Öppna meny"}</span>
          <span aria-hidden="true" className="flex flex-col gap-1">
            <span className="h-0.5 w-5 rounded-full bg-current" />
            <span className="h-0.5 w-5 rounded-full bg-current" />
            <span className="h-0.5 w-5 rounded-full bg-current" />
          </span>
        </button>
      </div>

      {isMenuOpen ? (
        <div className="mt-4 grid gap-3 rounded-lg border border-[var(--ss-neutral-200)] bg-white p-3 shadow-sm md:hidden">
          <div className="grid gap-2">
            {navLinks.map((link) => renderNavLink(link, "w-full justify-start rounded-lg"))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ss-neutral-100)] pt-3">
            <UsageCounter profile={profile} />
            <SignOutButton size="sm" variant="outline" className="rounded-full" />
          </div>
        </div>
      ) : null}
    </nav>
  );
}
