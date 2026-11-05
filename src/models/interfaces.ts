export type RuleSeverity = "Error" | "Warning" | "Info";

export interface QualityRule {
  id: string;
  name: string;
  description: string;
  appliesTo: string[];
  defaultSeverity: RuleSeverity;
  enabled: boolean;
}

export const QUALITY_RULES: QualityRule[] = [
  {
    id: "missing-acceptance-criteria",
    name: "Missing Acceptance Criteria",
    description: "PBIs should have acceptance criteria defined",
    appliesTo: ["Product Backlog Item"],
    defaultSeverity: "Error",
    enabled: true,
  },
  {
    id: "missing-repro-steps",
    name: "Missing Repro Steps",
    description: "Bugs should have reproduction steps",
    appliesTo: ["Bug"],
    defaultSeverity: "Error",
    enabled: true,
  },
  {
    id: "no-estimate",
    name: "No Estimate",
    description: "PBIs and Bugs should have effort/story points",
    appliesTo: ["Product Backlog Item", "Bug"],
    defaultSeverity: "Warning",
    enabled: true,
  },
  {
    id: "epic-no-children",
    name: "Epic With No Children",
    description: "Epics should have child features or PBIs",
    appliesTo: ["Epic"],
    defaultSeverity: "Warning",
    enabled: true,
  },
  {
    id: "feature-no-children",
    name: "Feature With No Children",
    description: "Features should have child PBIs or Bugs",
    appliesTo: ["Feature"],
    defaultSeverity: "Warning",
    enabled: true,
  },
  {
    id: "stuck-item",
    name: "Stuck Item",
    description: "Items in the same state for too long",
    appliesTo: ["Product Backlog Item", "Bug", "Task", "Epic", "Feature"],
    defaultSeverity: "Warning",
    enabled: true,
  },
  {
    id: "sprint-scope-change",
    name: "Sprint Scope Change",
    description: "Items added or removed after sprint start",
    appliesTo: ["Product Backlog Item", "Bug"],
    defaultSeverity: "Info",
    enabled: true,
  },
  {
    id: "unparented-item",
    name: "Unparented Item",
    description: "Items without a parent link",
    appliesTo: ["Product Backlog Item", "Bug", "Task"],
    defaultSeverity: "Info",
    enabled: true,
  },
  {
    id: "task-no-estimate",
    name: "Task Without Estimate",
    description: "Tasks should have remaining work or original estimate",
    appliesTo: ["Task"],
    defaultSeverity: "Warning",
    enabled: true,
  },
  {
    id: "empty-title",
    name: "Empty or Default Title",
    description: "Items with titles shorter than 5 characters",
    appliesTo: ["Product Backlog Item", "Bug", "Task", "Epic", "Feature"],
    defaultSeverity: "Error",
    enabled: true,
  },
];

export interface QualityViolation {
  workItemId: number;
  workItemTitle: string;
  workItemType: string;
  workItemUrl: string;
  ruleId: string;
  ruleName: string;
  severity: RuleSeverity;
  assignedTo: string;
  iterationPath: string;
  state: string;
  details?: string;
}

export interface SprintQualitySummary {
  iterationPath: string;
  sprintName: string;
  itemCount: number;
  violationCount: number;
  qualityScore: number;
  scopeAdded: number;
  scopeRemoved: number;
}

export interface AssigneeQualitySummary {
  assignee: string;
  violationCount: number;
  itemCount: number;
}

export interface ScopeChange {
  workItemId: number;
  title: string;
  action: "added" | "removed";
  changedDate: Date;
  changedBy: string;
  iterationPath: string;
}

export interface QualityAnalysisResult {
  violations: QualityViolation[];
  overallScore: number;
  sprintSummaries: SprintQualitySummary[];
  assigneeSummary: AssigneeQualitySummary[];
  scopeChanges: ScopeChange[];
}

export interface QualitySettings {
  rules: { ruleId: string; enabled: boolean; severity: RuleSeverity }[];
  stuckThresholdDays: number;
  excludedWorkItemIds: number[];
  excludedTags: string[];
  scopeChangeGraceHours: number;
}

export const DEFAULT_QUALITY_SETTINGS: QualitySettings = {
  rules: QUALITY_RULES.map((r) => ({
    ruleId: r.id,
    enabled: r.enabled,
    severity: r.defaultSeverity,
  })),
  stuckThresholdDays: 14,
  excludedWorkItemIds: [],
  excludedTags: [],
  scopeChangeGraceHours: 24,
};

// Work item shape from ADO API
export interface WorkItemFields {
  "System.Id": number;
  "System.Title": string;
  "System.WorkItemType": string;
  "System.State": string;
  "System.AssignedTo"?: { displayName: string };
  "System.IterationPath": string;
  "System.ChangedDate": string;
  "System.CreatedDate": string;
  "Microsoft.VSTS.Common.AcceptanceCriteria"?: string;
  "Microsoft.VSTS.TCM.ReproSteps"?: string;
  "Microsoft.VSTS.Scheduling.Effort"?: number;
  "Microsoft.VSTS.Scheduling.StoryPoints"?: number;
  "Microsoft.VSTS.Scheduling.RemainingWork"?: number;
  "Microsoft.VSTS.Scheduling.OriginalEstimate"?: number;
  "System.Description"?: string;
  "System.Tags"?: string;
}

export interface WorkItemData {
  id: number;
  fields: WorkItemFields;
  relations?: { rel: string; url: string; attributes: any }[];
  url: string;
}
