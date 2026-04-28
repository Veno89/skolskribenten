const skeletonRows = ["w-3/4", "w-full", "w-5/6"];

export function DashboardLoadingState(): JSX.Element {
  return (
    <main
      id="main-content"
      aria-busy="true"
      className="mx-auto min-h-[calc(100vh-5rem)] max-w-6xl px-6 py-12 lg:px-8"
    >
      <section className="rounded-lg border border-[var(--ss-neutral-200)] bg-white p-6 shadow-sm md:p-8">
        <div className="h-4 w-36 animate-pulse rounded-full bg-[var(--ss-primary-light)]" />
        <div className="mt-5 h-8 w-72 max-w-full animate-pulse rounded-md bg-[var(--ss-neutral-100)]" />
        <div className="mt-4 grid gap-3">
          {skeletonRows.map((width) => (
            <div
              key={width}
              className={`${width} h-3 animate-pulse rounded-full bg-[var(--ss-neutral-100)]`}
            />
          ))}
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-lg border border-[var(--ss-neutral-100)] bg-[var(--ss-neutral-50)]"
            />
          ))}
        </div>
      </section>
    </main>
  );
}
