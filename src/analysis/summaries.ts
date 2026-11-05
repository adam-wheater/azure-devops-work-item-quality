import {
  AssigneeQualitySummary,
  QualityViolation,
  ScopeChange,
  SprintQualitySummary,
  WorkItemData,
} from "../models/interfaces";
import { QualityRulesEngine } from "./QualityRulesEngine";

/** Natural ("Sprint 2" before "Sprint 10") and total ordering for iteration paths. */
const compareIterationPath = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }) ||
  (a < b ? -1 : a > b ? 1 : 0);

/**
 * Groups work items and violations by iteration path and scores each sprint.
 * Scope counts come from the scope-change log for the same iteration; pass an
 * empty array when scope changes have not been fetched (or the rule is off).
 */
export function buildSprintSummaries(
  workItems: WorkItemData[],
  violations: QualityViolation[],
  scopeChanges: ScopeChange[],
  engine: QualityRulesEngine
): SprintQualitySummary[] {
  const iterationMap = new Map<string, { items: Set<number>; violations: QualityViolation[] }>();
  for (const wi of workItems) {
    const iter = wi.fields["System.IterationPath"];
    let entry = iterationMap.get(iter);
    if (!entry) {
      entry = { items: new Set(), violations: [] };
      iterationMap.set(iter, entry);
    }
    entry.items.add(wi.id);
  }
  for (const v of violations) {
    iterationMap.get(v.iterationPath)?.violations.push(v);
  }

  const scopeCounts = new Map<string, { added: number; removed: number }>();
  for (const change of scopeChanges) {
    let counts = scopeCounts.get(change.iterationPath);
    if (!counts) {
      counts = { added: 0, removed: 0 };
      scopeCounts.set(change.iterationPath, counts);
    }
    if (change.action === "added") counts.added++;
    else counts.removed++;
  }

  return Array.from(iterationMap.entries())
    .sort(([a], [b]) => compareIterationPath(a, b))
    .map(([iterationPath, data]) => {
      const counts = scopeCounts.get(iterationPath);
      return {
        iterationPath,
        sprintName: iterationPath.split("\\").pop() || iterationPath,
        itemCount: data.items.size,
        violationCount: data.violations.length,
        qualityScore: engine.computeScore(data.violations, data.items.size),
        scopeAdded: counts?.added ?? 0,
        scopeRemoved: counts?.removed ?? 0,
      };
    });
}

/** Groups work items and violations by assignee display name. */
export function buildAssigneeSummaries(
  workItems: WorkItemData[],
  violations: QualityViolation[]
): AssigneeQualitySummary[] {
  const assigneeMap = new Map<string, { violations: number; items: Set<number> }>();
  for (const wi of workItems) {
    const assignee = wi.fields["System.AssignedTo"]?.displayName || "Unassigned";
    let entry = assigneeMap.get(assignee);
    if (!entry) {
      entry = { violations: 0, items: new Set() };
      assigneeMap.set(assignee, entry);
    }
    entry.items.add(wi.id);
  }
  for (const v of violations) {
    const entry = assigneeMap.get(v.assignedTo);
    if (entry) entry.violations++;
  }
  return Array.from(assigneeMap.entries()).map(([assignee, data]) => ({
    assignee,
    violationCount: data.violations,
    itemCount: data.items.size,
  }));
}
