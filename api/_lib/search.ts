import type { SearchFinding } from "../../src/types";

export type SearchProvider = "tavily" | "brave" | "none";

export function activeProvider(): SearchProvider {
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.BRAVE_API_KEY) return "brave";
  return "none";
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

async function braveSearch(query: string): Promise<SearchFinding> {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=4`,
    { headers: { "X-Subscription-Token": process.env.BRAVE_API_KEY!, Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Brave ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    web?: { results?: { title: string; url: string; description: string }[] };
  };
  return {
    query,
    results: (json.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description.slice(0, 400),
    })),
  };
}

/** Runs up to 6 verification queries against whichever free provider is configured. */
export async function runSearches(queries: string[]): Promise<SearchFinding[]> {
  const provider = activeProvider();
  if (provider === "none") return [];
  const capped = queries.slice(0, 6);
  const settled = await Promise.allSettled(
    capped.map((q) => (provider === "tavily" ? tavilySearch(q) : braveSearch(q))),
  );
  return settled
    .filter((s): s is PromiseFulfilledResult<SearchFinding> => s.status === "fulfilled")
    .map((s) => s.value);
}
