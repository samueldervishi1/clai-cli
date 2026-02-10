export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export type AppState = "idle" | "streaming" | "error";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

export interface ToolCallInfo {
  name: string;
  input: Record<string, unknown>;
  output?: string;
  isError?: boolean;
}

// Events yielded by the streaming chat generator
export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_start"; tool: ToolCallInfo }
  | { type: "tool_done"; tool: ToolCallInfo };
