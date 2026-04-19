import type { Profile } from "@/types";

const FREE_LIMIT = 10;

interface Props {
  profile: Profile;
}

export function UsageCounter({ profile }: Props): JSX.Element {
  const isPro =
    profile.subscription_status === "pro" &&
    (profile.subscription_end_date === null ||
      new Date(profile.subscription_end_date) > new Date());

  if (isPro) {
    const label =
      profile.subscription_end_date === null
        ? "Pro - obegränsade omvandlingar"
        : `30-dagarskort aktivt till ${new Intl.DateTimeFormat("sv-SE").format(
            new Date(profile.subscription_end_date),
          )}`;

    return (
      <div className="rounded-full bg-[var(--ss-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--ss-neutral-900)]">
        {label}
      </div>
    );
  }

  return (
    <div className="rounded-full bg-[var(--ss-neutral-100)] px-3 py-1.5 text-xs text-[var(--ss-neutral-800)]">
      {profile.transforms_used_this_month} av {FREE_LIMIT} gratis omvandlingar använda
    </div>
  );
}
