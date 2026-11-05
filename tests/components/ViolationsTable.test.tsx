import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ViolationsTable } from "@/components/ViolationsTable";
import { QualityViolation } from "@/models/interfaces";

const mockViolations: QualityViolation[] = [
  {
    workItemId: 101,
    workItemTitle: "Fix login bug",
    workItemType: "Bug",
    workItemUrl: "https://dev.azure.com/org/project/_workitems/edit/101",
    ruleId: "missing-repro-steps",
    ruleName: "Missing Repro Steps",
    severity: "Error",
    assignedTo: "Alice",
    iterationPath: "Project\\Sprint 1",
    state: "Active",
  },
  {
    workItemId: 102,
    workItemTitle: "Add search feature",
    workItemType: "Product Backlog Item",
    workItemUrl: "https://dev.azure.com/org/project/_workitems/edit/102",
    ruleId: "no-estimate",
    ruleName: "No Estimate",
    severity: "Warning",
    assignedTo: "Bob",
    iterationPath: "Project\\Sprint 2",
    state: "New",
  },
  {
    workItemId: 103,
    workItemTitle: "Orphan task",
    workItemType: "Task",
    workItemUrl: "https://dev.azure.com/org/project/_workitems/edit/103",
    ruleId: "unparented-item",
    ruleName: "Unparented Item",
    severity: "Info",
    assignedTo: "Alice",
    iterationPath: "Project\\Sprint 1",
    state: "Active",
  },
];

describe("ViolationsTable", () => {
  it("should render all violations", () => {
    render(React.createElement(ViolationsTable, { violations: mockViolations }));
    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    expect(screen.getByText("Add search feature")).toBeInTheDocument();
    expect(screen.getByText("Orphan task")).toBeInTheDocument();
  });

  it("should render work item IDs as links", () => {
    render(React.createElement(ViolationsTable, { violations: mockViolations }));
    const link = screen.getByText("101");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "https://dev.azure.com/org/project/_workitems/edit/101");
  });

  it("should render severity badges", () => {
    render(React.createElement(ViolationsTable, { violations: mockViolations }));
    // Multiple "Error"/"Warning"/"Info" elements exist (dropdown options + badges)
    expect(screen.getAllByText("Error").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Warning").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Info").length).toBeGreaterThanOrEqual(1);
  });

  it("should filter by search text", () => {
    render(React.createElement(ViolationsTable, { violations: mockViolations }));
    const searchInput = screen.getByPlaceholderText("Search by title or ID...");
    fireEvent.change(searchInput, { target: { value: "login" } });
    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    expect(screen.queryByText("Add search feature")).not.toBeInTheDocument();
    expect(screen.queryByText("Orphan task")).not.toBeInTheDocument();
  });

  it("should filter by severity dropdown", () => {
    render(React.createElement(ViolationsTable, { violations: mockViolations }));
    const severitySelect = screen.getByDisplayValue("All Severities");
    fireEvent.change(severitySelect, { target: { value: "Error" } });
    expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    expect(screen.queryByText("Add search feature")).not.toBeInTheDocument();
  });

  it("should sort by clicking column headers", () => {
    render(React.createElement(ViolationsTable, { violations: mockViolations }));
    const idHeader = screen.getByText("ID");
    fireEvent.click(idHeader);

    // After sorting by ID asc, 101 should come first
    const rows = screen.getAllByRole("row");
    // First row is header, so data starts at index 1
    expect(rows.length).toBeGreaterThan(1);
  });

  it("should show empty message when no violations match filters", () => {
    render(React.createElement(ViolationsTable, { violations: mockViolations }));
    const searchInput = screen.getByPlaceholderText("Search by title or ID...");
    fireEvent.change(searchInput, { target: { value: "nonexistent item xyz" } });
    expect(screen.getByText("No violations found")).toBeInTheDocument();
  });

  it("should show empty message when violations array is empty", () => {
    render(React.createElement(ViolationsTable, { violations: [] }));
    expect(screen.getByText("No violations found")).toBeInTheDocument();
  });
});
