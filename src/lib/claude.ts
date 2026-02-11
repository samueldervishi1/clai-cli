import Anthropic from "@anthropic-ai/sdk";
import type {
  RawMessageStreamEvent,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages/messages";
import { TOOL_DEFINITIONS, executeTool } from "./tools.js";
import type { ChatMessage, TokenUsage, StreamEvent, ChatImage } from "./types.js";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set. Run `clai` interactively to configure it.");
    }
    _client = new Anthropic();
  }
  return _client;
}

export const MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-5-20250929",
} as const;

export const MODEL_DISPLAY: Record<string, string> = {
  [MODELS.haiku]: "Haiku 4.5",
  [MODELS.sonnet]: "Sonnet 4.5",
};

export const DEFAULT_MODEL = MODELS.haiku;
export const DEFAULT_MAX_TOKENS = 8192;

// Pricing per million tokens
const PRICING: Record<string, { input: number; output: number }> = {
  [MODELS.haiku]: { input: 0.8, output: 4.0 },
  [MODELS.sonnet]: { input: 3.0, output: 15.0 },
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
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent, StreamResult, unknown> {
  let apiMessages: Anthropic.MessageParam[] = messages.map((m) => {
    if (m.images?.length) {
      const content: Anthropic.ContentBlockParam[] = m.images.map((img) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: img.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: img.data,
        },
      }));
      if (m.content) {
        content.push({ type: "text" as const, text: m.content });
      }
      return { role: m.role, content };
    }
    return { role: m.role, content: m.content };
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stream = await getClient().messages.create(
      {
        model,
        max_tokens: maxTokens,
        messages: apiMessages,
        tools: TOOL_DEFINITIONS,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        stream: true,
      },
      { signal },
    );

    // Track content blocks as they build up from stream events
    const contentBlocks: ContentBlock[] = [];
    let currentToolJson = "";
    let stopReason: string | null = null;

    for await (const event of stream as AsyncIterable<RawMessageStreamEvent>) {
      switch (event.type) {
        case "message_start":
          totalInputTokens += event.message.usage.input_tokens;
          break;

        case "content_block_start":
          contentBlocks[event.index] = event.content_block;
          if (event.content_block.type === "tool_use") {
            currentToolJson = "";
          }
          break;

        case "content_block_delta":
          if (event.delta.type === "text_delta") {
            finalText += event.delta.text;
            const textBlock = contentBlocks[event.index];
            if (textBlock?.type === "text") {
              (textBlock as TextBlock).text += event.delta.text;
            }
            yield { type: "text_delta", text: event.delta.text };
          } else if (event.delta.type === "input_json_delta") {
            currentToolJson += event.delta.partial_json;
          }
          break;

        case "content_block_stop": {
          const block = contentBlocks[event.index];
          if (block?.type === "tool_use") {
            try {
              (block as ToolUseBlock).input = JSON.parse(currentToolJson || "{}");
            } catch {
              (block as ToolUseBlock).input = {};
            }
          }
          break;
        }

        case "message_delta":
          stopReason = event.delta.stop_reason;
          totalOutputTokens += event.usage.output_tokens;
          break;
      }
    }

    // Execute tool calls after stream completes
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of contentBlocks) {
      if (block.type === "tool_use") {
        const toolInput = block.input as Record<string, unknown>;

        // For write_file, ask for approval before executing
        if (block.name === "write_file") {
          let resolveApproval!: (approved: boolean) => void;
          const approvalPromise = new Promise<boolean>((r) => {
            resolveApproval = r;
          });

          // yield happens in generator body (valid), await on separate promise
          yield {
            type: "tool_approve" as const,
            tool: { name: block.name, input: toolInput },
            approve: () => resolveApproval(true),
            deny: () => resolveApproval(false),
          };

          const approved = await approvalPromise;

          if (!approved) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: "User denied this file write.",
              is_error: true,
            });
            yield {
              type: "tool_done",
              tool: {
                name: block.name,
                input: toolInput,
                output: "Denied by user",
                isError: true,
              },
            };
            continue;
          }
        }

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
    if (stopReason !== "tool_use" || toolResults.length === 0) {
      break;
    }

    // Filter out empty text blocks before sending back to API
    const assistantContent = contentBlocks.filter(
      (block) => !(block.type === "text" && !block.text),
    );

    // Append assistant response and tool results for next round
    apiMessages = [
      ...apiMessages,
      { role: "assistant", content: assistantContent },
      { role: "user", content: toolResults },
    ];

    // Warn if this was the last allowed round
    if (round === MAX_TOOL_ROUNDS - 1) {
      yield {
        type: "warning",
        message: `Reached maximum tool call rounds (${MAX_TOOL_ROUNDS}). Response may be incomplete.`,
      };
    }
  }

  const knownPricing = PRICING[model];
  if (!knownPricing) {
    yield {
      type: "warning",
      message: `Unknown pricing for model "${model}". Cost estimate may be inaccurate.`,
    };
  }
  const pricing = knownPricing ?? PRICING[DEFAULT_MODEL];
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
