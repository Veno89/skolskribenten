interface Props {
  title?: string;
}

export function MissingProfileState({
  title = "Profil hittades inte",
}: Props): JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <div className="ss-card w-full p-8">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Vi kunde inte läsa in ditt konto ännu. Kontrollera att Supabase-migreringarna är körda
          och att profilen finns i tabellen <code>profiles</code>.
        </p>
      </div>
    </main>
  );
}
