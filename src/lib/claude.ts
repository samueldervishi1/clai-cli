import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS, executeTool } from "./tools.js";
import type { ChatMessage, TokenUsage, StreamEvent } from "./types.js";

const client = new Anthropic();

export const MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-5-20250929",
} as const;

export const MODEL_DISPLAY: Record<string, string> = {
  [MODELS.haiku]: "Haiku 4.5",
  [MODELS.sonnet]: "Sonnet 4.5",
};

export const DEFAULT_MODEL = MODELS.haiku;
export const DEFAULT_MAX_TOKENS = 4096;

// Pricing per million tokens
const PRICING: Record<string, { input: number; output: number }> = {
  [MODELS.haiku]: { input: 0.80, output: 4.00 },
  [MODELS.sonnet]: { input: 3.00, output: 15.00 },
};

export interface StreamResult {
  text: string;
  usage: TokenUsage;
}

const MAX_TOOL_ROUNDS = 10;

export async function* streamChat(
  messages: ChatMessage[],
  model: string = DEFAULT_MODEL,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  systemPrompt?: string,
): AsyncGenerator<StreamEvent, StreamResult, unknown> {
  let apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: apiMessages,
      tools: TOOL_DEFINITIONS,
      ...(systemPrompt ? { system: systemPrompt } : {}),
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Process content blocks
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        for (const char of block.text) {
          finalText += char;
          yield { type: "text_delta", text: char };
        }
      } else if (block.type === "tool_use") {
        const toolInput = block.input as Record<string, unknown>;

        yield {
          type: "tool_start",
          tool: { name: block.name, input: toolInput },
        };

        const result = executeTool(block.name, toolInput);

        yield {
          type: "tool_done",
          tool: {
            name: block.name,
            input: toolInput,
            output: result.output,
            isError: result.isError,
          },
        };

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result.output,
          is_error: result.isError,
        });
      }
    }

    // If no tool calls, we're done
    if (response.stop_reason !== "tool_use" || toolResults.length === 0) {
      break;
    }

    // Append assistant response and tool results for next round
    apiMessages = [
      ...apiMessages,
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults },
    ];
  }

  const pricing = PRICING[model] ?? PRICING[DEFAULT_MODEL];
  const totalCost =
    (totalInputTokens / 1_000_000) * pricing.input +
    (totalOutputTokens / 1_000_000) * pricing.output;

  return {
    text: finalText,
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalCost,
    },
  };
}
