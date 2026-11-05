import * as React from "react";
import { SprintQualitySummary } from "../models/interfaces";
import { scoreLabel, scoreTone } from "./QualityScoreCard";
import { Card, Pill } from "./ui";

interface SprintSummaryTableProps {
  summaries: SprintQualitySummary[];
}

export const SprintSummaryTable: React.FC<SprintSummaryTableProps> = ({ summaries }) => (
  <Card title="Sprint Summary" hint="Quality score and scope movement per iteration" flush>
    <div className="ax-table-wrap">
      <table className="ax-table">
        <thead>
          <tr>
            <th>Sprint</th>
            <th className="ax-num">Items</th>
            <th className="ax-num">Violations</th>
            <th className="ax-num">Score</th>
            <th className="ax-num">Scope Added</th>
            <th className="ax-num">Scope Removed</th>
          </tr>
        </thead>
        <tbody>
          {summaries.length === 0 ? (
            <tr>
              <td colSpan={6} className="ax-muted" style={{ textAlign: "center" }}>
                No sprint data available
              </td>
            </tr>
          ) : (
            summaries.map((s) => (
              <tr key={s.iterationPath}>
                <td title={s.iterationPath}>{s.sprintName}</td>
                <td className="ax-num ax-muted">{s.itemCount}</td>
                <td className="ax-num ax-muted">{s.violationCount}</td>
                <td className="ax-num">
                  <Pill tone={scoreTone(s.qualityScore)}>
                    {s.qualityScore} · {scoreLabel(s.qualityScore)}
                  </Pill>
                </td>
                <td className="ax-num ax-muted">{s.scopeAdded}</td>
                <td className="ax-num ax-muted">{s.scopeRemoved}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </Card>
);
