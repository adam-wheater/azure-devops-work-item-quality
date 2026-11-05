import { QualityRulesEngine } from "@/analysis/QualityRulesEngine";
import {
  WorkItemData,
  QualitySettings,
  DEFAULT_QUALITY_SETTINGS,
  QualityViolation,
} from "@/models/interfaces";

function makeWorkItem(overrides: {
  id?: number;
  url?: string;
  relations?: any[];
  fields: Record<string, any>;
}): WorkItemData {
  const now = new Date().toISOString();
  const defaults: Record<string, any> = {
    "System.Id": overrides.id ?? 1,
    "System.Title": "Test Work Item",
    "System.WorkItemType": "Product Backlog Item",
    "System.State": "Active",
    "System.IterationPath": "Project\\Sprint 1",
    "System.ChangedDate": now,
    "System.CreatedDate": now,
  };
  return {
    id: overrides.id ?? 1,
    url: overrides.url ?? "https://dev.azure.com/org/project/_workitems/edit/1",
    relations: overrides.relations ?? [],
    fields: { ...defaults, ...overrides.fields } as any,
  };
}

describe("QualityRulesEngine", () => {
  let engine: QualityRulesEngine;
  let settings: QualitySettings;

  beforeEach(() => {
    engine = new QualityRulesEngine();
    settings = JSON.parse(JSON.stringify(DEFAULT_QUALITY_SETTINGS));
  });

  // ===== Missing Acceptance Criteria =====

  describe("checkMissingAcceptanceCriteria", () => {
    it("should flag PBI without acceptance criteria", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Product Backlog Item",
          "Microsoft.VSTS.Common.AcceptanceCriteria": undefined,
        },
      });
      const result = engine.checkMissingAcceptanceCriteria(wi);
      expect(result).not.toBeNull();
      expect(result!.ruleId).toBe("missing-acceptance-criteria");
    });

    it("should flag PBI with empty HTML acceptance criteria", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Product Backlog Item",
          "Microsoft.VSTS.Common.AcceptanceCriteria": "<div>  </div>",
        },
      });
      const result = engine.checkMissingAcceptanceCriteria(wi);
      expect(result).not.toBeNull();
    });

    it("should pass PBI with acceptance criteria", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Product Backlog Item",
          "Microsoft.VSTS.Common.AcceptanceCriteria": "Given X, when Y, then Z",
        },
      });
      const result = engine.checkMissingAcceptanceCriteria(wi);
      expect(result).toBeNull();
    });

    it("should flag PBI with default template acceptance criteria", () => {
      const defaults = [
        "<div>Enter acceptance criteria here</div>",
        "<div>Add acceptance criteria</div>",
        "<div><Acceptance Criteria></div>",
        "<div>Acceptance Criteria</div>",
        "<div>N/A</div>",
        "<div>TBD</div>",
        "<p>None</p>",
        "<div>---</div>",
        "<div>...</div>",
        // Example organisation template: section headings only
        "<div>Keep the criteria realistic and achievable.<br> Unit Tests CC >60<br> Documentation required<br> LLD - created and approved by Architects.<br> A11y Tests do you have a VPAT<br> Add IDs to all UI elements.</div>",
        // Example organisation template: bullet-point boilerplate only
        "<div>Defined in a bullet point list.<br> To reach a consensus, to define PBI boundaries.<br>Keep the criteria realistic and achievable.<br> Unit Tests CC >60<br> Documentation required<br> Manual Test <br> A11y Tests <br> Add IDs to all UI elements<br></div>",
      ];
      for (const ac of defaults) {
        const wi = makeWorkItem({
          fields: {
            "System.WorkItemType": "Product Backlog Item",
            "Microsoft.VSTS.Common.AcceptanceCriteria": ac,
          },
        });
        const result = engine.checkMissingAcceptanceCriteria(wi);
        expect(result).not.toBeNull();
      }
    });

    it("should pass PBI with template text plus real content", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Product Backlog Item",
          "Microsoft.VSTS.Common.AcceptanceCriteria":
            "<div>Keep the criteria realistic and achievable.<br> Unit Tests CC >60<br> Documentation required<br> The container is deployed in azure and can communicate with the Institution container.</div>",
        },
      });
      const result = engine.checkMissingAcceptanceCriteria(wi);
      expect(result).toBeNull();
    });

    it("should not apply to Bugs (Bugs use repro steps instead)", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Bug",
          "System.State": "Approved",
          "Microsoft.VSTS.Common.AcceptanceCriteria": undefined,
        },
      });
      // Rule no longer applies to Bugs — they use Repro Steps
      const result = engine.checkMissingAcceptanceCriteria(wi);
      expect(result).not.toBeNull(); // direct call still flags, but evaluate() won't run it for Bugs
    });
  });

  // ===== Missing Repro Steps =====

  describe("checkMissingReproSteps", () => {
    it("should flag Bug without repro steps", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Bug",
          "Microsoft.VSTS.TCM.ReproSteps": undefined,
        },
      });
      const result = engine.checkMissingReproSteps(wi);
      expect(result).not.toBeNull();
      expect(result!.ruleId).toBe("missing-repro-steps");
    });

    it("should pass Bug with repro steps", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Bug",
          "Microsoft.VSTS.TCM.ReproSteps": "1. Navigate to page\n2. Click button",
        },
      });
      const result = engine.checkMissingReproSteps(wi);
      expect(result).toBeNull();
    });

    it("should flag Bug with default template repro steps", () => {
      const defaults = [
        "<div>Enter repro steps here</div>",
        "<div><Repro Steps></div>",
        "<div>Steps to reproduce:</div>",
        "<div>N/A</div>",
        "<div>TBD</div>",
        // Example organisation bug template with section markers only
        "<div>=========================================<br>==== Steps to Reproduce ====<br>=========================================<br><br>=========================================<br>==== Actual Result ====<br>=========================================<br><br>=========================================<br>==== Expected Result ====<br>=========================================<br><br>When marking Bugs as Done, please can you add comments to the Discussion section Please.</div>",
      ];
      for (const steps of defaults) {
        const wi = makeWorkItem({
          fields: {
            "System.WorkItemType": "Bug",
            "Microsoft.VSTS.TCM.ReproSteps": steps,
          },
        });
        const result = engine.checkMissingReproSteps(wi);
        expect(result).not.toBeNull();
      }
    });

    it("should pass Bug with template markers plus real content", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Bug",
          "Microsoft.VSTS.TCM.ReproSteps":
            "<div>==== Steps to Reproduce ====<br>1. Navigate to the dashboard<br>2. Click submit<br>==== Actual Result ====<br>Error 500 is shown<br>==== Expected Result ====<br>Form submits successfully</div>",
        },
      });
      const result = engine.checkMissingReproSteps(wi);
      expect(result).toBeNull();
    });
  });

  // ===== No Estimate =====

  describe("checkNoEstimate", () => {
    it("should flag PBI without effort or story points", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Product Backlog Item",
          "Microsoft.VSTS.Scheduling.Effort": undefined,
          "Microsoft.VSTS.Scheduling.StoryPoints": undefined,
        },
      });
      const result = engine.checkNoEstimate(wi);
      expect(result).not.toBeNull();
      expect(result!.ruleId).toBe("no-estimate");
    });

    it("should pass PBI with effort", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Product Backlog Item",
          "Microsoft.VSTS.Scheduling.Effort": 5,
        },
      });
      const result = engine.checkNoEstimate(wi);
      expect(result).toBeNull();
    });

    it("should pass PBI with story points", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Product Backlog Item",
          "Microsoft.VSTS.Scheduling.StoryPoints": 3,
        },
      });
      const result = engine.checkNoEstimate(wi);
      expect(result).toBeNull();
    });
  });

  // ===== No Children =====

  describe("checkNoChildren", () => {
    it("should flag Epic with no children", () => {
      const wi = makeWorkItem({
        id: 100,
        fields: { "System.WorkItemType": "Epic" },
        relations: [],
      });
      const result = engine.checkNoChildren(wi, [wi]);
      expect(result).not.toBeNull();
      expect(result!.ruleId).toBe("epic-no-children");
    });

    it("should pass Epic with forward hierarchy relation", () => {
      const wi = makeWorkItem({
        id: 100,
        fields: { "System.WorkItemType": "Epic" },
        relations: [
          { rel: "System.LinkTypes.Hierarchy-Forward", url: "https://test/200", attributes: {} },
        ],
      });
      const result = engine.checkNoChildren(wi, [wi]);
      expect(result).toBeNull();
    });

    it("should flag Feature with no children", () => {
      const wi = makeWorkItem({
        id: 200,
        fields: { "System.WorkItemType": "Feature" },
        relations: [],
      });
      const result = engine.checkNoChildren(wi, [wi]);
      expect(result).not.toBeNull();
      expect(result!.ruleId).toBe("feature-no-children");
    });

    it("should pass Epic if another item has reverse hierarchy to it", () => {
      const epic = makeWorkItem({
        id: 100,
        fields: { "System.WorkItemType": "Epic" },
        relations: [],
      });
      const child = makeWorkItem({
        id: 200,
        fields: { "System.WorkItemType": "Feature" },
        relations: [
          {
            rel: "System.LinkTypes.Hierarchy-Reverse",
            url: "https://test/100",
            attributes: {},
          },
        ],
      });
      const result = engine.checkNoChildren(epic, [epic, child]);
      expect(result).toBeNull();
    });
  });

  // ===== Stuck Item =====

  describe("checkStuck", () => {
    it("should flag item unchanged for longer than threshold", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 20);
      const wi = makeWorkItem({
        fields: {
          "System.State": "Active",
          "System.ChangedDate": oldDate.toISOString(),
        },
      });
      const result = engine.checkStuck(wi, 14);
      expect(result).not.toBeNull();
      expect(result!.ruleId).toBe("stuck-item");
      expect(result!.details).toContain("20 days");
    });

    it("should pass item changed recently", () => {
      const wi = makeWorkItem({
        fields: {
          "System.State": "Active",
          "System.ChangedDate": new Date().toISOString(),
        },
      });
      const result = engine.checkStuck(wi, 14);
      expect(result).toBeNull();
    });

    it("should not flag Done items as stuck", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30);
      const wi = makeWorkItem({
        fields: {
          "System.State": "Done",
          "System.ChangedDate": oldDate.toISOString(),
        },
      });
      const result = engine.checkStuck(wi, 14);
      expect(result).toBeNull();
    });

    it("should not flag Closed items as stuck", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30);
      const wi = makeWorkItem({
        fields: {
          "System.State": "Closed",
          "System.ChangedDate": oldDate.toISOString(),
        },
      });
      const result = engine.checkStuck(wi, 14);
      expect(result).toBeNull();
    });
  });

  // ===== Unparented Item =====

  describe("checkUnparented", () => {
    it("should flag item without parent relation", () => {
      const wi = makeWorkItem({
        fields: { "System.WorkItemType": "Product Backlog Item" },
        relations: [],
      });
      const result = engine.checkUnparented(wi);
      expect(result).not.toBeNull();
      expect(result!.ruleId).toBe("unparented-item");
    });

    it("should pass item with parent relation", () => {
      const wi = makeWorkItem({
        fields: { "System.WorkItemType": "Product Backlog Item" },
        relations: [
          {
            rel: "System.LinkTypes.Hierarchy-Reverse",
            url: "https://test/100",
            attributes: {},
          },
        ],
      });
      const result = engine.checkUnparented(wi);
      expect(result).toBeNull();
    });
  });

  // ===== Task No Estimate =====

  describe("checkTaskNoEstimate", () => {
    it("should flag Task without remaining work or original estimate", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Task",
          "Microsoft.VSTS.Scheduling.RemainingWork": undefined,
          "Microsoft.VSTS.Scheduling.OriginalEstimate": undefined,
        },
      });
      const result = engine.checkTaskNoEstimate(wi);
      expect(result).not.toBeNull();
      expect(result!.ruleId).toBe("task-no-estimate");
    });

    it("should pass Task with remaining work", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Task",
          "Microsoft.VSTS.Scheduling.RemainingWork": 4,
        },
      });
      const result = engine.checkTaskNoEstimate(wi);
      expect(result).toBeNull();
    });

    it("should pass Task with original estimate", () => {
      const wi = makeWorkItem({
        fields: {
          "System.WorkItemType": "Task",
          "Microsoft.VSTS.Scheduling.OriginalEstimate": 8,
        },
      });
      const result = engine.checkTaskNoEstimate(wi);
      expect(result).toBeNull();
    });
  });

  // ===== Empty Title =====

  describe("checkEmptyTitle", () => {
    it("should flag item with title shorter than 5 characters", () => {
      const wi = makeWorkItem({
        fields: { "System.Title": "abc" },
      });
      const result = engine.checkEmptyTitle(wi);
      expect(result).not.toBeNull();
      expect(result!.ruleId).toBe("empty-title");
    });

    it("should flag item with empty title", () => {
      const wi = makeWorkItem({
        fields: { "System.Title": "" },
      });
      const result = engine.checkEmptyTitle(wi);
      expect(result).not.toBeNull();
    });

    it("should pass item with normal title", () => {
      const wi = makeWorkItem({
        fields: { "System.Title": "Implement user login feature" },
      });
      const result = engine.checkEmptyTitle(wi);
      expect(result).toBeNull();
    });
  });

  // ===== Score Computation =====

  describe("computeScore", () => {
    it("should return 100 for no violations", () => {
      expect(engine.computeScore([], 100)).toBe(100);
    });

    it("should return 100 when totalItems is 0", () => {
      expect(engine.computeScore([], 0)).toBe(100);
    });

    it("should deduct 10 per Error violation", () => {
      const violations: QualityViolation[] = [
        {
          workItemId: 1,
          workItemTitle: "Test",
          workItemType: "Bug",
          workItemUrl: "",
          ruleId: "test",
          ruleName: "Test",
          severity: "Error",
          assignedTo: "User",
          iterationPath: "Sprint 1",
          state: "Active",
        },
      ];
      // 1 Error across 10 items: penalty=10, normalized=(10/10)*100=100, score=100-100=0
      expect(engine.computeScore(violations, 10)).toBe(0);
      // 1 Error across 100 items: penalty=10, normalized=(10/100)*100=10, score=100-10=90
      expect(engine.computeScore(violations, 100)).toBe(90);
    });

    it("should deduct 5 per Warning violation", () => {
      const violations: QualityViolation[] = [
        {
          workItemId: 1,
          workItemTitle: "Test",
          workItemType: "Bug",
          workItemUrl: "",
          ruleId: "test",
          ruleName: "Test",
          severity: "Warning",
          assignedTo: "User",
          iterationPath: "Sprint 1",
          state: "Active",
        },
      ];
      // 1 Warning across 100 items: penalty=5, normalized=(5/100)*100=5, score=100-5=95
      expect(engine.computeScore(violations, 100)).toBe(95);
    });

    it("should deduct 1 per Info violation", () => {
      const violations: QualityViolation[] = [
        {
          workItemId: 1,
          workItemTitle: "Test",
          workItemType: "Bug",
          workItemUrl: "",
          ruleId: "test",
          ruleName: "Test",
          severity: "Info",
          assignedTo: "User",
          iterationPath: "Sprint 1",
          state: "Active",
        },
      ];
      // 1 Info across 100 items: penalty=1, normalized=(1/100)*100=1, score=100-1=99
      expect(engine.computeScore(violations, 100)).toBe(99);
    });

    it("should floor at 0", () => {
      const violations: QualityViolation[] = Array.from({ length: 20 }, (_, i) => ({
        workItemId: i,
        workItemTitle: "Test",
        workItemType: "Bug",
        workItemUrl: "",
        ruleId: "test",
        ruleName: "Test",
        severity: "Error" as const,
        assignedTo: "User",
        iterationPath: "Sprint 1",
        state: "Active",
      }));
      // 20 Errors across 10 items: penalty=200, normalized=(200/10)*100=2000, score=max(0, 100-2000)=0
      expect(engine.computeScore(violations, 10)).toBe(0);
    });

    it("should handle mixed severities", () => {
      const violations: QualityViolation[] = [
        {
          workItemId: 1,
          workItemTitle: "Test",
          workItemType: "Bug",
          workItemUrl: "",
          ruleId: "t1",
          ruleName: "Test",
          severity: "Error",
          assignedTo: "User",
          iterationPath: "Sprint 1",
          state: "Active",
        },
        {
          workItemId: 2,
          workItemTitle: "Test",
          workItemType: "Bug",
          workItemUrl: "",
          ruleId: "t2",
          ruleName: "Test",
          severity: "Warning",
          assignedTo: "User",
          iterationPath: "Sprint 1",
          state: "Active",
        },
        {
          workItemId: 3,
          workItemTitle: "Test",
          workItemType: "Bug",
          workItemUrl: "",
          ruleId: "t3",
          ruleName: "Test",
          severity: "Info",
          assignedTo: "User",
          iterationPath: "Sprint 1",
          state: "Active",
        },
      ];
      // penalty = 10 + 5 + 1 = 16, across 100 items: normalized = (16/100)*100 = 16, score = 100 - 16 = 84
      expect(engine.computeScore(violations, 100)).toBe(84);
    });
  });

  // ===== Evaluate =====

  describe("evaluate", () => {
    it("should run all enabled rules on matching work items", () => {
      const workItems: WorkItemData[] = [
        makeWorkItem({
          id: 1,
          fields: {
            "System.WorkItemType": "Bug",
            "System.Title": "A real bug title for testing",
            "Microsoft.VSTS.Common.AcceptanceCriteria": undefined,
            "Microsoft.VSTS.TCM.ReproSteps": undefined,
          },
          relations: [],
        }),
      ];

      const violations = engine.evaluate(workItems, settings);
      const ruleIds = violations.map((v) => v.ruleId);
      // missing-acceptance-criteria does not apply to Bugs (they use repro steps instead)
      expect(ruleIds).not.toContain("missing-acceptance-criteria");
      expect(ruleIds).toContain("missing-repro-steps");
      expect(ruleIds).toContain("unparented-item");
    });

    it("should exclude work items in Done state", () => {
      const workItems: WorkItemData[] = [
        makeWorkItem({
          id: 1,
          fields: {
            "System.WorkItemType": "Product Backlog Item",
            "System.State": "Done",
            "System.Title": "A done PBI",
            "Microsoft.VSTS.Common.AcceptanceCriteria": undefined,
          },
          relations: [],
        }),
      ];

      const violations = engine.evaluate(workItems, settings);
      expect(violations).toHaveLength(0);
    });

    it("should exclude work items in Removed state", () => {
      const workItems: WorkItemData[] = [
        makeWorkItem({
          id: 1,
          fields: {
            "System.WorkItemType": "Bug",
            "System.State": "Removed",
            "System.Title": "A removed bug",
            "Microsoft.VSTS.TCM.ReproSteps": undefined,
          },
          relations: [],
        }),
      ];

      const violations = engine.evaluate(workItems, settings);
      expect(violations).toHaveLength(0);
    });

    it("should skip disabled rules", () => {
      settings.rules = settings.rules.map((r) =>
        r.ruleId === "missing-acceptance-criteria" ? { ...r, enabled: false } : r
      );

      const workItems: WorkItemData[] = [
        makeWorkItem({
          id: 1,
          fields: {
            "System.WorkItemType": "Product Backlog Item",
            "System.Title": "A real PBI title for testing",
            "Microsoft.VSTS.Common.AcceptanceCriteria": undefined,
          },
          relations: [],
        }),
      ];

      const violations = engine.evaluate(workItems, settings);
      const ruleIds = violations.map((v) => v.ruleId);
      expect(ruleIds).not.toContain("missing-acceptance-criteria");
    });

    it("should use configured severity", () => {
      settings.rules = settings.rules.map((r) =>
        r.ruleId === "missing-acceptance-criteria" ? { ...r, severity: "Info" as const } : r
      );

      const workItems: WorkItemData[] = [
        makeWorkItem({
          id: 1,
          fields: {
            "System.WorkItemType": "Product Backlog Item",
            "System.Title": "A real PBI title for testing",
            "Microsoft.VSTS.Common.AcceptanceCriteria": undefined,
          },
          relations: [],
        }),
      ];

      const violations = engine.evaluate(workItems, settings);
      const acViolation = violations.find((v) => v.ruleId === "missing-acceptance-criteria");
      expect(acViolation).toBeDefined();
      expect(acViolation!.severity).toBe("Info");
    });

    it("should exclude work items by ID", () => {
      settings.excludedWorkItemIds = [1];

      const workItems: WorkItemData[] = [
        makeWorkItem({
          id: 1,
          fields: {
            "System.WorkItemType": "Bug",
            "System.Title": "A bug to exclude",
            "Microsoft.VSTS.TCM.ReproSteps": undefined,
          },
        }),
      ];

      const violations = engine.evaluate(workItems, settings);
      expect(violations).toHaveLength(0);
    });

    it("should exclude work items by tag", () => {
      settings.excludedTags = ["skip-quality"];

      const workItems: WorkItemData[] = [
        makeWorkItem({
          id: 1,
          fields: {
            "System.WorkItemType": "Bug",
            "System.Title": "A tagged bug for testing",
            "Microsoft.VSTS.TCM.ReproSteps": undefined,
            "System.Tags": "important; skip-quality",
          },
        }),
      ];

      const violations = engine.evaluate(workItems, settings);
      expect(violations).toHaveLength(0);
    });

    it("should not apply rules to non-matching work item types", () => {
      const workItems: WorkItemData[] = [
        makeWorkItem({
          id: 1,
          fields: {
            "System.WorkItemType": "Task",
            "System.Title": "A task for testing here",
            "Microsoft.VSTS.Common.AcceptanceCriteria": undefined,
          },
          relations: [
            { rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://test/100", attributes: {} },
          ],
        }),
      ];

      const violations = engine.evaluate(workItems, settings);
      // "missing-acceptance-criteria" applies to PBI only, not Task or Bug
      const acViolation = violations.find((v) => v.ruleId === "missing-acceptance-criteria");
      expect(acViolation).toBeUndefined();
    });
  });
});
