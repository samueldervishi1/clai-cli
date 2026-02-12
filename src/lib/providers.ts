/**
 * Multi-provider abstraction for different AI APIs
 * Supports Anthropic Claude and Groq models
 */

import type { ChatMessage, TokenUsage, StreamEvent } from "./types.js";

export interface ModelConfig {
  id: string;
  provider: "anthropic" | "groq";
  displayName: string;
  contextWindow: number; // Maximum context size in tokens
  pricing?: { input: number; output: number }; // Per million tokens
}

export interface StreamResult {
  text: string;
  usage: TokenUsage;
}

export interface AIProvider {
  /**
   * Stream chat responses from the AI model
   */
  streamChat(
    messages: ChatMessage[],
    model: string,
    maxTokens: number,
    systemPrompt?: string,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent, StreamResult, unknown>;

  /**
   * Get API key environment variable name
   */
  getApiKeyName(): string;

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean;
}

// Model registry
export const MODELS: Record<string, ModelConfig> = {
  // Anthropic Claude (default, most capable)
  haiku: {
    id: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    displayName: "Claude Haiku 4.5",
    contextWindow: 200000,
    pricing: { input: 0.8, output: 4.0 },
  },
  sonnet: {
    id: "claude-sonnet-4-5-20250929",
    provider: "anthropic",
    displayName: "Claude Sonnet 4.5",
    contextWindow: 200000,
    pricing: { input: 3.0, output: 15.0 },
  },

  // Groq Models (fast inference, free tier available)
  "llama-3.3": {
    id: "llama-3.3-70b-versatile",
    provider: "groq",
    displayName: "Llama 3.3 70B (Groq)",
    contextWindow: 131072,
    pricing: { input: 0.0, output: 0.0 }, // Free tier
  },
  "gpt-oss": {
    id: "openai/gpt-oss-120b",
    provider: "groq",
    displayName: "GPT-OSS 120B (Groq)",
    contextWindow: 8192,
    pricing: { input: 0.0, output: 0.0 }, // Free tier
  },
  "llama-3.1": {
    id: "llama-3.1-70b-versatile",
    provider: "groq",
    displayName: "Llama 3.1 70B (Groq)",
    contextWindow: 131072,
    pricing: { input: 0.0, output: 0.0 }, // Free tier
  },
  mixtral: {
    id: "mixtral-8x7b-32768",
    provider: "groq",
    displayName: "Mixtral 8x7B (Groq)",
    contextWindow: 32768,
    pricing: { input: 0.0, output: 0.0 }, // Free tier
  },
};

export const DEFAULT_MODEL = "haiku";
export const DEFAULT_MAX_TOKENS = 8192;

/**
 * Get model config by short name or ID
 */
export function getModelConfig(nameOrId: string): ModelConfig | undefined {
  // Try short name first
  if (MODELS[nameOrId]) {
    return MODELS[nameOrId];
  }
  // Try by model ID
  return Object.values(MODELS).find((m) => m.id === nameOrId);
}

/**
 * Get provider for a model
 */
export function getProviderForModel(modelNameOrId: string): "anthropic" | "groq" | undefined {
  const config = getModelConfig(modelNameOrId);
  return config?.provider;
}

/**
 * Check if token usage is approaching context limit
 * Returns warning message if usage exceeds threshold (default 75%)
 */
export function checkContextLimit(
  modelNameOrId: string,
  totalTokens: number,
  threshold = 0.75,
): string | null {
  const config = getModelConfig(modelNameOrId);
  if (!config) return null;

  const percentage = totalTokens / config.contextWindow;
  if (percentage >= threshold) {
    const percentDisplay = Math.round(percentage * 100);
    const tokensLeft = config.contextWindow - totalTokens;
    return `Context usage: ${percentDisplay}% (${totalTokens.toLocaleString()}/${config.contextWindow.toLocaleString()} tokens). ${tokensLeft.toLocaleString()} tokens remaining. Consider using /compact or /clear to free up context.`;
  }

  return null;
}
