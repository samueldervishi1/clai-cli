import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ClaiConfig, ToolPermission } from "./types.js";

const CONFIG_DIR = resolve(
  process.env.XDG_CONFIG_HOME ?? resolve(process.env.HOME ?? "~", ".config"),
  "clai",
);
const CONFIG_PATH = resolve(CONFIG_DIR, "config.json");

function validateConfig(data: unknown): ClaiConfig {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const obj = data as Record<string, unknown>;
  const config: ClaiConfig = {};
  if (typeof obj.defaultModel === "string") config.defaultModel = obj.defaultModel;
  if (typeof obj.systemPrompt === "string") config.systemPrompt = obj.systemPrompt;
  if (typeof obj.maxTokens === "number" && obj.maxTokens > 0) config.maxTokens = obj.maxTokens;
  if (typeof obj.lifetimeSpend === "number") config.lifetimeSpend = obj.lifetimeSpend;
  if (obj.presets && typeof obj.presets === "object" && !Array.isArray(obj.presets)) {
    const presets: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj.presets)) {
      if (typeof v === "string") presets[k] = v;
    }
    config.presets = presets;
  }
  if (typeof obj.theme === "string") config.theme = obj.theme;
  if (
    obj.toolPermissions &&
    typeof obj.toolPermissions === "object" &&
    !Array.isArray(obj.toolPermissions)
  ) {
    const permissions: Record<string, ToolPermission> = {};
    const validPermissions = new Set<string>(["always", "ask", "never"]);
    for (const [k, v] of Object.entries(obj.toolPermissions)) {
      if (typeof v === "string" && validPermissions.has(v)) {
        permissions[k] = v as ToolPermission;
      }
    }
    config.toolPermissions = permissions;
  }
  return config;
}

export function loadConfig(): ClaiConfig {
  try {
    if (!existsSync(CONFIG_PATH)) return {};
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return validateConfig(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveConfig(config: ClaiConfig): boolean {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}

export function addLifetimeSpend(cost: number): void {
  try {
    const config = loadConfig();
    config.lifetimeSpend = (config.lifetimeSpend ?? 0) + cost;
    saveConfig(config);
  } catch {
    // Silently fail — don't break the app for tracking
  }
}

export function getLifetimeSpend(): number {
  return loadConfig().lifetimeSpend ?? 0;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getToolPermission(toolName: string): ToolPermission {
  const config = loadConfig();
  return config.toolPermissions?.[toolName] ?? "ask"; // Default to "ask"
}

export function setToolPermission(toolName: string, permission: ToolPermission): boolean {
  const config = loadConfig();
  if (!config.toolPermissions) {
    config.toolPermissions = {};
  }
  config.toolPermissions[toolName] = permission;
  return saveConfig(config);
}
