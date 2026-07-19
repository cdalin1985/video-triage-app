export type StageId = "intake" | "extract" | "gate" | "act";

const STAGES: { id: StageId; label: string; sub: string }[] = [
  { id: "intake", label: "INTAKE", sub: "frames + caption" },
  { id: "extract", label: "EXTRACT + VALIDATE", sub: "read · search · judge" },
  { id: "gate", label: "BRIEF / GATE", sub: "human decides" },
  { id: "act", label: "ACT", sub: "build on approval" },
];

export function Stepper({ current, busy }: { current: StageId; busy: boolean }) {
  const idx = STAGES.findIndex((s) => s.id === current);
  return (
    <ol className="stepper" aria-label="Pipeline">
      {STAGES.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? (busy ? "live" : "here") : "wait";
        return (
          <li key={s.id} className={`step step-${state}`}>
            <span className="step-dot" aria-hidden />
            <span className="step-label">{s.label}</span>
            <span className="step-sub">{s.sub}</span>
          </li>
        );
      })}
    </ol>
  );
}
