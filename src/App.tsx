import { useCallback, useRef, useState } from "react";
import { extractFrames } from "./lib/frames";
import type { ActResponse, TriageResponse } from "./types";
import { Stepper, type StageId } from "./components/Stepper";
import { DropZone } from "./components/DropZone";
import { VerdictPanel } from "./components/VerdictPanel";
import { ActPanel } from "./components/ActPanel";

type Phase =
  | { name: "idle" }
  | { name: "extracting"; done: number; total: number }
  | { name: "triaging" }
  | { name: "gated"; result: TriageResponse }
  | { name: "acting"; result: TriageResponse }
  | { name: "done"; result: TriageResponse; deliverable: string }
  | { name: "error"; message: string };

function stageOf(phase: Phase): StageId {
  switch (phase.name) {
    case "idle":
      return "intake";
    case "extracting":
      return "intake";
    case "triaging":
      return "extract";
    case "gated":
      return "gate";
    case "acting":
      return "act";
    case "done":
      return "act";
    case "error":
      return "intake";
  }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [caption, setCaption] = useState("");
  const [context, setContext] = useState("");
  const fileRef = useRef<File | null>(null);

  const runTriage = useCallback(
    async (file: File | null) => {
      fileRef.current = file;
      try {
        let frames: string[] = [];
        if (file) {
          setPhase({ name: "extracting", done: 0, total: 8 });
          frames = await extractFrames(file, (done, total) =>
            setPhase({ name: "extracting", done, total }),
          );
        } else if (!caption.trim()) {
          setPhase({ name: "error", message: "Drop a video, or paste at least a caption." });
          return;
        }
        setPhase({ name: "triaging" });
        const res = await fetch("/api/triage", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ frames, caption, context, filename: file?.name ?? "" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `Triage failed (${res.status})`);
        setPhase({ name: "gated", result: json as TriageResponse });
      } catch (err) {
        setPhase({ name: "error", message: err instanceof Error ? err.message : String(err) });
      }
    },
    [caption, context],
  );

  const approve = useCallback(async () => {
    if (phase.name !== "gated") return;
    const { result } = phase;
    setPhase({ name: "acting", result });
    try {
      const res = await fetch("/api/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extraction: result.extraction, judgment: result.judgment, context }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `ACT failed (${res.status})`);
      setPhase({ name: "done", result, deliverable: (json as ActResponse).deliverable });
    } catch (err) {
      setPhase({ name: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, [phase, context]);

  const reset = useCallback(() => {
    fileRef.current = null;
    setPhase({ name: "idle" });
  }, []);

  const busy = phase.name === "extracting" || phase.name === "triaging" || phase.name === "acting";

  return (
    <div className="shell">
      <header className="masthead">
        <div className="mark" aria-hidden>
          ▲
        </div>
        <div>
          <h1>Video Triage</h1>
          <p className="tagline">
            Drop the reel. Cheap models read it, free search verifies it, a premium model judges it
            — and nothing gets built until you say so.
          </p>
        </div>
      </header>

      <Stepper current={stageOf(phase)} busy={busy} />

      <main className="stage">
        {(phase.name === "idle" || phase.name === "error" || phase.name === "extracting" || phase.name === "triaging") && (
          <section className="intake">
            <DropZone
              disabled={busy}
              progress={phase.name === "extracting" ? phase : null}
              triaging={phase.name === "triaging"}
              onFile={(f) => void runTriage(f)}
            />
            <div className="fields">
              <label>
                <span className="field-label">Caption / description</span>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Paste the post's caption here. Frames carry no audio — for pure talking-head clips with no on-screen text, this box is the transcript."
                  rows={4}
                  disabled={busy}
                />
              </label>
              <label>
                <span className="field-label">Extra context (optional)</span>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Anything the judge should know — where you found it, what you're hoping it is, constraints."
                  rows={2}
                  disabled={busy}
                />
              </label>
              <button
                className="btn ghost"
                disabled={busy || !caption.trim()}
                onClick={() => void runTriage(null)}
              >
                Triage caption only — no video
              </button>
            </div>
            {phase.name === "error" && <p className="error-strip">⚠ {phase.message}</p>}
          </section>
        )}

        {(phase.name === "gated" || phase.name === "acting" || phase.name === "done") && (
          <>
            <VerdictPanel
              result={phase.result}
              gateOpen={phase.name === "gated"}
              acting={phase.name === "acting"}
              onApprove={() => void approve()}
              onReset={reset}
            />
            {phase.name === "done" && <ActPanel markdown={phase.deliverable} onReset={reset} />}
          </>
        )}
      </main>

      <footer className="colophon">
        frames extracted in your browser · tier A: Gemini Flash (Haiku fallback) · search: Tavily /
        Brave free tier · tier B: Claude Sonnet · ACT fires only on approval
      </footer>
    </div>
  );
}
