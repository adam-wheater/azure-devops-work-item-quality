import { QualityRulesEngine } from "@/analysis/QualityRulesEngine";
import { buildAssigneeSummaries, buildSprintSummaries } from "@/analysis/summaries";
import { QualityViolation, ScopeChange, WorkItemData } from "@/models/interfaces";

const item = (id: number, iteration: string, assignee?: string): WorkItemData => ({
  id,
  url: `https://dev.azure.com/contoso/project/_workitems/edit/${id}`,
  fields: {
    "System.Id": id,
    "System.Title": `Item ${id}`,
    "System.WorkItemType": "Product Backlog Item",
    "System.State": "Active",
    "System.IterationPath": iteration,
    "System.ChangedDate": "2026-01-01T00:00:00Z",
    "System.CreatedDate": "2026-01-01T00:00:00Z",
    "System.AssignedTo": assignee ? { displayName: assignee } : undefined,
  },
});

const violation = (workItemId: number, iterationPath: string, assignedTo = "Unassigned") =>
  ({
    workItemId,
    workItemTitle: `Item ${workItemId}`,
    workItemType: "Product Backlog Item",
    workItemUrl: "",
    ruleId: "no-estimate",
    ruleName: "No Estimate",
    severity: "Warning",
    assignedTo,
    iterationPath,
    state: "Active",
  }) as QualityViolation;

describe("buildSprintSummaries", () => {
  const engine = new QualityRulesEngine();

  it("orders sprints naturally by iteration path, not by first work item seen", () => {
    const items = [
      item(1, "Proj\\Sprint 10"),
      item(2, "Proj\\Sprint 2"),
      item(3, "Proj\\Sprint 1"),
      item(4, "Proj\\Sprint 2"),
    ];
    const summaries = buildSprintSummaries(items, [], [], engine);
    expect(summaries.map((s) => s.sprintName)).toEqual(["Sprint 1", "Sprint 2", "Sprint 10"]);
    expect(summaries[1].itemCount).toBe(2);
  });

  it("scores each sprint from its own violations", () => {
    const items = [item(1, "Proj\\Sprint 1"), item(2, "Proj\\Sprint 2")];
    const violations = [violation(1, "Proj\\Sprint 1"), violation(1, "Proj\\Sprint 1")];
    const summaries = buildSprintSummaries(items, violations, [], engine);
    expect(summaries[0]).toMatchObject({
      sprintName: "Sprint 1",
      violationCount: 2,
      qualityScore: 0,
    });
    expect(summaries[1]).toMatchObject({
      sprintName: "Sprint 2",
      violationCount: 0,
      qualityScore: 100,
    });
  });

  it("counts scope changes per sprint by action", () => {
    const items = [item(1, "Proj\\Sprint 1"), item(2, "Proj\\Sprint 2")];
    const changes: ScopeChange[] = [
      {
        workItemId: 1,
        title: "",
        action: "added",
        changedDate: new Date(),
        changedBy: "",
        iterationPath: "Proj\\Sprint 1",
      },
      {
        workItemId: 5,
        title: "",
        action: "added",
        changedDate: new Date(),
        changedBy: "",
        iterationPath: "Proj\\Sprint 1",
      },
      {
        workItemId: 6,
        title: "",
        action: "removed",
        changedDate: new Date(),
        changedBy: "",
        iterationPath: "Proj\\Sprint 1",
      },
      {
        workItemId: 7,
        title: "",
        action: "removed",
        changedDate: new Date(),
        changedBy: "",
        iterationPath: "Proj\\Unknown",
      },
    ];
    const summaries = buildSprintSummaries(items, [], changes, engine);
    expect(summaries[0]).toMatchObject({ scopeAdded: 2, scopeRemoved: 1 });
    expect(summaries[1]).toMatchObject({ scopeAdded: 0, scopeRemoved: 0 });
  });
});

describe("buildAssigneeSummaries", () => {
  it("groups items and violations by assignee with Unassigned fallback", () => {
    const items = [
      item(1, "P\\S1", "Alice Contoso"),
      item(2, "P\\S1", "Alice Contoso"),
      item(3, "P\\S1"),
    ];
    const violations = [violation(1, "P\\S1", "Alice Contoso"), violation(3, "P\\S1")];
    const result = buildAssigneeSummaries(items, violations);
    expect(result).toEqual(
      expect.arrayContaining([
        { assignee: "Alice Contoso", violationCount: 1, itemCount: 2 },
        { assignee: "Unassigned", violationCount: 1, itemCount: 1 },
      ])
    );
    expect(result).toHaveLength(2);
  });
});
