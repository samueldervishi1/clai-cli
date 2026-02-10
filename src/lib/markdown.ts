import { Marked } from "marked";
import TerminalRenderer from "marked-terminal";

const marked = new Marked();
marked.setOptions({ renderer: new TerminalRenderer() as never });

export function renderMarkdown(text: string): string {
  const rendered = marked.parse(text);
  if (typeof rendered !== "string") return text;
  return rendered.replace(/\n$/, "");
}
