// Minimal, dependency-free markdown renderer covering what the model actually
// emits: headings, bold/italic/code, links, lists, paragraphs. Everything is
// built via React elements — no innerHTML, so model output can't inject markup.

import type { ReactNode } from "react";
import { Fragment } from "react";

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  // links, bold, code, italic
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${k++}`;
    if (m[1] && m[2]) {
      out.push(
        <a key={key} href={m[2]} target="_blank" rel="noreferrer noopener">
          {m[1]}
        </a>,
      );
    } else if (m[3]) out.push(<strong key={key}>{m[3]}</strong>);
    else if (m[4]) out.push(<code key={key}>{m[4]}</code>);
    else if (m[5]) out.push(<em key={key}>{m[5]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] | null = null;
  let ordered = false;

  const flushList = (key: string) => {
    if (!list) return;
    const items = list.map((item, i) => <li key={i}>{inline(item, `${key}-${i}`)}</li>);
    blocks.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
    list = null;
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const key = `b${i}`;
    const bullet = line.match(/^\s*[-*]\s+(.*)/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (bullet || numbered) {
      const isOrdered = Boolean(numbered);
      if (list && ordered !== isOrdered) flushList(`${key}-switch`);
      if (!list) {
        list = [];
        ordered = isOrdered;
      }
      list.push((bullet ?? numbered)![1]);
      return;
    }
    flushList(key);
    const heading = line.match(/^(#{1,4})\s+(.*)/);
    if (heading) {
      const level = heading[1].length;
      const content = inline(heading[2], key);
      blocks.push(
        level === 1 ? <h2 key={key}>{content}</h2>
        : level === 2 ? <h3 key={key}>{content}</h3>
        : <h4 key={key}>{content}</h4>,
      );
    } else if (line.trim() !== "") {
      blocks.push(<p key={key}>{inline(line, key)}</p>);
    }
  });
  flushList("tail");

  return <Fragment>{blocks}</Fragment>;
}
