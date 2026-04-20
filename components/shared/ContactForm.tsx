"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORT_TOPICS } from "@/lib/support/schema";

const RECIPIENT = "kontakt@skolskribenten.com";

type SubmissionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function ContactForm(): JSX.Element {
  const [topic, setTopic] = useState<(typeof SUPPORT_TOPICS)[number]>("Allmän fråga");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>({ status: "idle" });

  const resetForm = () => {
    setTopic("Allmän fråga");
    setName("");
    setEmail("");
    setRole("");
    setMessage("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmissionState({ status: "idle" });

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          message,
          name,
          role,
          topic,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setSubmissionState({
          status: "error",
          message: payload.error ?? "Vi kunde inte ta emot meddelandet just nu. Försök igen om en stund.",
        });
        return;
      }

      resetForm();
      setSubmissionState({
        status: "success",
        message: payload.message ?? "Tack. Ditt meddelande är mottaget.",
      });
    } catch {
      setSubmissionState({
        status: "error",
        message: "Vi kunde inte nå supportformuläret just nu. Försök igen om en stund.",
      });
    } finally {
      setIsSubmitting(false);
    }
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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
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
            onChange={(event) => setTopic(event.target.value as (typeof SUPPORT_TOPICS)[number])}
            disabled={isSubmitting}
            className="flex h-12 w-full rounded-2xl border border-input bg-[var(--ss-neutral-50)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {SUPPORT_TOPICS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
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
            disabled={isSubmitting}
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
          disabled={isSubmitting}
          rows={7}
          className="rounded-[1.5rem] bg-[var(--ss-neutral-50)]"
          placeholder="Berätta gärna vad du testar, vad som fungerade och vad som känns oklart."
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-7 text-muted-foreground">
          Formuläret skickas till vår server och läggs i supportinkorgen utan att du behöver en lokal
          e-postklient. Du kan fortfarande skriva direkt till {RECIPIENT} om du föredrar vanlig e-post.
        </p>
        <Button type="submit" className="rounded-full px-6" disabled={isSubmitting}>
          {isSubmitting ? "Skickar..." : "Skicka meddelande"}
        </Button>
      </div>

      {submissionState.status === "success" ? (
        <div
          aria-live="polite"
          className="rounded-[1.25rem] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {submissionState.message}
        </div>
      ) : null}

      {submissionState.status === "error" ? (
        <div
          aria-live="polite"
          className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {submissionState.message}
        </div>
      ) : null}
    </form>
  );
}
