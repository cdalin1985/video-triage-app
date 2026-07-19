// Phase 2: ACT. This endpoint exists separately from /api/triage so the human
// gate is structural — nothing here runs unless the UI's APPROVE — BUILD IT
// button fires this request, and it refuses dossiers the gate wouldn't allow.

import { ACT_SYSTEM, actUserPrompt } from "../src/prompts";
import type { ActRequest, ActResponse } from "../src/types";
import { runJudge } from "./_lib/models";

export const config = { maxDuration: 120 };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = (await req.json()) as ActRequest;
    if (!body.extraction || !body.judgment) {
      return Response.json({ error: "Missing triage dossier" }, { status: 400 });
    }
    if (!body.judgment.buildable) {
      return Response.json(
        { error: "This triage did not clear its playbook's confidence gate — ACT is not available." },
        { status: 403 },
      );
    }
    if (body.extraction.category === "side_hustle" && body.judgment.confidence < 90) {
      return Response.json(
        { error: "Side hustles below 90% legitimacy confidence cannot be built." },
        { status: 403 },
      );
    }

    const deliverable = await runJudge(
      ACT_SYSTEM,
      actUserPrompt(body.extraction, body.judgment, body.context ?? ""),
      4000,
    );
    const response: ActResponse = { deliverable };
    return Response.json(response);
  } catch (err) {
    console.error(err);
    return Response.json({ error: err instanceof Error ? err.message : "ACT failed" }, { status: 500 });
  }
}
