"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function MobileNav(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  // Close menu when the route changes or pressing escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscape);
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Öppna meny"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ss-neutral-900)] hover:bg-[var(--ss-neutral-100)]"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" x2="20" y1="12" y2="12" />
          <line x1="4" x2="20" y1="6" y2="6" />
          <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--ss-neutral-50)]">
          <div className="flex items-center justify-end px-6 py-6 sm:px-10">
            <button
              type="button"
              aria-label="Stäng meny"
              onClick={() => setIsOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ss-neutral-900)] hover:bg-[var(--ss-neutral-100)]"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <nav className="flex flex-1 flex-col items-center justify-center gap-8 pb-20">
            <Link
              href="/om-oss"
              onClick={() => setIsOpen(false)}
              className="text-2xl font-medium text-[var(--ss-neutral-900)] transition-colors hover:text-[var(--ss-primary)]"
            >
              Om oss
            </Link>
            <Link
              href="/vanliga-fragor"
              onClick={() => setIsOpen(false)}
              className="text-2xl font-medium text-[var(--ss-neutral-900)] transition-colors hover:text-[var(--ss-primary)]"
            >
              Vanliga frågor
            </Link>
            <Link
              href="/kontakt"
              onClick={() => setIsOpen(false)}
              className="text-2xl font-medium text-[var(--ss-neutral-900)] transition-colors hover:text-[var(--ss-primary)]"
            >
              Kontakt
            </Link>
            <div className="mt-8 flex flex-col items-center gap-4">
              <Button asChild variant="outline" className="w-48 rounded-full">
                <Link href="/logga-in" onClick={() => setIsOpen(false)}>
                  Logga in
                </Link>
              </Button>
              <Button asChild className="w-48 rounded-full">
                <Link href="/registrera" onClick={() => setIsOpen(false)}>
                  Prova gratis
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
