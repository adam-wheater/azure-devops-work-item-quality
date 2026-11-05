// Sample data for the demo build: a fictional "Contoso" project with six sprints
// of work items, some ready and some not. See demo/kit.ts for the helpers.
import { CommonServiceIds, clientFactory, delay, extensionDataService, projectPageService } from "./kit";

export { CommonServiceIds };

const DAY = 86_400_000;
const now = Date.now();
const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

// Small deterministic generator so every screenshot run shows the same data.
let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)];

const people = ["Priya Shah", "Tom Ellis", "Maria Lopez", "Sam Okafor", "Chen Wei", "Ruth Adams"];
const sprints = [36, 37, 38, 39, 40, 41].map((n) => `Contoso\\Sprint ${n}`);
const storyTitles = [
  "Export invoices as CSV", "Remember last used filter", "Bulk archive old projects",
  "Show sync status on dashboard", "Add SSO sign-in for partners", "Paginate audit log",
  "Email digest of overdue tasks", "Customer search by postcode", "Rate limit public API",
  "Dark mode for reports", "Retry failed webhooks", "Upload profile photos",
];
const bugTitles = [
  "Totals wrong when currency is EUR", "Date picker ignores locale", "Session expires mid-upload",
  "Duplicate rows after refresh", "PDF export cuts off last page", "Search misses archived items",
];

const items: any[] = [];
let nextId = 4100;
const add = (fields: Record<string, any>, relations: any[] = []) => {
  const id = nextId++;
  items.push({ id, url: `https://dev.azure.com/contoso/_apis/wit/workItems/${id}`, relations, fields: { "System.Id": id, ...fields } });
  return id;
};
const link = (rel: string, id: number) => ({ rel, url: `https://dev.azure.com/contoso/_apis/wit/workItems/${id}`, attributes: {} });

const epic = add({ "System.Title": "Self-service billing", "System.WorkItemType": "Epic", "System.State": "Active", "System.IterationPath": "Contoso\\Sprint 41", "System.ChangedDate": iso(3), "System.CreatedDate": iso(160) });
add({ "System.Title": "Partner portal", "System.WorkItemType": "Epic", "System.State": "New", "System.IterationPath": "Contoso\\Sprint 41", "System.ChangedDate": iso(6), "System.CreatedDate": iso(120) });
const feature = add({ "System.Title": "Invoice exports", "System.WorkItemType": "Feature", "System.State": "Active", "System.IterationPath": "Contoso\\Sprint 41", "System.ChangedDate": iso(2), "System.CreatedDate": iso(150) }, [link("System.LinkTypes.Hierarchy-Reverse", epic)]);
items[0].relations.push(link("System.LinkTypes.Hierarchy-Forward", feature));

// Every item starts ready. Each sprint then gets a few named problems, fewer in
// later sprints, so the trend climbs. The score charges 10 points per error,
// 5 per warning and 1 per info for every 100 items, hence 30 items a sprint.
type Flaw = "repro" | "criteria" | "estimate" | "stuck" | "orphan" | "unassigned";
const flaws: Flaw[][] = [
  ["stuck", "orphan", "orphan", "orphan"],
  ["estimate", "orphan", "orphan"],
  ["repro", "orphan"],
  ["stuck"],
  ["orphan", "orphan"],
  ["unassigned"],
];

sprints.forEach((sprint, s) => {
  const age = (sprints.length - s) * 14;
  for (let i = 0; i < 30; i++) {
    const flaw = flaws[s][i];
    const isBug = flaw === "repro" || (flaw !== "criteria" && i % 4 === 3);
    const fields: Record<string, any> = {
      "System.Title": pick(isBug ? bugTitles : storyTitles),
      "System.WorkItemType": isBug ? "Bug" : "Product Backlog Item",
      "System.State": s >= 4 ? pick(["New", "Approved", "Committed"]) : "Committed",
      "System.IterationPath": sprint,
      "System.CreatedDate": iso(age + 3),
      "System.ChangedDate": iso(flaw === "stuck" ? age + 2 : 1 + Math.floor(rand() * 4)),
      "System.Description": "<p>As a customer I want this so that I can finish my work faster.</p>",
      "Microsoft.VSTS.Scheduling.Effort": flaw === "estimate" ? undefined : pick([1, 2, 3, 5, 8]),
    };
    if (flaw !== "unassigned") fields["System.AssignedTo"] = { displayName: pick(people) };
    if (flaw !== "repro" && flaw !== "criteria") {
      fields[isBug ? "Microsoft.VSTS.TCM.ReproSteps" : "Microsoft.VSTS.Common.AcceptanceCriteria"] =
        "<ul><li>Given a signed-in user</li><li>When they open the page</li><li>Then the result shows</li></ul>";
    }
    add(fields, flaw === "orphan" ? [] : [link("System.LinkTypes.Hierarchy-Reverse", feature)]);
  }
});

const byId = new Map(items.map((wi) => [wi.id, wi]));

const settings = extensionDataService();

export const services: Record<string, unknown> = {
  [CommonServiceIds.ProjectPageService]: projectPageService("Contoso"),
  [CommonServiceIds.ExtensionDataService]: settings,
};

export const getClient = clientFactory({
  WorkItemTrackingRestClient: {
    queryByWiql: (wiql: { query: string }) => {
      const sprint = /IterationPath\] = '([^']+)'/.exec(wiql.query)?.[1]?.replace(/\\\\/g, "\\");
      const after = Number(/System\.Id\] > (\d+)/.exec(wiql.query)?.[1] ?? 0);
      const matches = items.filter((wi) =>
        sprint ? wi.fields["System.IterationPath"] === sprint : wi.id > after
      );
      return delay({ workItems: matches.map((wi) => ({ id: wi.id })) }, 300);
    },
    getWorkItems: (ids: number[]) => delay(ids.map((id) => byId.get(id)).filter(Boolean), 250),
  },
});
