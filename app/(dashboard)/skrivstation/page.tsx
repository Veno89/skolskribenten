import { redirect } from "next/navigation";
import { DraftingStation } from "@/components/drafting/DraftingStation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export default async function SkrivstationPage(): Promise<JSX.Element> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/logga-in");
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (!profile) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
        <div className="ss-card w-full p-8">
          <h1 className="text-3xl font-semibold tracking-tight">Profil hittades inte</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Vi kunde inte läsa in ditt konto ännu. Kontrollera att Supabase-migreringarna är körda
            och att profilen finns i tabellen <code>profiles</code>.
          </p>
        </div>
      </main>
    );
  }

  return <DraftingStation userProfile={profile as Profile} />;
}
