import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { parseIdList, parseTagList, QualitySettingsPanel } from "@/components/QualitySettings";
import { DEFAULT_QUALITY_SETTINGS } from "@/models/interfaces";

describe("parse helpers", () => {
  it("parses comma-separated ids and tags, ignoring junk", () => {
    expect(parseIdList("12, 34,abc, ,56")).toEqual([12, 34, 56]);
    expect(parseTagList(" spike , , tech-debt,")).toEqual(["spike", "tech-debt"]);
  });
});

describe("QualitySettingsPanel", () => {
  it("lets the user type a comma-separated list and parses it on save", () => {
    const onSave = jest.fn();
    render(
      <QualitySettingsPanel
        settings={DEFAULT_QUALITY_SETTINGS}
        onSave={onSave}
        onClose={() => {}}
      />
    );
    const ids = screen.getByLabelText("Excluded Work Item IDs (comma-separated)");
    fireEvent.change(ids, { target: { value: "12, " } });
    expect(ids).toHaveValue("12, ");
    fireEvent.change(ids, { target: { value: "12, 34" } });

    const tags = screen.getByLabelText("Excluded Tags (comma-separated)");
    fireEvent.change(tags, { target: { value: "spike, wip" } });

    fireEvent.click(screen.getByText("Save Settings"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ excludedWorkItemIds: [12, 34], excludedTags: ["spike", "wip"] })
    );
  });

  it("accepts a zero-hour scope change grace period", () => {
    const onSave = jest.fn();
    render(
      <QualitySettingsPanel
        settings={DEFAULT_QUALITY_SETTINGS}
        onSave={onSave}
        onClose={() => {}}
      />
    );
    fireEvent.change(screen.getByLabelText("Scope change grace (hours)"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByText("Save Settings"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ scopeChangeGraceHours: 0 }));
  });

  it("toggles a rule and changes its severity", () => {
    const onSave = jest.fn();
    render(
      <QualitySettingsPanel
        settings={DEFAULT_QUALITY_SETTINGS}
        onSave={onSave}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /^No Estimate/ }));
    fireEvent.change(screen.getByLabelText("No Estimate severity"), { target: { value: "Info" } });
    fireEvent.click(screen.getByText("Save Settings"));
    const saved = onSave.mock.calls[0][0];
    expect(saved.rules.find((r: any) => r.ruleId === "no-estimate")).toEqual({
      ruleId: "no-estimate",
      enabled: false,
      severity: "Info",
    });
  });
});
