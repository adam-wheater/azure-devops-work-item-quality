import * as React from "react";
import {
  QualitySettings as QualitySettingsType,
  QUALITY_RULES,
  RuleSeverity,
} from "../models/interfaces";
import { Button, Card, IconX } from "./ui";

interface QualitySettingsProps {
  settings: QualitySettingsType;
  onSave: (settings: QualitySettingsType) => void;
  onClose: () => void;
}

const SEVERITIES: RuleSeverity[] = ["Error", "Warning", "Info"];

/** "12, 34,abc" -> [12, 34]. Exported for tests. */
export const parseIdList = (text: string): number[] =>
  text
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

/** "a, b ,," -> ["a", "b"]. Exported for tests. */
export const parseTagList = (text: string): string[] =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const QualitySettingsPanel: React.FC<QualitySettingsProps> = ({
  settings,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = React.useState<QualitySettingsType>({ ...settings });
  // The comma-separated lists are kept as typed; parsing on every keystroke
  // would strip the separator the user has just entered.
  const [excludedIdsText, setExcludedIdsText] = React.useState(
    settings.excludedWorkItemIds.join(", ")
  );
  const [excludedTagsText, setExcludedTagsText] = React.useState(settings.excludedTags.join(", "));

  const handleRuleToggle = (ruleId: string) => {
    setDraft((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.ruleId === ruleId ? { ...r, enabled: !r.enabled } : r)),
    }));
  };

  const handleSeverityChange = (ruleId: string, severity: RuleSeverity) => {
    setDraft((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.ruleId === ruleId ? { ...r, severity } : r)),
    }));
  };

  const handleNumberChange =
    (key: "stuckThresholdDays" | "scopeChangeGraceHours", min: number) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      if (e.target.value === "" || !Number.isFinite(value) || value < min) return;
      setDraft((prev) => ({ ...prev, [key]: value }));
    };

  const handleSave = () => {
    onSave({
      ...draft,
      excludedWorkItemIds: parseIdList(excludedIdsText),
      excludedTags: parseTagList(excludedTagsText),
    });
  };

  return (
    <Card
      title="Quality Settings"
      hint="Choose which rules run, how severe they are, and what to skip"
      actions={
        <Button size="sm" icon={<IconX />} onClick={onClose} aria-label="Close settings">
          Close
        </Button>
      }
    >
      <h3 className="ax-label" style={{ margin: "0 0 8px" }}>
        Rules
      </h3>
      <div className="ax-table-wrap" style={{ marginBottom: "var(--ax-s5)" }}>
        <table className="ax-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            {QUALITY_RULES.map((rule) => {
              const setting = draft.rules.find((r) => r.ruleId === rule.id);
              const enabled = setting?.enabled ?? rule.enabled;
              return (
                <tr key={rule.id}>
                  <td>
                    <label className="ax-check">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => handleRuleToggle(rule.id)}
                      />
                      <span>
                        {rule.name}
                        <span className="ax-help" style={{ marginLeft: 8 }}>
                          {rule.description}
                        </span>
                      </span>
                    </label>
                  </td>
                  <td>
                    <select
                      className="ax-select ax-input--sm"
                      aria-label={`${rule.name} severity`}
                      value={setting?.severity ?? rule.defaultSeverity}
                      onChange={(e) =>
                        handleSeverityChange(rule.id, e.target.value as RuleSeverity)
                      }
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ax-form-grid">
        <div className="ax-field">
          <label className="ax-label" htmlFor="wiq-stuck-threshold">
            Stuck threshold (days)
          </label>
          <input
            id="wiq-stuck-threshold"
            type="number"
            className="ax-input ax-input--num"
            min={1}
            value={draft.stuckThresholdDays}
            onChange={handleNumberChange("stuckThresholdDays", 1)}
          />
          <span className="ax-help">
            Items unchanged for longer than this are flagged as stuck.
          </span>
        </div>
        <div className="ax-field">
          <label className="ax-label" htmlFor="wiq-scope-grace">
            Scope change grace (hours)
          </label>
          <input
            id="wiq-scope-grace"
            type="number"
            className="ax-input ax-input--num"
            min={0}
            value={draft.scopeChangeGraceHours}
            onChange={handleNumberChange("scopeChangeGraceHours", 0)}
          />
          <span className="ax-help">
            Changes within this window after sprint start are ignored.
          </span>
        </div>
      </div>

      <div className="ax-field">
        <label className="ax-label" htmlFor="wiq-excluded-ids">
          Excluded Work Item IDs (comma-separated)
        </label>
        <input
          id="wiq-excluded-ids"
          type="text"
          className="ax-input"
          value={excludedIdsText}
          onChange={(e) => setExcludedIdsText(e.target.value)}
        />
      </div>
      <div className="ax-field">
        <label className="ax-label" htmlFor="wiq-excluded-tags">
          Excluded Tags (comma-separated)
        </label>
        <input
          id="wiq-excluded-tags"
          type="text"
          className="ax-input"
          value={excludedTagsText}
          onChange={(e) => setExcludedTagsText(e.target.value)}
        />
      </div>

      <hr className="ax-divider" />
      <div className="ax-row">
        <Button variant="primary" onClick={handleSave}>
          Save Settings
        </Button>
      </div>
    </Card>
  );
};
