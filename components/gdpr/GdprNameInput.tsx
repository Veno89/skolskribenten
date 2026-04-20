"use client";

import { useState } from "react";
import { mergeCustomNames, parseCustomNamesInput } from "@/lib/gdpr/custom-names";

interface Props {
  value: string[];
  onChange: (names: string[]) => void;
}

export function GdprNameInput({ value, onChange }: Props): JSX.Element {
  const [inputValue, setInputValue] = useState("");

  const addNames = (rawValue: string = inputValue) => {
    const parsedNames = parseCustomNamesInput(rawValue);

    if (parsedNames.length > 0) {
      onChange(mergeCustomNames(value, parsedNames));
    }

    setInputValue("");
  };

  const removeName = (name: string) => {
    onChange(value.filter((currentName) => currentName !== name));
  };

  return (
    <div className="border-b border-[var(--ss-neutral-200)] bg-[var(--ss-primary-light)] px-4 py-3">
      <p className="mb-2 text-xs leading-6 text-[var(--ss-neutral-800)]">
        <strong>Extra namn att skydda</strong> - lägg till namn som inte är vanliga svenska namn
        (t.ex. Mohammed, Amir, Fatima). Du kan klistra in flera namn samtidigt med kommatecken
        eller radbrytningar.
      </p>
      <div className="mb-2 flex flex-wrap gap-2">
        {value.map((name) => (
          <span
            key={name}
            className="flex items-center gap-1 rounded-full bg-[var(--ss-primary)] px-2.5 py-1 text-xs text-white"
          >
            {name}
            <button
              type="button"
              onClick={() => removeName(name)}
              className="transition-opacity hover:opacity-75"
              aria-label={`Ta bort ${name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onPaste={(event) => {
            const pastedValue = event.clipboardData.getData("text");

            if (parseCustomNamesInput(pastedValue).length > 1) {
              event.preventDefault();
              addNames(pastedValue);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addNames();
            }
          }}
          placeholder="Skriv ett namn eller klistra in flera namn"
          className="flex-1 rounded-lg border border-[var(--ss-neutral-200)] bg-white px-3 py-2 text-xs focus:border-[var(--ss-primary)] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => addNames()}
          className="rounded-lg bg-[var(--ss-primary)] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          Lägg till
        </button>
      </div>
    </div>
  );
}
