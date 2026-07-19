import { Markdown } from "./Markdown";

export function ActPanel({ markdown, onReset }: { markdown: string; onReset: () => void }) {
  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "triage-deliverable.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="act">
      <div className="act-head">
        <h2>Deliverable</h2>
        <div className="act-actions">
          <button className="btn ghost" onClick={() => void navigator.clipboard.writeText(markdown)}>
            Copy
          </button>
          <button className="btn ghost" onClick={download}>
            Download .md
          </button>
          <button className="btn ghost" onClick={onReset}>
            Done — next video
          </button>
        </div>
      </div>
      <div className="act-body">
        <Markdown text={markdown} />
      </div>
    </section>
  );
}
