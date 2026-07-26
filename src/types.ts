// Shared between the browser app and the Vercel API functions.

export type Category =
  | "side_hustle"
  | "automation_tool"
  | "repo_or_tool"
  | "product"
  | "content_technique"
  | "other";

export type Verdict = "BUILD" | "INVESTIGATE" | "SKIP";

export interface Extraction {
  summary: string;
  category: Category;
  onScreenText: string[];
  claims: string[];
  namedEntities: string[];
  searchQueries: string[];
  sellsProduct: boolean;
}

export interface SearchFinding {
  query: string;
  results: { title: string; url: string; snippet: string }[];
}

export interface Judgment {
  verdict: Verdict;
  confidence: number; // 0–100 legitimacy/viability confidence
  headline: string;
  brief: string; // markdown
  redFlags: string[];
  evidence: string[];
  buildable: boolean;
}

export interface TriageMeta {
  extractor: "gemini" | "haiku";
  searchProvider: "linkup" | "tavily" | "none";
  searchesRun: number;
}

export interface TriageResponse {
  extraction: Extraction;
  findings: SearchFinding[];
  judgment: Judgment;
  meta: TriageMeta;
}

export interface TriageRequest {
  frames: string[]; // base64 JPEG data URLs, extracted client-side
  caption: string;
  context: string;
  filename: string;
}

export interface ActRequest {
  extraction: Extraction;
  judgment: Judgment;
  context: string;
}

export interface ActResponse {
  deliverable: string; // markdown
}
