import { getUsageSummary, isActivePro } from "@/lib/billing/entitlements";
import type { Profile } from "@/types";

interface Props {
  profile: Profile;
}

export function UsageCounter({ profile }: Props): JSX.Element {
  const usageSummary = getUsageSummary(profile);

  if (isActivePro(profile)) {
    return (
      <div className="rounded-full bg-[var(--ss-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--ss-neutral-900)]">
        {usageSummary}
      </div>
    );
  }

  return (
    <div className="rounded-full bg-[var(--ss-neutral-100)] px-3 py-1.5 text-xs text-[var(--ss-neutral-800)]">
      {usageSummary}
    </div>
  );
}
