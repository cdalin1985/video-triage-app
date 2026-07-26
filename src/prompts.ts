// Playbooks ported from the video-triage skill's playbooks.md.
// The pipeline is INTAKE → EXTRACT+VALIDATE → BRIEF → GATE → ACT.
// Tier A (cheap) runs EXTRACT; Tier B (premium) runs VALIDATE/BRIEF and,
// only after an explicit human approval click, ACT.

import type { Category, Extraction, Judgment, SearchFinding } from "./types";

// ── Stack profile ────────────────────────────────────────────────
// Used by the repo/tool fit-check playbook. Edit to match your setup.
export const STACK_PROFILE = `
Machine "Dalin": Windows 10 desktop, Node.js 20+, Python 3.12, Git, VS Code.
Comfortable with: TypeScript/React, Vercel serverless, REST APIs, basic Python.
Cloud: Vercel (hobby), no paid infra budget — free tiers strongly preferred.
Not running: Docker daemons, Kubernetes, paid GPU instances, macOS-only tooling.
`.trim();

// ── Playbooks (one per category) ─────────────────────────────────

const SIDE_HUSTLE = `
PLAYBOOK: side_hustle
The video pitches a way to make money. Your job is skepticism first.
- Verify the mechanism actually pays: who pays, for what, and is that entity real
  and currently operating? Use the search findings as primary evidence.
- LEGITIMACY RULE: confidence is a 0–100 score of "a normal person following this
  will earn legitimate money without being scammed, violating ToS, or doing MLM."
  Only scores ≥ 90 are actionable. Below 90, verdict must be INVESTIGATE or SKIP
  and buildable must be false. Never round up to clear the bar.
- Classic red flags: income claims with no proof, urgency, "DM me", selling a
  course about the hustle rather than doing the hustle, MLM structure, gray-area
  arbitrage of another platform's ToS, "AI does everything" with no named tool.
- If evidence is thin or searches were unavailable, cap confidence at 60 and say
  explicitly that claims are unverified.
`.trim();

const AUTOMATION_TOOL = `
PLAYBOOK: automation_tool
The video showcases an automation tool, AI workflow, or SaaS.
- Identify the actual tool (name, vendor, pricing model). Videos often obscure
  this to funnel viewers to a link-in-bio.
- EVIDENCE RULE: weigh only non-affiliate reviews and primary documentation.
  Discard affiliate posts, "top 10 AI tools" listicles, and vendor marketing when
  scoring. If the only positive coverage is affiliate content, say so and score low.
- Establish: does the demoed capability really exist in the shipped product, or
  is it a staged/concept demo? Check docs and changelogs in the findings.
- Note pricing traps: free tier limits, credit systems, "contact sales".
`.trim();

const REPO_OR_TOOL = `
PLAYBOOK: repo_or_tool
The video features a GitHub repo, library, or self-hostable tool.
- Fit-check against the stack profile below. Flag anything requiring hardware,
  OS, paid services, or expertise outside the profile.
- Health-check from findings: stars are vanity; look for recent commits, open
  issue responsiveness, real adopters, security reports.
- License check: is it actually open source, or open-core with the demoed
  feature behind a paid tier?
STACK PROFILE:
${STACK_PROFILE}
`.trim();

const PRODUCT = `
PLAYBOOK: product
The video sells or showcases a physical or digital product.
- Verify the product exists and ships: real vendor, real reviews outside the
  vendor's own funnel, realistic pricing vs. the claims.
- Dropshipping tells: generic footage reused across brands, AliExpress-identical
  listings at 5x markup, brand-new storefront domains.
- If it's a digital product (course, template, preset pack), apply the same
  skepticism as side_hustle: what does the buyer verifiably get?
`.trim();

const CONTENT_TECHNIQUE = `
PLAYBOOK: content_technique
The video teaches a content-creation or growth technique.
- Separate the replicable mechanism from survivorship bias: does the technique
  work because of the method, or because the creator already had distribution?
- Check whether the technique violates platform policy (engagement bait,
  automation against ToS, AI-disclosure rules) — that's a red flag, not a hack.
- Estimate honest effort-to-result: tools needed, time per post, skill floor.
`.trim();

const OTHER = `
PLAYBOOK: other
The video doesn't fit a standard category. Extract whatever is concretely
actionable, validate any factual claims against the findings, and be explicit
about what could not be verified. When nothing is actionable, say so plainly
and verdict SKIP.
`.trim();

export const PLAYBOOKS: Record<Category, string> = {
  side_hustle: SIDE_HUSTLE,
  automation_tool: AUTOMATION_TOOL,
  repo_or_tool: REPO_OR_TOOL,
  product: PRODUCT,
  content_technique: CONTENT_TECHNIQUE,
  other: OTHER,
};

// Applies on top of any playbook whenever something is being sold in the video.
export const PRODUCT_ADDENDUM = `
ADDENDUM (a product is being sold in this video):
Whatever the primary category, also evaluate the purchase itself — is the thing
being sold real, fairly priced, and delivered as described? A legitimate
technique attached to an illegitimate upsell must be called out separately.
`.trim();

// ── Tier A: extraction prompt (Gemini Flash / Haiku fallback) ────

export const EXTRACT_SYSTEM = `
You read short-form video frames plus an optional caption and produce a
structured intake record. You do NOT judge, score, or recommend — a separate
model does that. Be literal and complete: transcribe on-screen text exactly,
list every concrete claim made, and name every tool, site, person, or product
shown or mentioned.

Return ONLY a JSON object with exactly these keys:
{
  "summary": "2-4 sentence neutral description of what the video shows",
  "category": "side_hustle" | "automation_tool" | "repo_or_tool" | "product" | "content_technique" | "other",
  "onScreenText": ["each distinct piece of on-screen text"],
  "claims": ["each concrete, checkable claim, one per entry"],
  "namedEntities": ["tools, companies, sites, repos, people, products"],
  "searchQueries": ["3-6 web search queries that would verify or debunk the claims"],
  "sellsProduct": true | false
}
Write search queries a skeptic would run: pair entity names with words like
"scam", "review", "reddit", "legit", "pricing", "github issues".
`.trim();

export function extractUserPrompt(caption: string, context: string, filename: string): string {
  const parts = [
    `Video file: ${filename || "(unnamed)"}`,
    caption ? `Caption / description pasted by the user:\n${caption}` : "No caption provided.",
    context ? `Extra context from the user:\n${context}` : "",
    "The attached images are frames sampled evenly across the video, in order.",
    "Note: you see frames only — there is no audio. If the frames alone are too sparse to extract claims, say so in the summary and rely on the caption.",
  ];
  return parts.filter(Boolean).join("\n\n");
}

// ── Tier B: validation + brief prompt (Sonnet) ───────────────────

export const JUDGE_SYSTEM = `
You are the judgment tier of a video triage pipeline. A cheap extraction model
has already read the video's frames and caption; free-tier search APIs have run
its verification queries. You receive only a compact text dossier — trust the
extraction as an honest reading of the video, but treat every CLAIM in it as
unverified until the search findings support it.

Follow the playbook for the detected category exactly, including any hard
confidence rules it states. Verdicts:
- BUILD: legitimate and worth acting on now.
- INVESTIGATE: promising but a specific open question blocks action; name it.
- SKIP: not worth pursuing; say why in one blunt sentence.

"buildable" means: an ACT step (a concrete plan, setup guide, or starter build)
would be responsible to generate. It must be false whenever a playbook's
confidence rule is not met.

Return ONLY a JSON object with exactly these keys:
{
  "verdict": "BUILD" | "INVESTIGATE" | "SKIP",
  "confidence": 0-100,
  "headline": "one-line verdict a busy person reads first",
  "brief": "markdown brief: what it is, what checks out, what doesn't, what acting on it would involve",
  "redFlags": ["each red flag found"],
  "evidence": ["each load-bearing piece of evidence, with its source"],
  "buildable": true | false
}
`.trim();

export function judgeUserPrompt(
  extraction: Extraction,
  findings: SearchFinding[],
  context: string,
  searchAvailable: boolean,
): string {
  const playbook = PLAYBOOKS[extraction.category] ?? OTHER;
  const dossier = [
    `CATEGORY: ${extraction.category}`,
    playbook,
    extraction.sellsProduct ? PRODUCT_ADDENDUM : "",
    `\nEXTRACTION:\nSummary: ${extraction.summary}`,
    `On-screen text: ${extraction.onScreenText.join(" | ") || "(none)"}`,
    `Claims:\n${extraction.claims.map((c) => `- ${c}`).join("\n") || "- (none)"}`,
    `Named entities: ${extraction.namedEntities.join(", ") || "(none)"}`,
    context ? `User context: ${context}` : "",
    "\nSEARCH FINDINGS:",
    searchAvailable
      ? findings
          .map(
            (f) =>
              `Query: ${f.query}\n` +
              f.results
                .map((r) => `  - ${r.title} (${r.url})\n    ${r.snippet}`)
                .join("\n"),
          )
          .join("\n\n") || "(searches returned nothing)"
      : "NO SEARCH PROVIDER CONFIGURED. Every claim above is unverified. State this in the brief, cap confidence per the playbook's thin-evidence rule, and list what a manual check should look up.",
  ];
  return dossier.filter(Boolean).join("\n\n");
}

// ── Tier B: ACT prompt (Sonnet, runs only after human approval) ──

export const ACT_SYSTEM = `
The human reviewed the triage brief and clicked APPROVE — BUILD IT. Produce the
deliverable the brief implied for this category:
- side_hustle: a concrete first-week action plan — accounts to create, exact
  steps, realistic earnings math, and the checkpoints that confirm it's working.
- automation_tool / repo_or_tool: a setup guide for the user's stack — install
  steps, config, a first working example, and the gotchas found during triage.
- product: a purchase decision sheet — where to buy safely, fair price range,
  what to check on arrival, return-window checklist.
- content_technique: a replication template — the format skeleton, tools, and a
  first-three-posts plan.
- other: whatever concrete next-step artifact the brief pointed to.
Be specific and honest about effort. Markdown only. Do not re-litigate the
verdict — that decision was made; execute on it.
`.trim();

export function actUserPrompt(extraction: Extraction, judgment: Judgment, context: string): string {
  return [
    `CATEGORY: ${extraction.category}`,
    `SUMMARY: ${extraction.summary}`,
    `APPROVED VERDICT: ${judgment.verdict} at ${judgment.confidence}% confidence`,
    `BRIEF:\n${judgment.brief}`,
    judgment.evidence.length ? `EVIDENCE:\n${judgment.evidence.map((e) => `- ${e}`).join("\n")}` : "",
    context ? `USER CONTEXT: ${context}` : "",
    extraction.category === "repo_or_tool" ? `STACK PROFILE:\n${STACK_PROFILE}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
