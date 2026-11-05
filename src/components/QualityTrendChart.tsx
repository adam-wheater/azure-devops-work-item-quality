import * as React from "react";
import { SprintQualitySummary } from "../models/interfaces";
import { useTheme } from "../utils/theme";
import { Card } from "./ui";

interface QualityTrendChartProps {
  summaries: SprintQualitySummary[];
}

const WIDTH = 600;
const HEIGHT = 200;
const PADDING_X = 50;
const PADDING_Y = 30;
const CHART_W = WIDTH - PADDING_X * 2;
const CHART_H = HEIGHT - PADDING_Y * 2;
const Y_TICKS = [0, 25, 50, 75, 100];

export const QualityTrendChart: React.FC<QualityTrendChartProps> = ({ summaries }) => {
  const theme = useTheme();
  const last10 = summaries.slice(-10);

  if (last10.length < 2) {
    return (
      <Card title="Quality Trend" hint="Score over the last 10 sprints">
        <p className="ax-muted" style={{ margin: 0, textAlign: "center" }}>
          Not enough sprint data for trend chart (need at least 2 sprints)
        </p>
      </Card>
    );
  }

  const points = last10.map((s, i) => ({
    x: PADDING_X + (i / (last10.length - 1)) * CHART_W,
    y: PADDING_Y + CHART_H - (s.qualityScore / 100) * CHART_H,
    score: s.qualityScore,
    name: s.sprintName,
    key: s.iterationPath,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const lineColor = theme.chart[0];

  return (
    <Card title="Quality Trend" hint="Score over the last 10 sprints">
      <div className="ax-row ax-fine" style={{ marginBottom: "var(--ax-s2)" }} aria-hidden="true">
        <span className="ax-dot" style={{ color: lineColor }} />
        <span>Quality score (0-100) per sprint</span>
      </div>
      <svg
        className="ax-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ maxWidth: WIDTH }}
        role="img"
        aria-label={`Quality score trend across ${last10.length} sprints`}
      >
        {Y_TICKS.map((val) => {
          const y = PADDING_Y + CHART_H - (val / 100) * CHART_H;
          return (
            <React.Fragment key={`y-${val}`}>
              <line
                className="ax-grid"
                x1={PADDING_X}
                y1={y}
                x2={PADDING_X + CHART_W}
                y2={y}
                strokeDasharray="3,3"
              />
              <text x={PADDING_X - 8} y={y + 4} textAnchor="end" fontSize={10}>
                {val}
              </text>
            </React.Fragment>
          );
        })}
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2} />
        {points.map((p) => (
          <circle
            key={`point-${p.key}`}
            className="ax-point"
            cx={p.x}
            cy={p.y}
            r={4}
            fill={lineColor}
          >
            <title>{`${p.name}: ${p.score}`}</title>
          </circle>
        ))}
        {points.map((p) => (
          <text key={`label-${p.key}`} x={p.x} y={HEIGHT - 5} textAnchor="middle" fontSize={9}>
            {p.name.length > 10 ? p.name.slice(-10) : p.name}
          </text>
        ))}
      </svg>
    </Card>
  );
};
