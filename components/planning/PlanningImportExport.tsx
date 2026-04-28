import { type ChangeEventHandler } from "react";
import { PlanningInlineMessage } from "@/components/planning/PlanningInlineMessage";
import type { PlanningWorkspaceMessage } from "@/components/planning/types";
import { Button } from "@/components/ui/button";

interface Props {
  importMessage: PlanningWorkspaceMessage | null;
  onExport: () => void;
  onImport: ChangeEventHandler<HTMLInputElement>;
  onResetChecklist: () => void;
}

export function PlanningImportExport({
  importMessage,
  onExport,
  onImport,
  onResetChecklist,
}: Props): JSX.Element {
  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onResetChecklist}>
          Återställ checklista
        </Button>
        <Button type="button" variant="outline" onClick={onExport}>
          Exportera planeringar
        </Button>
        <label className="inline-flex">
          <input type="file" accept="application/json" className="hidden" onChange={onImport} />
          <span className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-input bg-background px-6 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
            Importera planeringar
          </span>
        </label>
      </div>
      <p className="mt-3 max-w-3xl text-xs leading-6 text-muted-foreground">
        Exporterade planeringsfiler kan innehålla egna planeringsanteckningar. Spara dem inte på
        delade enheter och importera bara filer som kommer från ditt eget Skolskribenten-konto.
      </p>
      {importMessage ? <PlanningInlineMessage message={importMessage.message} tone={importMessage.tone} /> : null}
    </div>
  );
}
