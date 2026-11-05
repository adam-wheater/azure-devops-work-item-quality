import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IProjectPageService } from "azure-devops-extension-api";
import { QualityRulesEngine } from "../analysis/QualityRulesEngine";
import { buildAssigneeSummaries, buildSprintSummaries } from "../analysis/summaries";
import { WorkItemDataService } from "../services/WorkItemDataService";
import { SettingsService } from "../services/SettingsService";
import {
  AssigneeQualitySummary,
  DEFAULT_QUALITY_SETTINGS,
  QualitySettings,
  QualityViolation,
  ScopeChange,
  SprintQualitySummary,
  WorkItemData,
} from "../models/interfaces";
import { BRAND, BrandGlyph } from "../brand";
import {
  AppShell,
  Banner,
  Button,
  ErrorBoundary,
  IconPlay,
  IconSettings,
  IconStop,
  Progress,
} from "./ui";
import { QualityScoreCard } from "./QualityScoreCard";
import { ViolationsTable } from "./ViolationsTable";
import { SprintSummaryTable } from "./SprintSummaryTable";
import { AssigneeSummary } from "./AssigneeSummary";
import { ScopeChangeLog } from "./ScopeChangeLog";
import { QualityTrendChart } from "./QualityTrendChart";
import { QualitySettingsPanel } from "./QualitySettings";

const dataService = new WorkItemDataService();
const settingsService = new SettingsService();
const rulesEngine = new QualityRulesEngine();

const SCOPE_CHANGE_RULE_ID = "sprint-scope-change";

const getProjectName = async (): Promise<string> => {
  const projectService = await SDK.getService<IProjectPageService>(
    CommonServiceIds.ProjectPageService
  );
  const project = await projectService.getProject();
  if (!project) {
    throw new Error("Could not determine the current project.");
  }
  return project.name;
};

const AppContent: React.FC = () => {
  const [projectName, setProjectName] = React.useState<string | null>(null);
  const [isScanning, setIsScanning] = React.useState(false);
  const [progress, setProgress] = React.useState("");
  const [violations, setViolations] = React.useState<QualityViolation[]>([]);
  const [overallScore, setOverallScore] = React.useState<number | null>(null);
  const [sprintSummaries, setSprintSummaries] = React.useState<SprintQualitySummary[]>([]);
  const [assigneeSummary, setAssigneeSummary] = React.useState<AssigneeQualitySummary[]>([]);
  const [scopeChanges, setScopeChanges] = React.useState<ScopeChange[]>([]);
  const [totalItems, setTotalItems] = React.useState(0);
  const [settings, setSettings] = React.useState<QualitySettings>(DEFAULT_QUALITY_SETTINGS);
  const [showSettings, setShowSettings] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    settingsService.getSettings().then(setSettings).catch(console.error);
    getProjectName().then(setProjectName).catch(console.error);
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);
    setProgress("Starting scan...");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const project = projectName ?? (await getProjectName());

      const workItems: WorkItemData[] = await dataService.fetchWorkItems(
        project,
        setProgress,
        controller.signal
      );

      setTotalItems(workItems.length);
      setProgress("Analyzing quality...");

      const foundViolations = rulesEngine.evaluate(workItems, settings);
      const score = rulesEngine.computeScore(foundViolations, workItems.length);

      setViolations(foundViolations);
      setOverallScore(score);
      setSprintSummaries(buildSprintSummaries(workItems, foundViolations, [], rulesEngine));
      setAssigneeSummary(buildAssigneeSummaries(workItems, foundViolations));

      // Scope changes are detected per iteration rather than by the rules
      // engine, so only fetch them when the rule is switched on.
      const scopeRuleEnabled = settings.rules.some(
        (r) => r.ruleId === SCOPE_CHANGE_RULE_ID && r.enabled
      );
      let changes: ScopeChange[] = [];
      if (scopeRuleEnabled) {
        setProgress("Checking sprint scope changes...");
        try {
          const uniqueIterations = [
            ...new Set(workItems.map((wi) => wi.fields["System.IterationPath"])),
          ];
          changes = await dataService.fetchScopeChanges(
            project,
            uniqueIterations,
            settings.scopeChangeGraceHours,
            controller.signal
          );
        } catch (err) {
          if (controller.signal.aborted) throw err;
          changes = [];
        }
      }
      setScopeChanges(changes);
      setSprintSummaries(buildSprintSummaries(workItems, foundViolations, changes, rulesEngine));
      setProgress(`Scan complete. Found ${foundViolations.length} violations.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (controller.signal.aborted || message === "Cancelled") {
        setProgress("Scan cancelled.");
      } else {
        setError(message || "An unexpected error occurred.");
        setProgress("");
      }
    } finally {
      setIsScanning(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleSaveSettings = (newSettings: QualitySettings) => {
    setSettings(newSettings);
    settingsService.saveSettings(newSettings).catch((err) => {
      console.error(err);
      setError(
        `Settings were applied to this session but could not be saved: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    });
    setShowSettings(false);
  };

  const subtitle = projectName ? `${BRAND.tagline} · ${projectName}` : BRAND.tagline;

  return (
    <AppShell
      title={BRAND.name}
      subtitle={subtitle}
      mark={<BrandGlyph />}
      actions={
        <>
          <Button
            icon={<IconSettings />}
            aria-pressed={showSettings}
            onClick={() => setShowSettings(!showSettings)}
          >
            {showSettings ? "Hide Settings" : "Settings"}
          </Button>
          {isScanning ? (
            <Button variant="danger" icon={<IconStop />} onClick={handleCancel}>
              Cancel
            </Button>
          ) : (
            <Button variant="primary" icon={<IconPlay />} onClick={handleScan}>
              Scan Work Items
            </Button>
          )}
        </>
      }
    >
      {showSettings && (
        <QualitySettingsPanel
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {isScanning && (
        <div className="ax-section">
          <Progress label={progress} indeterminate />
        </div>
      )}

      {!isScanning && progress && (
        <div className="ax-section">
          <Banner tone={progress.startsWith("Scan complete") ? "success" : "info"}>
            {progress}
          </Banner>
        </div>
      )}

      {error && (
        <div className="ax-section">
          <Banner tone="error" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        </div>
      )}

      {overallScore != null && (
        <QualityScoreCard
          score={overallScore}
          totalItems={totalItems}
          totalViolations={violations.length}
        />
      )}

      {overallScore != null && <QualityTrendChart summaries={sprintSummaries} />}

      {violations.length > 0 && <ViolationsTable violations={violations} />}

      {sprintSummaries.length > 0 && <SprintSummaryTable summaries={sprintSummaries} />}

      {assigneeSummary.length > 0 && <AssigneeSummary assigneeSummary={assigneeSummary} />}

      {scopeChanges.length > 0 && <ScopeChangeLog scopeChanges={scopeChanges} />}

      <footer className="ax-footer">
        <span>{BRAND.name}</span>
        <span>Runs entirely in your browser · no data leaves Azure DevOps</span>
      </footer>
    </AppShell>
  );
};

export const App: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);
