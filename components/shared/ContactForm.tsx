"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const RECIPIENT = "kontakt@skolskribenten.com";

function buildMailtoUrl(values: {
  topic: string;
  name: string;
  email: string;
  role: string;
  message: string;
}): string {
  const subject = `[Skolskribenten] ${values.topic}`;
  const body = [
    `Namn: ${values.name}`,
    `E-post: ${values.email}`,
    `Roll/skolform: ${values.role || "[ej angivet]"}`,
    "",
    "Meddelande:",
    values.message,
  ].join("\n");

  return `mailto:${RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function ContactForm(): JSX.Element {
  const [topic, setTopic] = useState("Allmän fråga");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [opened, setOpened] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const mailtoUrl = buildMailtoUrl({
      topic,
      name,
      email,
      role,
      message,
    });

    window.location.href = mailtoUrl;
    setOpened(true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="contact-name" className="text-sm font-medium text-[var(--ss-neutral-900)]">
            Namn
          </label>
          <Input
            id="contact-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="h-12 rounded-2xl bg-[var(--ss-neutral-50)]"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="contact-email"
            className="text-sm font-medium text-[var(--ss-neutral-900)]"
          >
            E-post
          </label>
          <Input
            id="contact-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="h-12 rounded-2xl bg-[var(--ss-neutral-50)]"
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-2">
          <label
            htmlFor="contact-topic"
            className="text-sm font-medium text-[var(--ss-neutral-900)]"
          >
            Ärende
          </label>
          <select
            id="contact-topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="flex h-12 w-full rounded-2xl border border-input bg-[var(--ss-neutral-50)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option>Allmän fråga</option>
            <option>Feedback från testning</option>
            <option>Tekniskt problem</option>
            <option>Pris eller abonnemang</option>
            <option>Samarbete eller demo</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-role" className="text-sm font-medium text-[var(--ss-neutral-900)]">
            Roll eller skolform
          </label>
          <Input
            id="contact-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="Till exempel klasslärare åk 4 eller biträdande rektor"
            className="h-12 rounded-2xl bg-[var(--ss-neutral-50)]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="contact-message"
          className="text-sm font-medium text-[var(--ss-neutral-900)]"
        >
          Meddelande
        </label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          rows={7}
          className="rounded-[1.5rem] bg-[var(--ss-neutral-50)]"
          placeholder="Berätta gärna vad du testar, vad som fungerade och vad som känns oklart."
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-7 text-muted-foreground">
          Formuläret öppnar ett färdigt e-postutkast i din vanliga e-postklient. Vi sparar inte
          innehållet i appen.
        </p>
        <Button type="submit" className="rounded-full px-6">
          Öppna e-postutkast
        </Button>
      </div>

      {opened ? (
        <div className="rounded-[1.25rem] border border-[var(--ss-secondary)] bg-[var(--ss-secondary-light)] px-4 py-3 text-sm text-[var(--ss-neutral-900)]">
          E-postutkastet öppnades. Om inget hände kan du också skriva direkt till {RECIPIENT}.
        </div>
      ) : null}
    </form>
  );
}
