import * as React from "react";
import { Metric } from "./ui";

interface QualityScoreCardProps {
  score: number;
  previousScore?: number;
  totalItems: number;
  totalViolations: number;
}

export type ScoreTone = "success" | "warn" | "danger";

/** Health band for a 0-100 quality score: 80+ healthy, 60-79 needs attention, below 60 critical. */
export const scoreTone = (score: number): ScoreTone => {
  if (score >= 80) return "success";
  if (score >= 60) return "warn";
  return "danger";
};

/** Plain-language band so the score's meaning is never conveyed by colour alone. */
export const scoreLabel = (score: number): string => {
  switch (scoreTone(score)) {
    case "success":
      return "Good";
    case "warn":
      return "Needs work";
    default:
      return "Critical";
  }
};

export const QualityScoreCard: React.FC<QualityScoreCardProps> = ({
  score,
  previousScore,
  totalItems,
  totalViolations,
}) => {
  const trend =
    previousScore == null
      ? null
      : score > previousScore
        ? { glyph: "↑", className: "ax-delta--up", label: "up from" }
        : score < previousScore
          ? { glyph: "↓", className: "ax-delta--down", label: "down from" }
          : { glyph: "→", className: "ax-delta--flat", label: "unchanged from" };

  return (
    <div className="ax-metrics">
      <Metric
        testId="quality-score"
        label="Quality Score"
        tone={scoreTone(score)}
        value={
          <>
            {score}
            {trend && (
              <span
                className={`ax-delta ${trend.className}`}
                title={`${trend.label} ${previousScore}`}
              >
                {trend.glyph}
              </span>
            )}
          </>
        }
        hint={`${scoreLabel(score)} · out of 100`}
      />
      <Metric label="Work Items" value={totalItems} hint="scanned" />
      <Metric
        label="Violations"
        value={totalViolations}
        tone={totalViolations > 0 ? "danger" : "success"}
        hint={totalViolations > 0 ? "need attention" : "all clear"}
      />
    </div>
  );
};
