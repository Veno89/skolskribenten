"use client";

import { type FormEvent, useEffect, useState } from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORT_TOPICS } from "@/lib/support/schema";

const RECIPIENT = "kontakt@skolskribenten.com";

declare global {
  interface Window {
    __skolskribentenTurnstileError?: () => void;
    __skolskribentenTurnstileExpired?: () => void;
    __skolskribentenTurnstileSuccess?: (token: string) => void;
    turnstile?: {
      reset: () => void;
    };
  }
}

type SubmissionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

interface ContactFormProps {
  nonce?: string;
}

export function ContactForm({ nonce }: ContactFormProps): JSX.Element {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [topic, setTopic] = useState<(typeof SUPPORT_TOPICS)[number]>("Allmän fråga");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>({ status: "idle" });
  const captchaRequired = Boolean(turnstileSiteKey);

  useEffect(() => {
    window.__skolskribentenTurnstileSuccess = (token: string) => setCaptchaToken(token);
    window.__skolskribentenTurnstileExpired = () => setCaptchaToken("");
    window.__skolskribentenTurnstileError = () => setCaptchaToken("");

    return () => {
      delete window.__skolskribentenTurnstileSuccess;
      delete window.__skolskribentenTurnstileExpired;
      delete window.__skolskribentenTurnstileError;
    };
  }, []);

  const resetForm = () => {
    setTopic("Allmän fråga");
    setName("");
    setEmail("");
    setRole("");
    setMessage("");
    setWebsite("");
    setCaptchaToken("");
    window.turnstile?.reset();
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
          captchaToken,
          message,
          name,
          role,
          topic,
          website,
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
      <div aria-hidden="true" className="sr-only">
        <label htmlFor="contact-website">Lämna det här fältet tomt</label>
        <Input
          id="contact-website"
          name="website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          autoComplete="off"
          tabIndex={-1}
        />
      </div>

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
          e-postklient. Skriv inte elevnamn, personnummer eller fulla råanteckningar här. Du kan
          fortfarande skriva direkt till {RECIPIENT} om du föredrar vanlig e-post.
        </p>
        <div className="flex flex-col items-start gap-3 md:items-end">
          {turnstileSiteKey ? (
            <>
              <Script
                nonce={nonce}
                src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                strategy="lazyOnload"
              />
              <div
                className="cf-turnstile"
                data-sitekey={turnstileSiteKey}
                data-callback="__skolskribentenTurnstileSuccess"
                data-expired-callback="__skolskribentenTurnstileExpired"
                data-error-callback="__skolskribentenTurnstileError"
              />
            </>
          ) : null}
          <Button
            type="submit"
            className="rounded-full px-6"
            disabled={isSubmitting || (captchaRequired && !captchaToken)}
          >
            {isSubmitting ? "Skickar..." : "Skicka meddelande"}
          </Button>
        </div>
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
