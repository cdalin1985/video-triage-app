import type { SearchFinding } from "../../src/types";

// Provider chain, most-generous free tier first:
//   Linkup — $20/mo recurring credit ≈ 4,000 standard searches, no card
//   Tavily — 1,000 credits/mo, no card
// Brave was dropped: as of early 2026 its free tier is gone for new signups
// (card required, silent overage billing), so it's a trap, not a fallback.
export type SearchProvider = "linkup" | "tavily" | "none";

export function activeProvider(): SearchProvider {
  if (process.env.LINKUP_API_KEY) return "linkup";
  if (process.env.TAVILY_API_KEY) return "tavily";
  return "none";
}

async function linkupSearch(query: string): Promise<SearchFinding> {
  const res = await fetch("https://api.linkup.so/v1/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.LINKUP_API_KEY}`,
    },
    body: JSON.stringify({
      q: query,
      depth: "standard", // cheapest tier — $0.005/query against the free credit
      outputType: "searchResults",
    }),
  });
  if (!res.ok) throw new Error(`Linkup ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    results?: { type?: string; name?: string; url?: string; content?: string }[];
  };
  return {
    query,
    results: (json.results ?? [])
      .filter((r) => r.type !== "image" && r.url)
      .slice(0, 4)
      .map((r) => ({
        title: r.name ?? r.url ?? "",
        url: r.url ?? "",
        snippet: (r.content ?? "").slice(0, 400),
      })),
  };
}

async function tavilySearch(query: string): Promise<SearchFinding> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: 4,
      search_depth: "basic",
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    results?: { title: string; url: string; content: string }[];
  };
  return {
    query,
    results: (json.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 400),
    })),
  };
}

/** Runs up to 6 verification queries against whichever free provider is configured. */
export async function runSearches(queries: string[]): Promise<SearchFinding[]> {
  const provider = activeProvider();
  if (provider === "none") return [];
  const capped = queries.slice(0, 6);
  const settled = await Promise.allSettled(
    capped.map((q) => (provider === "linkup" ? linkupSearch(q) : tavilySearch(q))),
  );
  return settled
    .filter((s): s is PromiseFulfilledResult<SearchFinding> => s.status === "fulfilled")
    .map((s) => s.value);
}
