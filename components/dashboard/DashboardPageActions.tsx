"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardActionLink {
  href: string;
  label: string;
}

interface Props {
  className?: string;
  links: DashboardActionLink[];
}

export function DashboardPageActions({ className, links }: Props): JSX.Element {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {links.map((link) => (
        <Button key={link.href} asChild variant="outline" className="rounded-full">
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
      <SignOutButton className="rounded-full" />
    </div>
  );
}
