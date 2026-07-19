// Thin fetch clients — no SDK dependencies, keeps the serverless bundle tiny.

const JUDGE_MODEL = process.env.JUDGE_MODEL || "claude-sonnet-5";
const HAIKU_MODEL = process.env.EXTRACT_FALLBACK_MODEL || "claude-haiku-4-5-20251001";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

interface VisionInput {
  system: string;
  user: string;
  frames: string[]; // data URLs
}

function dataUrlToParts(url: string): { mime: string; data: string } {
  const m = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Frame is not a base64 data URL");
  return { mime: m[1], data: m[2] };
}

async function anthropicMessage(opts: {
  model: string;
  system: string;
  user: string;
  frames?: string[];
  maxTokens: number;
}): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const content: unknown[] = (opts.frames ?? []).map((f) => {
    const { mime, data } = dataUrlToParts(f);
    return { type: "image", source: { type: "base64", media_type: mime, data } };
  });
  content.push({ type: "text", text: opts.user });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { content: { type: string; text?: string }[] };
  return json.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

async function geminiVision(input: VisionInput): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const parts: unknown[] = input.frames.map((f) => {
    const { mime, data } = dataUrlToParts(f);
    return { inline_data: { mime_type: mime, data } };
  });
  parts.push({ text: input.user });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini returned no text");
  return text;
}

/** Tier A: Gemini Flash if configured, Claude Haiku otherwise. */
export async function runExtractor(
  input: VisionInput,
): Promise<{ text: string; extractor: "gemini" | "haiku" }> {
  if (process.env.GEMINI_API_KEY) {
    try {
      return { text: await geminiVision(input), extractor: "gemini" };
    } catch (err) {
      console.error("Gemini extraction failed, falling back to Haiku:", err);
    }
  }
  const text = await anthropicMessage({
    model: HAIKU_MODEL,
    system: input.system,
    user: input.user,
    frames: input.frames,
    maxTokens: 2000,
  });
  return { text, extractor: "haiku" };
}

/** Tier B: premium judgment — text-only dossier in, JSON or markdown out. */
export async function runJudge(system: string, user: string, maxTokens: number): Promise<string> {
  return anthropicMessage({ model: JUDGE_MODEL, system, user, maxTokens });
}

/** Pulls the first JSON object out of a model response, tolerating code fences. */
export function parseModelJson<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`Model returned no JSON: ${text.slice(0, 200)}`);
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
