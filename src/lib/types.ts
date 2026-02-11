// Ordered segments for interleaved text + tool display
export type MessageSegment =
  | { type: "text"; content: string }
  | {
      type: "tool";
      name: string;
      input: Record<string, unknown>;
      output?: string;
      isError?: boolean;
    };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  segments?: MessageSegment[];
  images?: ChatImage[];
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

export interface ChatImage {
  data: string; // base64
  mediaType: string;
}

export interface ClaiConfig {
  defaultModel?: string;
  systemPrompt?: string;
  maxTokens?: number;
  lifetimeSpend?: number;
  presets?: Record<string, string>;
}

// Events yielded by the streaming chat generator
export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_start"; tool: ToolCallInfo }
  | { type: "tool_done"; tool: ToolCallInfo }
  | { type: "warning"; message: string };
