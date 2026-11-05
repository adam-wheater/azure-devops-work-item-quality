import { __resetMockClients, __setMockClient } from "../__mocks__/azure-devops-extension-api";
import { escapeWiql, WorkItemDataService } from "@/services/WorkItemDataService";

describe("escapeWiql", () => {
  it("doubles single quotes", () => {
    expect(escapeWiql("Team\\O'Brien's Sprint")).toBe("Team\\O''Brien''s Sprint");
  });
});

describe("WorkItemDataService.fetchScopeChanges", () => {
  const queryByWiql = jest.fn();
  const getWorkItems = jest.fn();

  beforeEach(() => {
    queryByWiql.mockReset();
    getWorkItems.mockReset();
    __resetMockClients();
    __setMockClient("WorkItemTrackingRestClient", { queryByWiql, getWorkItems });
  });

  it("escapes the iteration path and fetches every batch of ids", async () => {
    const ids = Array.from({ length: 450 }, (_, i) => i + 1);
    queryByWiql.mockResolvedValue({ workItems: ids.map((id) => ({ id })) });
    getWorkItems.mockImplementation((batch: number[]) =>
      Promise.resolve(
        batch.map((id) => ({
          id,
          fields: {
            "System.Id": id,
            "System.Title": `WI ${id}`,
            "System.ChangedDate": "2026-01-02T00:00:00Z",
          },
        }))
      )
    );

    const changes = await new WorkItemDataService().fetchScopeChanges(
      "Fabrikam",
      ["Fabrikam\\O'Brien Sprint"],
      24
    );

    expect(queryByWiql.mock.calls[0][0].query).toContain("'Fabrikam\\O''Brien Sprint'");
    expect(getWorkItems).toHaveBeenCalledTimes(3);
    expect(getWorkItems.mock.calls.map((c) => c[0].length)).toEqual([200, 200, 50]);
    expect(changes).toHaveLength(450);
    expect(changes[0]).toMatchObject({
      workItemId: 1,
      action: "added",
      iterationPath: "Fabrikam\\O'Brien Sprint",
    });
  });

  it("stops when the abort signal fires", async () => {
    const controller = new AbortController();
    controller.abort();
    queryByWiql.mockResolvedValue({ workItems: [{ id: 1 }] });
    await expect(
      new WorkItemDataService().fetchScopeChanges(
        "Fabrikam",
        ["Fabrikam\\Sprint 1"],
        24,
        controller.signal
      )
    ).rejects.toThrow("Cancelled");
    expect(queryByWiql).not.toHaveBeenCalled();
  });
});
