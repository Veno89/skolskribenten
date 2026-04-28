import { headers } from "next/headers";
import { ContactForm } from "@/components/shared/ContactForm";
import { ContentPageLayout } from "@/components/shared/ContentPageLayout";

export default function KontaktPage(): JSX.Element {
  const nonce = headers().get("x-nonce") ?? undefined;

  return (
    <ContentPageLayout
      eyebrow="Kontakt"
      title="Skicka en fråga utan att behöva leta efter rätt adress"
      intro="Här kan du skriva vad du testar, vad som skaver eller vad du vill att Skolskribenten ska kunna längre fram. Formuläret skickas direkt till vår supportinkorg från appen."
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="ss-card p-8">
          <ContactForm nonce={nonce} />
        </section>

        <aside className="space-y-6">
          <section className="ss-card p-8">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--ss-primary)]">
              Bra att skicka med
            </p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--ss-neutral-800)]">
              <p>Vilken mall du använde, till exempel Incidentrapport eller Unikum.</p>
              <p>Om något blev fel i texten, beskriv felet och vad du hade hoppats få ut utan att klistra in elevnamn eller fulla råanteckningar.</p>
              <p>Om det gäller betalning eller konto, vilket konto eller vilken e-post som används.</p>
              <p>Om något är brådskande kan du också skriva direkt till kontakt@skolskribenten.com.</p>
            </div>
          </section>

          <section className="ss-card p-8">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--ss-primary)]">
              Direktkontakt
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--ss-neutral-800)]">
              Du kan alltid skriva direkt till <strong>kontakt@skolskribenten.com</strong> om du
              föredrar vanlig e-post.
            </p>
          </section>
        </aside>
      </div>
    </ContentPageLayout>
  );
}
