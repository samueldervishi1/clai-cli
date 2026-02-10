export interface Command {
  name: string;
  description: string;
}

export const COMMANDS: Command[] = [
  { name: "/clear", description: "Clear conversation history and free up context" },
  { name: "/compact", description: "Summarize conversation to save context" },
  { name: "/copy", description: "Copy last Clai response to clipboard" },
  { name: "/exit", description: "Quit Clai" },
  { name: "/help", description: "Show available commands" },
  { name: "/model", description: "Switch model (Haiku 4.5 ↔ Sonnet 4.5)" },
  { name: "/save", description: "Save conversation to a file" },
  { name: "/system", description: "Set a system prompt. Usage: /system <prompt>" },
  { name: "/tokens", description: "Show token usage and cost details" },
];

export function filterCommands(input: string): Command[] {
  if (!input.startsWith("/")) return [];
  const query = input.toLowerCase();
  return COMMANDS.filter((cmd) => cmd.name.startsWith(query));
}
