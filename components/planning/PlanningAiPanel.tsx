import { DocumentRenderer } from "@/components/drafting/DocumentRenderer";
import { PlanningInlineMessage } from "@/components/planning/PlanningInlineMessage";
import type { PlanningWorkspaceMessage } from "@/components/planning/types";
import { Button } from "@/components/ui/button";

interface Props {
  aiPrompt: string;
  copyMessage: PlanningWorkspaceMessage | null;
  directCompletion: string;
  directError?: Error;
  isDirectLoading: boolean;
  onCopyGeneratedPlan: () => void;
  onCopyPrompt: () => void;
  onGenerateDirectly: () => void;
}

export function PlanningAiPanel({
  aiPrompt,
  copyMessage,
  directCompletion,
  directError,
  isDirectLoading,
  onCopyGeneratedPlan,
  onCopyPrompt,
  onGenerateDirectly,
}: Props): JSX.Element {
  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={onCopyPrompt}>
          Kopiera AI-underlag
        </Button>
        <Button type="button" onClick={onGenerateDirectly} disabled={isDirectLoading}>
          {isDirectLoading ? "Genererar..." : "Generera direkt här"}
        </Button>
      </div>

      {copyMessage ? <PlanningInlineMessage message={copyMessage.message} tone={copyMessage.tone} /> : null}

      <label className="mt-4 block text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        AI-underlag (för direkt planeringsförslag eller Skrivstationens &quot;Eget dokument&quot;)
      </label>
      <textarea
        readOnly
        value={aiPrompt}
        className="mt-2 min-h-40 w-full rounded-lg border border-[var(--ss-neutral-200)] bg-white px-3 py-2 text-xs leading-6"
      />

      {directError ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Något gick fel vid direktgenerering: {directError.message}
        </p>
      ) : null}

      {directCompletion ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--ss-neutral-900)]">Planeringsförslag</p>
              <p className="text-xs leading-6 text-muted-foreground">
                AI-svaret renderas som ett planeringsutkast i stället för som rå text.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={onCopyGeneratedPlan}>
              Kopiera planeringsförslag
            </Button>
          </div>

          <div className="mt-3">
            <DocumentRenderer content={directCompletion} templateType="lektionsplanering" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
