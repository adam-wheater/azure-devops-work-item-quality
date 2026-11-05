import { getClient } from "azure-devops-extension-api";
import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";
import { ConcurrencyLimiter } from "../utils/ConcurrencyLimiter";
import { ScopeChange, WorkItemData } from "../models/interfaces";

const BATCH_SIZE = 200;
const MAX_CONCURRENT = 4;
const WIQL_PAGE_SIZE = 19999;

/** WIQL string literals are single-quoted; an embedded quote is doubled. Exported for tests. */
export const escapeWiql = (value: string): string => value.replace(/'/g, "''");

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

export class WorkItemDataService {
  async fetchWorkItems(
    projectName: string,
    onProgress?: (message: string) => void,
    signal?: AbortSignal
  ): Promise<WorkItemData[]> {
    const client: any = getClient(WorkItemTrackingRestClient);

    onProgress?.("Querying work items...");

    if (signal?.aborted) throw new Error("Cancelled");

    // Paginate WIQL queries to avoid the 20,000 item limit (VS402337)
    const ids: number[] = [];
    let lastMaxId = 0;
    let page = 0;

    // Only look at items created from the start of last year onward
    const cutoffYear = new Date().getFullYear() - 1;
    const createdDateFilter = ` AND [System.CreatedDate] >= '${cutoffYear}-01-01T00:00:00Z'`;

    while (true) {
      if (signal?.aborted) throw new Error("Cancelled");

      const idFilter = lastMaxId > 0 ? ` AND [System.Id] > ${lastMaxId}` : "";
      const queryResult = await client.queryByWiql(
        {
          query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.State] NOT IN ('Done', 'Removed')${createdDateFilter}${idFilter} ORDER BY [System.Id]`,
        },
        projectName,
        undefined,
        undefined,
        WIQL_PAGE_SIZE
      );

      const workItemRefs = queryResult.workItems || [];
      if (workItemRefs.length === 0) break;

      const pageIds: number[] = workItemRefs.map((ref: any) => ref.id);
      ids.push(...pageIds);
      lastMaxId = pageIds[pageIds.length - 1];
      page++;

      onProgress?.(`Discovered ${ids.length} work items (page ${page})...`);

      if (workItemRefs.length < WIQL_PAGE_SIZE) break;
    }

    if (ids.length === 0) {
      onProgress?.("No work items found.");
      return [];
    }

    onProgress?.(`Found ${ids.length} work items. Fetching details...`);

    const limiter = new ConcurrencyLimiter(MAX_CONCURRENT);
    const batches = chunk(ids, BATCH_SIZE);

    let completedBatches = 0;
    const results = await limiter.map(batches, async (batch) => {
      if (signal?.aborted) throw new Error("Cancelled");

      const items = await client.getWorkItems(
        batch,
        projectName,
        undefined, // fields cannot be combined with $expand
        undefined,
        4 // WorkItemExpand.Relations
      );

      completedBatches++;
      onProgress?.(
        `Fetched ${Math.min(completedBatches * BATCH_SIZE, ids.length)} / ${ids.length} work items...`
      );

      return items as WorkItemData[];
    });

    return results.flat();
  }

  async fetchScopeChanges(
    projectName: string,
    iterations: string[],
    _graceHours: number,
    signal?: AbortSignal
  ): Promise<ScopeChange[]> {
    const client: any = getClient(WorkItemTrackingRestClient);
    const scopeChanges: ScopeChange[] = [];

    const limiter = new ConcurrencyLimiter(MAX_CONCURRENT);

    await limiter.map(iterations, async (iterationPath) => {
      if (signal?.aborted) throw new Error("Cancelled");

      const queryResult = await client.queryByWiql(
        {
          query: `SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] = '${escapeWiql(
            iterationPath
          )}' AND [System.TeamProject] = '${escapeWiql(projectName)}' ORDER BY [System.Id]`,
        },
        projectName,
        undefined,
        undefined,
        WIQL_PAGE_SIZE
      );

      const refs = queryResult.workItems || [];
      if (refs.length === 0) return;

      const ids: number[] = refs.map((r: any) => r.id);

      for (const batchIds of chunk(ids, BATCH_SIZE)) {
        if (signal?.aborted) throw new Error("Cancelled");
        try {
          const updates = await client.getWorkItems(
            batchIds,
            projectName,
            ["System.Id", "System.Title", "System.IterationPath", "System.ChangedDate"],
            undefined,
            0
          );

          for (const item of updates) {
            if (item && item.fields) {
              scopeChanges.push({
                workItemId: item.fields["System.Id"] || item.id,
                title: item.fields["System.Title"] || "",
                action: "added",
                changedDate: new Date(item.fields["System.ChangedDate"]),
                changedBy: "System",
                iterationPath,
              });
            }
          }
        } catch {
          // Skip this batch if the details request fails
        }
      }
    });

    return scopeChanges;
  }
}
