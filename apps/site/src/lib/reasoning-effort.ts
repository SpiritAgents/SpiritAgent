import type { DesktopModelReasoningEffort } from "@/types/spirit-desktop";

export function modelReasoningEffortLabel(effort: DesktopModelReasoningEffort | undefined): string {
  if (!effort) {
    return "Default";
  }
  switch (effort) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    default:
      return effort;
  }
}

export function modelReasoningEffortOptions(_input: {
  provider?: string;
  model?: string;
  supportedEfforts?: DesktopModelReasoningEffort[];
  transportKind?: string;
}): Array<{ value: DesktopModelReasoningEffort; label: string }> {
  return [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ];
}
