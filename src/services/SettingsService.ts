import * as SDK from "azure-devops-extension-sdk";
import {
  CommonServiceIds,
  IExtensionDataService,
  IExtensionDataManager,
} from "azure-devops-extension-api";
import {
  QualitySettings,
  DEFAULT_QUALITY_SETTINGS,
  QUALITY_RULES,
  RuleSeverity,
} from "../models/interfaces";

const SETTINGS_COLLECTION = "work-item-quality-settings";
const SETTINGS_DOC_ID = "quality-settings";

const SEVERITIES: ReadonlySet<string> = new Set<RuleSeverity>(["Error", "Warning", "Info"]);

const isPositiveNumber = (value: unknown, min: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min;

/**
 * Reconciles a persisted document with the current defaults so that rules
 * added in a later release still run, and a malformed value in storage can
 * never put the app into a broken state. Exported for tests.
 */
export function normalizeSettings(stored: unknown): QualitySettings {
  const doc = (stored ?? {}) as Partial<Record<keyof QualitySettings, unknown>>;
  const storedRules = Array.isArray(doc.rules) ? (doc.rules as unknown[]) : [];
  const byId = new Map<string, { enabled?: unknown; severity?: unknown }>();
  for (const rule of storedRules) {
    if (rule && typeof rule === "object" && typeof (rule as any).ruleId === "string") {
      byId.set((rule as any).ruleId, rule as { enabled?: unknown; severity?: unknown });
    }
  }

  return {
    rules: QUALITY_RULES.map((rule) => {
      const saved = byId.get(rule.id);
      return {
        ruleId: rule.id,
        enabled: typeof saved?.enabled === "boolean" ? saved.enabled : rule.enabled,
        severity:
          typeof saved?.severity === "string" && SEVERITIES.has(saved.severity)
            ? (saved.severity as RuleSeverity)
            : rule.defaultSeverity,
      };
    }),
    stuckThresholdDays: isPositiveNumber(doc.stuckThresholdDays, 1)
      ? doc.stuckThresholdDays
      : DEFAULT_QUALITY_SETTINGS.stuckThresholdDays,
    excludedWorkItemIds: Array.isArray(doc.excludedWorkItemIds)
      ? doc.excludedWorkItemIds.filter((id): id is number => Number.isInteger(id))
      : [],
    excludedTags: Array.isArray(doc.excludedTags)
      ? doc.excludedTags.filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
      : [],
    scopeChangeGraceHours: isPositiveNumber(doc.scopeChangeGraceHours, 0)
      ? doc.scopeChangeGraceHours
      : DEFAULT_QUALITY_SETTINGS.scopeChangeGraceHours,
  };
}

export class SettingsService {
  private dataManagerPromise: Promise<IExtensionDataManager> | null = null;

  private async getDataManager(): Promise<IExtensionDataManager> {
    if (!this.dataManagerPromise) {
      this.dataManagerPromise = (async () => {
        const service = await SDK.getService<IExtensionDataService>(
          CommonServiceIds.ExtensionDataService
        );
        const accessToken = await SDK.getAccessToken();
        return service.getExtensionDataManager(SDK.getExtensionContext().id, accessToken);
      })().catch((err) => {
        // Let the next call retry instead of caching the failure forever.
        this.dataManagerPromise = null;
        throw err;
      });
    }
    return this.dataManagerPromise;
  }

  /**
   * Returns the saved settings merged over the defaults. A missing document
   * (first run) or a transient read failure yields the defaults without
   * writing anything, so a stored configuration is never overwritten by a
   * failed read.
   */
  async getSettings(): Promise<QualitySettings> {
    const manager = await this.getDataManager();
    try {
      const doc = await manager.getDocument(SETTINGS_COLLECTION, SETTINGS_DOC_ID);
      return normalizeSettings(doc);
    } catch {
      return normalizeSettings(DEFAULT_QUALITY_SETTINGS);
    }
  }

  async saveSettings(settings: QualitySettings): Promise<void> {
    const manager = await this.getDataManager();
    await manager.setDocument(SETTINGS_COLLECTION, { id: SETTINGS_DOC_ID, ...settings });
  }
}
