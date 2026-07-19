import { useRef, useState } from "react";

interface Props {
  disabled: boolean;
  progress: { done: number; total: number } | null;
  triaging: boolean;
  onFile: (file: File) => void;
}

export function DropZone({ disabled, progress, triaging, onFile }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const take = (files: FileList | null) => {
    const f = files?.[0];
    if (f && f.type.startsWith("video/")) onFile(f);
  };

  let status: React.ReactNode = (
    <>
      <span className="drop-big">Drop the video here</span>
      <span className="drop-small">or click to pick a file — it never leaves your browser until it's just frames</span>
    </>
  );
  if (progress) {
    status = (
      <>
        <span className="drop-big pulse">Sampling frames {progress.done}/{progress.total}</span>
        <span className="drop-small">canvas extraction, local only</span>
      </>
    );
  } else if (triaging) {
    status = (
      <>
        <span className="drop-big pulse">Running the pipeline…</span>
        <span className="drop-small">read → verify → judge · usually 20–60s</span>
      </>
    );
  }

  return (
    <div
      className={`dropzone ${over ? "over" : ""} ${disabled ? "disabled" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) take(e.dataTransfer.files);
      }}
    >
      {status}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => take(e.target.files)}
      />
    </div>
  );
}
