import * as React from "react";
import { AssigneeQualitySummary } from "../models/interfaces";
import { Card } from "./ui";

interface AssigneeSummaryProps {
  assigneeSummary: AssigneeQualitySummary[];
}

export const AssigneeSummary: React.FC<AssigneeSummaryProps> = ({ assigneeSummary }) => {
  const sorted = React.useMemo(
    () =>
      [...assigneeSummary].sort(
        (a, b) => b.violationCount - a.violationCount || a.assignee.localeCompare(b.assignee)
      ),
    [assigneeSummary]
  );

  return (
    <Card title="Items needing attention" hint="Violations grouped by assignee" flush>
      <div className="ax-table-wrap">
        <table className="ax-table">
          <thead>
            <tr>
              <th>Assignee</th>
              <th className="ax-num">Violations</th>
              <th className="ax-num">Items</th>
              <th className="ax-num">Rate</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className="ax-muted" style={{ textAlign: "center" }}>
                  No assignee data available
                </td>
              </tr>
            ) : (
              sorted.map((a) => {
                const rate =
                  a.itemCount > 0 ? `${Math.round((a.violationCount / a.itemCount) * 100)}%` : "0%";
                return (
                  <tr key={a.assignee}>
                    <td>{a.assignee}</td>
                    <td className="ax-num" style={{ fontWeight: 600 }}>
                      {a.violationCount}
                    </td>
                    <td className="ax-num ax-muted">{a.itemCount}</td>
                    <td className="ax-num ax-muted">{rate}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
