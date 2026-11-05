import { CommonServiceIds } from "azure-devops-extension-api";
import { __resetMockServices, __setMockService } from "../__mocks__/azure-devops-extension-sdk";
import { normalizeSettings, SettingsService } from "@/services/SettingsService";
import { DEFAULT_QUALITY_SETTINGS, QUALITY_RULES } from "@/models/interfaces";

describe("normalizeSettings", () => {
  it("returns defaults for an empty or malformed document", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_QUALITY_SETTINGS);
    expect(normalizeSettings({ rules: "nope", stuckThresholdDays: -3, excludedTags: 7 })).toEqual(
      DEFAULT_QUALITY_SETTINGS
    );
  });

  it("keeps saved rule overrides and adds rules missing from an older document", () => {
    const stored = {
      id: "quality-settings",
      __etag: 3,
      rules: [{ ruleId: "no-estimate", enabled: false, severity: "Info" }],
      stuckThresholdDays: 30,
      excludedWorkItemIds: [1, "x", 2.5, 3],
      excludedTags: ["spike", "", 4],
      scopeChangeGraceHours: 0,
    };
    const result = normalizeSettings(stored);
    expect(result.rules).toHaveLength(QUALITY_RULES.length);
    expect(result.rules.find((r) => r.ruleId === "no-estimate")).toEqual({
      ruleId: "no-estimate",
      enabled: false,
      severity: "Info",
    });
    expect(result.rules.find((r) => r.ruleId === "empty-title")).toEqual({
      ruleId: "empty-title",
      enabled: true,
      severity: "Error",
    });
    expect(result.stuckThresholdDays).toBe(30);
    expect(result.scopeChangeGraceHours).toBe(0);
    expect(result.excludedWorkItemIds).toEqual([1, 3]);
    expect(result.excludedTags).toEqual(["spike"]);
  });

  it("falls back to the default severity for an unknown value", () => {
    const result = normalizeSettings({ rules: [{ ruleId: "no-estimate", severity: "Fatal" }] });
    expect(result.rules.find((r) => r.ruleId === "no-estimate")!.severity).toBe("Warning");
  });
});

describe("SettingsService", () => {
  const getDocument = jest.fn();
  const setDocument = jest.fn();

  beforeEach(() => {
    getDocument.mockReset();
    setDocument.mockReset();
    __resetMockServices();
    __setMockService(CommonServiceIds.ExtensionDataService, {
      getExtensionDataManager: () => Promise.resolve({ getDocument, setDocument }),
    });
  });

  it("returns defaults without writing when the document cannot be read", async () => {
    getDocument.mockRejectedValue(new Error("503"));
    const settings = await new SettingsService().getSettings();
    expect(settings).toEqual(DEFAULT_QUALITY_SETTINGS);
    expect(setDocument).not.toHaveBeenCalled();
  });

  it("saves the document under the fixed id", async () => {
    setDocument.mockResolvedValue({});
    await new SettingsService().saveSettings(DEFAULT_QUALITY_SETTINGS);
    expect(setDocument).toHaveBeenCalledWith("work-item-quality-settings", {
      id: "quality-settings",
      ...DEFAULT_QUALITY_SETTINGS,
    });
  });
});
