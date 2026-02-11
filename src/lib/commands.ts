export interface Command {
  name: string;
  description: string;
}

export const COMMANDS: Command[] = [
  { name: "/clear", description: "Clear conversation history and free up context" },
  { name: "/compact", description: "Summarize conversation to save context" },
  { name: "/config", description: "Show config. /config save to persist settings" },
  { name: "/copy", description: "Copy last Clai response to clipboard" },
  { name: "/edit", description: "Open $EDITOR for multi-line input" },
  { name: "/exit", description: "Quit Clai" },
  { name: "/help", description: "Show available commands" },
  { name: "/image", description: "Send an image. Usage: /image <path> [question]" },
  { name: "/load", description: "Load a saved conversation. /load to list" },
  { name: "/model", description: "Show or switch model. /model <name> to switch" },
  { name: "/preset", description: "System prompt presets. /preset <name> or /preset save <name>" },
  { name: "/save", description: "Save conversation. /save [name]" },
  { name: "/system", description: "Set a system prompt. Usage: /system <prompt>" },
  { name: "/tokens", description: "Show token usage and cost details" },
];

export function filterCommands(input: string): Command[] {
  if (!input.startsWith("/")) return [];
  const query = input.toLowerCase();
  return COMMANDS.filter((cmd) => cmd.name.startsWith(query));
}
