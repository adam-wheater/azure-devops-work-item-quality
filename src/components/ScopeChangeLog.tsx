import * as React from "react";
import { ScopeChange } from "../models/interfaces";
import { Card, Pill } from "./ui";

interface ScopeChangeLogProps {
  scopeChanges: ScopeChange[];
}

export const ScopeChangeLog: React.FC<ScopeChangeLogProps> = ({ scopeChanges }) => (
  <Card title="Scope Changes" hint="Items added to or removed from a sprint" flush>
    <div className="ax-table-wrap">
      <table className="ax-table">
        <thead>
          <tr>
            <th className="ax-num">ID</th>
            <th>Title</th>
            <th>Action</th>
            <th>Date</th>
            <th>Changed By</th>
            <th>Sprint</th>
          </tr>
        </thead>
        <tbody>
          {scopeChanges.length === 0 ? (
            <tr>
              <td colSpan={6} className="ax-muted" style={{ textAlign: "center" }}>
                No scope changes detected
              </td>
            </tr>
          ) : (
            scopeChanges.map((sc, idx) => (
              <tr key={`${sc.workItemId}-${sc.action}-${idx}`}>
                <td className="ax-num ax-mono">{sc.workItemId}</td>
                <td>{sc.title}</td>
                <td>
                  <Pill tone={sc.action === "added" ? "success" : "danger"}>{sc.action}</Pill>
                </td>
                <td className="ax-muted">
                  {sc.changedDate instanceof Date && !isNaN(sc.changedDate.getTime())
                    ? sc.changedDate.toLocaleDateString()
                    : String(sc.changedDate)}
                </td>
                <td className="ax-muted">{sc.changedBy}</td>
                <td className="ax-muted" style={{ whiteSpace: "nowrap" }}>
                  {sc.iterationPath}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </Card>
);
