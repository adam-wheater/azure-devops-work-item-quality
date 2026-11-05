import * as React from "react";
import { QualityViolation, RuleSeverity } from "../models/interfaces";
import { Card, IconSearch, Pill, SortHeader, Tone } from "./ui";

interface ViolationsTableProps {
  violations: QualityViolation[];
}

type SortField = "workItemId" | "severity" | "ruleName" | "workItemType" | "assignedTo";
type SortDir = "asc" | "desc";

const SEVERITY_ORDER: Record<RuleSeverity, number> = { Error: 0, Warning: 1, Info: 2 };
const SEVERITY_TONE: Record<RuleSeverity, Tone> = {
  Error: "danger",
  Warning: "warn",
  Info: "info",
};

const COLUMNS: { field: SortField | null; label: string; numeric?: boolean }[] = [
  { field: "workItemId", label: "ID", numeric: true },
  { field: null, label: "Title" },
  { field: "workItemType", label: "Type" },
  { field: "ruleName", label: "Rule" },
  { field: "severity", label: "Severity" },
  { field: "assignedTo", label: "Assignee" },
  { field: null, label: "Iteration" },
];

export const ViolationsTable: React.FC<ViolationsTableProps> = ({ violations }) => {
  const [searchText, setSearchText] = React.useState("");
  const [filterRule, setFilterRule] = React.useState("");
  const [filterSeverity, setFilterSeverity] = React.useState("");
  const [filterType, setFilterType] = React.useState("");
  const [filterIteration, setFilterIteration] = React.useState("");
  const [filterAssignee, setFilterAssignee] = React.useState("");
  const [sortField, setSortField] = React.useState<SortField>("severity");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  const uniqueRules = React.useMemo(
    () => [...new Set(violations.map((v) => v.ruleName))].sort(),
    [violations]
  );
  const uniqueTypes = React.useMemo(
    () => [...new Set(violations.map((v) => v.workItemType))].sort(),
    [violations]
  );
  const uniqueIterations = React.useMemo(
    () => [...new Set(violations.map((v) => v.iterationPath))].sort(),
    [violations]
  );
  const uniqueAssignees = React.useMemo(
    () => [...new Set(violations.map((v) => v.assignedTo))].sort(),
    [violations]
  );

  const filtered = React.useMemo(() => {
    let result = violations;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (v) => v.workItemTitle.toLowerCase().includes(lower) || String(v.workItemId).includes(lower)
      );
    }
    if (filterRule) result = result.filter((v) => v.ruleName === filterRule);
    if (filterSeverity) result = result.filter((v) => v.severity === filterSeverity);
    if (filterType) result = result.filter((v) => v.workItemType === filterType);
    if (filterIteration) result = result.filter((v) => v.iterationPath === filterIteration);
    if (filterAssignee) result = result.filter((v) => v.assignedTo === filterAssignee);
    return result;
  }, [
    violations,
    searchText,
    filterRule,
    filterSeverity,
    filterType,
    filterIteration,
    filterAssignee,
  ]);

  const sorted = React.useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "workItemId":
          cmp = a.workItemId - b.workItemId;
          break;
        case "severity":
          cmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
          break;
        case "ruleName":
          cmp = a.ruleName.localeCompare(b.ruleName);
          break;
        case "workItemType":
          cmp = a.workItemType.localeCompare(b.workItemType);
          break;
        case "assignedTo":
          cmp = a.assignedTo.localeCompare(b.assignedTo);
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return items;
  }, [filtered, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const hint =
    sorted.length === violations.length
      ? `${violations.length} found`
      : `${sorted.length} of ${violations.length} shown`;

  return (
    <Card title="Violations" hint={hint} flush>
      <div className="ax-toolbar" style={{ padding: "var(--ax-s4) var(--ax-s5) 0" }}>
        <label className="ax-search">
          <span className="ax-search__icon">
            <IconSearch />
          </span>
          <input
            type="text"
            className="ax-input"
            placeholder="Search by title or ID..."
            aria-label="Search violations"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </label>
        <select
          className="ax-select"
          aria-label="Filter by rule"
          value={filterRule}
          onChange={(e) => setFilterRule(e.target.value)}
        >
          <option value="">All Rules</option>
          {uniqueRules.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          className="ax-select"
          aria-label="Filter by severity"
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
        >
          <option value="">All Severities</option>
          <option value="Error">Error</option>
          <option value="Warning">Warning</option>
          <option value="Info">Info</option>
        </select>
        <select
          className="ax-select"
          aria-label="Filter by work item type"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All Types</option>
          {uniqueTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="ax-select"
          aria-label="Filter by iteration"
          value={filterIteration}
          onChange={(e) => setFilterIteration(e.target.value)}
        >
          <option value="">All Iterations</option>
          {uniqueIterations.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <select
          className="ax-select"
          aria-label="Filter by assignee"
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
        >
          <option value="">All Assignees</option>
          {uniqueAssignees.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <div className="ax-table-wrap">
        <table className="ax-table">
          <thead>
            <tr>
              {COLUMNS.map((col) =>
                col.field ? (
                  <SortHeader
                    key={col.label}
                    label={col.label}
                    active={sortField === col.field}
                    direction={sortDir}
                    numeric={col.numeric}
                    onClick={() => handleSort(col.field!)}
                  />
                ) : (
                  <th key={col.label}>{col.label}</th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="ax-muted" style={{ textAlign: "center" }}>
                  No violations found
                </td>
              </tr>
            ) : (
              sorted.map((v, idx) => (
                <tr key={`${v.workItemId}-${v.ruleId}-${idx}`}>
                  <td className="ax-num">
                    <a
                      className="ax-link"
                      href={v.workItemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {v.workItemId}
                    </a>
                  </td>
                  <td>{v.workItemTitle}</td>
                  <td className="ax-muted">{v.workItemType}</td>
                  <td className="ax-muted" title={v.details}>
                    {v.ruleName}
                  </td>
                  <td>
                    <Pill tone={SEVERITY_TONE[v.severity]}>{v.severity}</Pill>
                  </td>
                  <td className="ax-muted">{v.assignedTo}</td>
                  <td className="ax-muted" style={{ whiteSpace: "nowrap" }}>
                    {v.iterationPath}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
