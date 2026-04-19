import type { TemplateType as AiTemplateType } from "@/lib/ai/provider";
import type { Database } from "@/types/database";

export type TemplateType = AiTemplateType;
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface ScrubberStats {
  namesReplaced: number;
  piiTokensReplaced: number;
}
