"use client";

import dynamic from "next/dynamic";

interface Props {
  cloudSyncEnabled: boolean;
  userId: string;
}

const LazyPlanningWorkspace = dynamic(
  () => import("@/components/planning/PlanningWorkspace").then((mod) => mod.PlanningWorkspace),
  {
    loading: () => <PlanningWorkspaceLoading />,
    ssr: false,
  },
);

function PlanningWorkspaceLoading(): JSX.Element {
  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-6xl px-6 py-10 lg:px-8">
      <section className="ss-card p-6 md:p-8" aria-busy="true" aria-live="polite">
        <div className="h-4 w-44 animate-pulse rounded-full bg-[var(--ss-primary-light)]" />
        <div className="mt-4 h-8 w-72 max-w-full animate-pulse rounded-lg bg-[var(--ss-neutral-100)]" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="h-24 animate-pulse rounded-lg bg-[var(--ss-neutral-100)]" />
          <div className="h-24 animate-pulse rounded-lg bg-[var(--ss-neutral-100)]" />
          <div className="h-24 animate-pulse rounded-lg bg-[var(--ss-neutral-100)]" />
        </div>
        <div className="mt-6 h-64 animate-pulse rounded-lg bg-[var(--ss-neutral-100)]" />
      </section>
    </main>
  );
}

export function PlanningWorkspaceLoader(props: Props): JSX.Element {
  return <LazyPlanningWorkspace {...props} />;
}
