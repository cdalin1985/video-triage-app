// Phase 1 of the two-phase API: EXTRACT (Tier A) → SEARCH → VALIDATE+BRIEF (Tier B).
// Phase 2 (ACT) lives in api/act.ts and only ever runs after the human approves.

import {
  EXTRACT_SYSTEM,
  extractUserPrompt,
  JUDGE_SYSTEM,
  judgeUserPrompt,
} from "../src/prompts";
import type { Extraction, Judgment, TriageRequest, TriageResponse } from "../src/types";
import { parseModelJson, runExtractor, runJudge } from "./_lib/models";
import { activeProvider, runSearches } from "./_lib/search";

export const config = { maxDuration: 120 };

const CATEGORIES = new Set([
  "side_hustle",
  "automation_tool",
  "repo_or_tool",
  "product",
  "content_technique",
  "other",
]);

function clamp(n: unknown, lo: number, hi: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : lo;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = (await req.json()) as TriageRequest;
    if (!body.frames?.length && !body.caption?.trim()) {
      return Response.json(
        { error: "Provide video frames or at least a caption to triage." },
        { status: 400 },
      );
    }

    // Tier A — cheap extraction
    const { text: rawExtract, extractor } = await runExtractor({
      system: EXTRACT_SYSTEM,
      user: extractUserPrompt(body.caption ?? "", body.context ?? "", body.filename ?? ""),
      frames: (body.frames ?? []).slice(0, 10),
    });
    const parsed = parseModelJson<Partial<Extraction>>(rawExtract);
    const extraction: Extraction = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      category: CATEGORIES.has(parsed.category as string) ? (parsed.category as Extraction["category"]) : "other",
      onScreenText: strList(parsed.onScreenText),
      claims: strList(parsed.claims),
      namedEntities: strList(parsed.namedEntities),
      searchQueries: strList(parsed.searchQueries),
      sellsProduct: parsed.sellsProduct === true,
    };

    // Free-tier claim verification
    const provider = activeProvider();
    const findings = await runSearches(extraction.searchQueries);

    // Tier B — premium judgment on a compact text dossier (no images)
    const rawJudge = await runJudge(
      JUDGE_SYSTEM,
      judgeUserPrompt(extraction, findings, body.context ?? "", provider !== "none"),
      6000,
    );
    const j = parseModelJson<Partial<Judgment>>(rawJudge);
    const judgment: Judgment = {
      verdict: j.verdict === "BUILD" || j.verdict === "INVESTIGATE" || j.verdict === "SKIP" ? j.verdict : "SKIP",
      confidence: clamp(j.confidence, 0, 100),
      headline: typeof j.headline === "string" ? j.headline : "No verdict returned",
      brief: typeof j.brief === "string" ? j.brief : "",
      redFlags: strList(j.redFlags),
      evidence: strList(j.evidence),
      buildable: j.buildable === true,
    };

    // Structural enforcement of the playbook gates — not left to the model.
    if (extraction.category === "side_hustle" && judgment.confidence < 90) {
      judgment.buildable = false;
      if (judgment.verdict === "BUILD") judgment.verdict = "INVESTIGATE";
    }
    if (provider === "none" && extraction.category === "side_hustle") {
      judgment.confidence = Math.min(judgment.confidence, 60);
      judgment.buildable = false;
    }

    const response: TriageResponse = {
      extraction,
      findings,
      judgment,
      meta: { extractor, searchProvider: provider, searchesRun: findings.length },
    };
    return Response.json(response);
  } catch (err) {
    console.error(err);
    return Response.json({ error: err instanceof Error ? err.message : "Triage failed" }, { status: 500 });
  }
}
