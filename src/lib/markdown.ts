import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

marked.setOptions({
  renderer: new TerminalRenderer({
    showSectionPrefix: false,
  }) as never,
});

export function renderMarkdown(text: string): string {
  try {
    const rendered = marked.parse(text);
    if (typeof rendered !== "string") return text;
    return rendered.replace(/^-{10,}$/gm, "─".repeat(40)).replace(/\n$/, "");
  } catch (err) {
    if (process.env.DEBUG) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[clai] markdown render error: ${msg}\n`);
    }
    return text;
  }
}
