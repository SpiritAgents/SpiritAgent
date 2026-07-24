import type { DesktopAutomationTriggerFormatLabels } from "@/lib/automation-trigger";

/** 兼容 react-i18next `t` 的最小签名，避免直接依赖 TFunction 泛型。 */
export type AutomationTriggerTranslate = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export function buildAutomationTriggerFormatLabels(
  t: AutomationTriggerTranslate,
): DesktopAutomationTriggerFormatLabels {
  return {
    hourly: t("automations.schedule.hourly"),
    dailyPrefix: t("automations.schedule.daily"),
    weeklyPrefix: t("automations.schedule.weekly"),
    weekdays: [
      t("automations.schedule.weekday0"),
      t("automations.schedule.weekday1"),
      t("automations.schedule.weekday2"),
      t("automations.schedule.weekday3"),
      t("automations.schedule.weekday4"),
      t("automations.schedule.weekday5"),
      t("automations.schedule.weekday6"),
    ],
    formatWeekly: (weekday, time) => t("automations.schedule.weeklyAt", { weekday, time }),
    githubPrefix: t("automations.trigger.github"),
    githubPullRequestCreated: t("automations.trigger.pullRequestCreated"),
    githubIssueCreated: t("automations.trigger.issueCreated"),
  };
}
