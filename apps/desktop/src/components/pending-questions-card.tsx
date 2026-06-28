import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionDraft } from "@/hooks/useDesktopRuntime";
import {
  DESKTOP_CHROME_TOGGLE_ICON_BTN,
  DESKTOP_FORM_INPUT_SHELL,
  DESKTOP_FORM_TEXTAREA_INNER,
  instantHoverMotionClass,
} from "@/lib/desktop-chrome";
import { cn } from "@/lib/utils";
import type { AskQuestionsQuestionSpec, PendingQuestionsSnapshot } from "@/types";

const questionOptionClass = cn(
  "rounded-xl border px-3 py-2.5 text-left outline-none transition-none",
  instantHoverMotionClass,
  "active:!translate-y-0",
);

type PendingQuestionsCardProps = {
  pendingQuestions: PendingQuestionsSnapshot;
  questionDrafts: Record<string, QuestionDraft>;
  questionsBusy: boolean;
  onUpdateDraft(
    questionId: string,
    updater: (draft: QuestionDraft) => QuestionDraft,
  ): void;
  onSubmitQuestions(): void;
  onSkipQuestions(): void;
};

function emptyQuestionDraft(): QuestionDraft {
  return {
    selectedOptionIds: [],
    customText: "",
  };
}

export function PendingQuestionsCard({
  pendingQuestions,
  questionDrafts,
  questionsBusy,
  onUpdateDraft,
  onSubmitQuestions,
  onSkipQuestions,
}: PendingQuestionsCardProps) {
  const { t } = useTranslation();
  const questions = pendingQuestions.request.questions;
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [pendingQuestions.toolCallId]);

  const question = questions[currentIndex];
  if (!question) {
    return null;
  }

  const draft = questionDrafts[question.id] ?? emptyQuestionDraft();
  const isLastQuestion = currentIndex >= questions.length - 1;

  const handleContinue = () => {
    if (!isLastQuestion) {
      setCurrentIndex((index) => Math.min(index + 1, questions.length - 1));
      return;
    }
    onSubmitQuestions();
  };

  const handleSingleSelect = (optionId: string) => {
    onUpdateDraft(question.id, (current) => ({
      ...current,
      selectedOptionIds: [optionId],
    }));

    if (!isLastQuestion) {
      setCurrentIndex((current) => Math.min(current + 1, questions.length - 1));
    }
  };

  const handleMultiSelectToggle = (optionId: string) => {
    onUpdateDraft(question.id, (current) => {
      const selected = current.selectedOptionIds.includes(optionId);
      const next = selected
        ? current.selectedOptionIds.filter((item) => item !== optionId)
        : [...current.selectedOptionIds, optionId];
      return {
        ...current,
        selectedOptionIds: Array.from(new Set(next)),
      };
    });
  };

  return (
    <Card className="gap-0 border-border/50 bg-background/55 py-0 text-sm shadow-sm backdrop-blur-xl dark:border-white/12 supports-[backdrop-filter]:bg-background/40">
      <CardHeader className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <CardTitle className="min-w-0 flex-1 truncate text-sm leading-tight">
            {question.title}
          </CardTitle>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn(DESKTOP_CHROME_TOGGLE_ICON_BTN, "text-muted-foreground")}
              disabled={questionsBusy || currentIndex <= 0}
              onClick={() => setCurrentIndex((index) => Math.max(index - 1, 0))}
            >
              <ChevronLeft />
              <span className="sr-only">{t("app.previousQuestion")}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn(DESKTOP_CHROME_TOGGLE_ICON_BTN, "text-muted-foreground")}
              disabled={questionsBusy || currentIndex >= questions.length - 1}
              onClick={() =>
                setCurrentIndex((index) => Math.min(index + 1, questions.length - 1))
              }
            >
              <ChevronRight />
              <span className="sr-only">{t("app.nextQuestion")}</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-1.5 px-3 pb-2 pt-0">
        {question.options.length > 0 ? (
          <div className="grid gap-1.5">
            {question.options.map((option) => {
              const selected = question.allowMultiple
                ? draft.selectedOptionIds.includes(option.id)
                : draft.selectedOptionIds[0] === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    questionOptionClass,
                    selected
                      ? "border-primary/60 bg-primary/8"
                      : "border-border/60 bg-card/70 hover:bg-foreground/[0.06] dark:hover:bg-foreground/10",
                  )}
                  disabled={questionsBusy}
                  onClick={() =>
                    question.allowMultiple
                      ? handleMultiSelectToggle(option.id)
                      : handleSingleSelect(option.id)
                  }
                >
                  <div className="space-y-0.5">
                    <span className="font-medium">{option.label}</span>
                    {option.summary ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {option.summary}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className={cn("space-y-1", question.options.length > 0 && "mt-2.5")}>
          <Label htmlFor={`${question.id}-custom`} className="text-xs">
            {t("app.customAnswer")}
          </Label>
          <div className={DESKTOP_FORM_INPUT_SHELL}>
            <Textarea
              id={`${question.id}-custom`}
              value={draft.customText}
              onChange={(event) =>
                onUpdateDraft(question.id, (current) => ({
                  ...current,
                  customText: event.target.value,
                }))
              }
              placeholder={t("app.customAnswerPlaceholder")}
              className={cn(DESKTOP_FORM_TEXTAREA_INNER, "min-h-20")}
              disabled={questionsBusy}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-2 text-muted-foreground hover:bg-foreground/[0.06] dark:hover:bg-foreground/10",
              instantHoverMotionClass,
              "active:!translate-y-0",
            )}
            disabled={questionsBusy}
            onClick={() => onSkipQuestions()}
          >
            {t("app.skip")}
          </Button>
          <Button
            type="button"
            size="sm"
            className={cn("h-8 min-w-20", instantHoverMotionClass, "active:!translate-y-0")}
            disabled={questionsBusy}
            onClick={handleContinue}
          >
            {questionsBusy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {t("app.continue")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
