import {
  WorkItemData,
  QualityViolation,
  QualitySettings,
  RuleSeverity,
  QUALITY_RULES,
} from "../models/interfaces";

/**
 * Azure DevOps creates work items with default template/placeholder text
 * in rich-text fields. These should be treated as effectively empty.
 */
const DEFAULT_VALUE_PATTERNS: RegExp[] = [
  // Common ADO template placeholders (case-insensitive)
  /^\s*<description>\s*$/i,
  /^\s*enter\s+description\s+here\.?\s*$/i,
  /^\s*add\s+a?\s*description\.?\s*$/i,
  /^\s*<add\s+description>\s*$/i,
  /^\s*description\s*$/i,
  /^\s*<repro\s*steps?>\s*$/i,
  /^\s*enter\s+repro(duction)?\s+steps?\s+here\.?\s*$/i,
  /^\s*steps?\s+to\s+reproduce:?\s*$/i,
  /^\s*<acceptance\s*criteria>\s*$/i,
  /^\s*enter\s+acceptance\s+criteria\s+here\.?\s*$/i,
  /^\s*add\s+acceptance\s+criteria\.?\s*$/i,
  /^\s*acceptance\s+criteria:?\s*$/i,
  /^\s*<details>\s*$/i,
  /^\s*\[.*placeholder.*\]\s*$/i,
  /^\s*n\/?a\s*$/i,
  /^\s*none\s*$/i,
  /^\s*tbd\s*$/i,
  /^\s*todo\s*$/i,
  /^\s*-+\s*$/,
  /^\s*\.+\s*$/,
];

/**
 * Boilerplate phrases commonly left untouched in Acceptance Criteria templates.
 * When a work item's AC contains ONLY these phrases (no real content), it is treated as empty.
 */
const AC_TEMPLATE_PHRASES: string[] = [
  "keep the criteria realistic and achievable",
  "unit tests cc >60",
  "unit tests cc",
  "documentation required",
  "a11y tests do you have a vpat",
  "a11y tests",
  "add ids to all ui elements",
  "lld - created and approved by architects",
  "defined in a bullet point list",
  "to reach a consensus, to define pbi boundaries",
  "manual test",
];

/**
 * Section markers commonly left untouched in Bug Repro Steps templates.
 * Bug templates often contain only these headings with no actual content.
 */
const BUG_TEMPLATE_PHRASES: string[] = [
  "steps to reproduce",
  "actual result",
  "expected result",
  "when marking bugs as done, please can you add comments to the discussion section please",
  "when marking bugs as done",
];

/** Strip HTML tags and collapse whitespace, returning plain text. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Checks whether text is composed entirely of known template boilerplate.
 * Strips all known phrases and separator characters; if nothing meaningful remains, it's template-only.
 */
function hasOnlyTemplateContent(text: string, phrases: string[]): boolean {
  let remaining = text.toLowerCase();
  // Sort by length descending so longer phrases are removed first (e.g. "a11y tests do you have a vpat" before "a11y tests")
  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  for (const phrase of sorted) {
    remaining = remaining.split(phrase).join("");
  }
  // Remove separator lines (==== or ----), punctuation, whitespace, and common noise characters
  remaining = remaining.replace(/[=\-]{2,}/g, "").replace(/[\s.,;:!?><()\[\]/\\&\u00a0]/g, "");
  return remaining.length === 0;
}

/** Returns true if the rich-text field value is empty or contains only default/template content. */
function isEffectivelyEmpty(value: string | undefined | null, templatePhrases?: string[]): boolean {
  if (!value) return true;
  const text = stripHtml(value);
  if (text.length === 0) return true;
  if (DEFAULT_VALUE_PATTERNS.some((p) => p.test(text))) return true;
  if (templatePhrases && hasOnlyTemplateContent(text, templatePhrases)) return true;
  return false;
}

export class QualityRulesEngine {
  evaluate(workItems: WorkItemData[], settings: QualitySettings): QualityViolation[] {
    const violations: QualityViolation[] = [];
    const enabledRules = new Map(
      settings.rules.filter((r) => r.enabled).map((r) => [r.ruleId, r.severity])
    );

    const excludedIds = new Set(settings.excludedWorkItemIds);
    const excludedTags = new Set(settings.excludedTags.map((t) => t.toLowerCase()));

    const terminalStates = new Set(["Done", "Removed"]);

    for (const wi of workItems) {
      if (excludedIds.has(wi.id)) continue;

      const state = wi.fields["System.State"];
      if (terminalStates.has(state)) continue;

      const tags = (wi.fields["System.Tags"] || "")
        .split(";")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (tags.some((t) => excludedTags.has(t))) continue;

      const wiType = wi.fields["System.WorkItemType"];

      for (const rule of QUALITY_RULES) {
        const severity = enabledRules.get(rule.id);
        if (!severity) continue;
        if (!rule.appliesTo.includes(wiType)) continue;

        const violation = this.checkRule(rule.id, wi, workItems, settings, severity);
        if (violation) {
          violations.push(violation);
        }
      }
    }

    return violations;
  }

  private checkRule(
    ruleId: string,
    wi: WorkItemData,
    allItems: WorkItemData[],
    settings: QualitySettings,
    severity: RuleSeverity
  ): QualityViolation | null {
    switch (ruleId) {
      case "missing-acceptance-criteria":
        return this.checkMissingAcceptanceCriteria(wi, severity);
      case "missing-repro-steps":
        return this.checkMissingReproSteps(wi, severity);
      case "no-estimate":
        return this.checkNoEstimate(wi, severity);
      case "epic-no-children":
        return this.checkNoChildren(wi, allItems, severity, "Epic");
      case "feature-no-children":
        return this.checkNoChildren(wi, allItems, severity, "Feature");
      case "stuck-item":
        return this.checkStuck(wi, settings.stuckThresholdDays, severity);
      case "unparented-item":
        return this.checkUnparented(wi, severity);
      case "task-no-estimate":
        return this.checkTaskNoEstimate(wi, severity);
      case "sprint-scope-change":
        return null; // Scope change detection is handled at the App level via WorkItemDataService.fetchScopeChanges
      case "empty-title":
        return this.checkEmptyTitle(wi, severity);
      default:
        return null;
    }
  }

  checkMissingAcceptanceCriteria(
    wi: WorkItemData,
    severity: RuleSeverity = "Error"
  ): QualityViolation | null {
    const ac = wi.fields["Microsoft.VSTS.Common.AcceptanceCriteria"];
    if (isEffectivelyEmpty(ac, AC_TEMPLATE_PHRASES)) {
      return this.createViolation(
        wi,
        "missing-acceptance-criteria",
        "Missing Acceptance Criteria",
        severity,
        "No acceptance criteria defined"
      );
    }
    return null;
  }

  checkMissingReproSteps(
    wi: WorkItemData,
    severity: RuleSeverity = "Error"
  ): QualityViolation | null {
    const steps = wi.fields["Microsoft.VSTS.TCM.ReproSteps"];
    if (isEffectivelyEmpty(steps, BUG_TEMPLATE_PHRASES)) {
      return this.createViolation(
        wi,
        "missing-repro-steps",
        "Missing Repro Steps",
        severity,
        "No reproduction steps defined"
      );
    }
    return null;
  }

  checkNoEstimate(wi: WorkItemData, severity: RuleSeverity = "Warning"): QualityViolation | null {
    const effort = wi.fields["Microsoft.VSTS.Scheduling.Effort"];
    const storyPoints = wi.fields["Microsoft.VSTS.Scheduling.StoryPoints"];
    if (!effort && !storyPoints) {
      return this.createViolation(
        wi,
        "no-estimate",
        "No Estimate",
        severity,
        "No effort or story points assigned"
      );
    }
    return null;
  }

  checkNoChildren(
    wi: WorkItemData,
    allItems: WorkItemData[],
    severity: RuleSeverity = "Warning",
    _parentType?: string
  ): QualityViolation | null {
    const hasChildRelation = wi.relations?.some(
      (r) => r.rel === "System.LinkTypes.Hierarchy-Forward"
    );
    if (hasChildRelation) return null;

    // Also check if any item in allItems has a parent link to this item
    const hasChild = allItems.some((other) =>
      other.relations?.some(
        (r) => r.rel === "System.LinkTypes.Hierarchy-Reverse" && r.url.endsWith(`/${wi.id}`)
      )
    );
    if (hasChild) return null;

    const ruleId =
      wi.fields["System.WorkItemType"] === "Epic" ? "epic-no-children" : "feature-no-children";
    const ruleName =
      wi.fields["System.WorkItemType"] === "Epic"
        ? "Epic With No Children"
        : "Feature With No Children";

    return this.createViolation(wi, ruleId, ruleName, severity, "No child work items linked");
  }

  checkStuck(
    wi: WorkItemData,
    thresholdDays: number,
    severity: RuleSeverity = "Warning"
  ): QualityViolation | null {
    const changedDate = new Date(wi.fields["System.ChangedDate"]);
    const now = new Date();
    const diffMs = now.getTime() - changedDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    const state = wi.fields["System.State"];
    // Don't flag completed/removed/closed items as stuck
    const terminalStates = ["Done", "Closed", "Removed", "Completed", "Resolved"];
    if (terminalStates.includes(state)) return null;

    if (diffDays >= thresholdDays) {
      return this.createViolation(
        wi,
        "stuck-item",
        "Stuck Item",
        severity,
        `Unchanged for ${Math.floor(diffDays)} days (threshold: ${thresholdDays})`
      );
    }
    return null;
  }

  checkUnparented(wi: WorkItemData, severity: RuleSeverity = "Info"): QualityViolation | null {
    const hasParent = wi.relations?.some((r) => r.rel === "System.LinkTypes.Hierarchy-Reverse");
    if (!hasParent) {
      return this.createViolation(
        wi,
        "unparented-item",
        "Unparented Item",
        severity,
        "No parent work item linked"
      );
    }
    return null;
  }

  checkTaskNoEstimate(
    wi: WorkItemData,
    severity: RuleSeverity = "Warning"
  ): QualityViolation | null {
    const remaining = wi.fields["Microsoft.VSTS.Scheduling.RemainingWork"];
    const original = wi.fields["Microsoft.VSTS.Scheduling.OriginalEstimate"];
    if (!remaining && !original) {
      return this.createViolation(
        wi,
        "task-no-estimate",
        "Task Without Estimate",
        severity,
        "No remaining work or original estimate"
      );
    }
    return null;
  }

  checkEmptyTitle(wi: WorkItemData, severity: RuleSeverity = "Error"): QualityViolation | null {
    const title = wi.fields["System.Title"] || "";
    if (title.trim().length < 5) {
      return this.createViolation(
        wi,
        "empty-title",
        "Empty or Default Title",
        severity,
        `Title "${title}" is shorter than 5 characters`
      );
    }
    return null;
  }

  computeScore(violations: QualityViolation[], totalItems: number): number {
    if (totalItems <= 0) return 100;

    const weights: Record<RuleSeverity, number> = {
      Error: 10,
      Warning: 5,
      Info: 1,
    };

    let penalty = 0;
    for (const v of violations) {
      penalty += weights[v.severity] || 0;
    }

    const normalizedPenalty = (penalty / totalItems) * 100;
    return Math.max(0, Math.round(100 - normalizedPenalty));
  }

  private createViolation(
    wi: WorkItemData,
    ruleId: string,
    ruleName: string,
    severity: RuleSeverity,
    details?: string
  ): QualityViolation {
    return {
      workItemId: wi.id,
      workItemTitle: wi.fields["System.Title"],
      workItemType: wi.fields["System.WorkItemType"],
      workItemUrl: wi.url,
      ruleId,
      ruleName,
      severity,
      assignedTo: wi.fields["System.AssignedTo"]?.displayName || "Unassigned",
      iterationPath: wi.fields["System.IterationPath"],
      state: wi.fields["System.State"],
      details,
    };
  }
}
