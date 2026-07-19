import type { TriageResponse } from "../types";
import { Markdown } from "./Markdown";

interface Props {
  result: TriageResponse;
  gateOpen: boolean;
  acting: boolean;
  onApprove: () => void;
  onReset: () => void;
}

export function VerdictPanel({ result, gateOpen, acting, onApprove, onReset }: Props) {
  const { extraction, judgment, meta } = result;
  const conf = judgment.confidence;
  const gatePassed = judgment.buildable;
  const confClass = conf >= 90 ? "conf-high" : conf >= 60 ? "conf-mid" : "conf-low";

  return (
    <section className="verdict">
      <div className="verdict-head">
        <span className={`verdict-stamp stamp-${judgment.verdict.toLowerCase()}`}>
          {judgment.verdict}
        </span>
        <div className={`conf-badge ${confClass}`}>
          <span className="conf-num">{conf}</span>
          <span className="conf-pct">%</span>
          <span className="conf-word">confidence</span>
        </div>
      </div>

      <h2 className="headline">{judgment.headline}</h2>
      <p className="category-line">
        category <strong>{extraction.category.replace(/_/g, " ")}</strong> · read by{" "}
        <strong>{meta.extractor}</strong> · {meta.searchesRun} searches via{" "}
        <strong>{meta.searchProvider}</strong>
        {extraction.sellsProduct && <> · <em>product addendum applied</em></>}
      </p>

      {meta.searchProvider === "none" && (
        <p className="warn-strip">
          No search key configured — every claim below is <strong>unverified</strong> and
          confidence is capped accordingly. Add TAVILY_API_KEY or BRAVE_API_KEY to fix this.
        </p>
      )}

      <div className="brief">
        <Markdown text={judgment.brief} />
      </div>

      {judgment.redFlags.length > 0 && (
        <div className="flags">
          <h3>Red flags</h3>
          <ul>
            {judgment.redFlags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {judgment.evidence.length > 0 && (
        <details className="evidence">
          <summary>Evidence ({judgment.evidence.length})</summary>
          <ul>
            {judgment.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="gate-row">
        {gatePassed ? (
          <button className="btn build" disabled={!gateOpen} onClick={onApprove}>
            {acting ? "BUILDING…" : "APPROVE — BUILD IT"}
          </button>
        ) : (
          <p className="gate-closed">
            {extraction.category === "side_hustle" && conf < 90
              ? `Gate closed: side hustles need ≥ 90% legitimacy. This scored ${conf}.`
              : "Gate closed: this triage didn't clear its playbook's bar."}
          </p>
        )}
        <button className="btn ghost" disabled={acting} onClick={onReset}>
          Triage another
        </button>
      </div>
    </section>
  );
}
