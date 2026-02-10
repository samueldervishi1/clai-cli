import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ClaiConfig } from "./types.js";

const CONFIG_DIR = resolve(
  process.env.XDG_CONFIG_HOME ?? resolve(process.env.HOME ?? "~", ".config"),
  "clai",
);
const CONFIG_PATH = resolve(CONFIG_DIR, "config.json");

export function loadConfig(): ClaiConfig {
  try {
    if (!existsSync(CONFIG_PATH)) return {};
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as ClaiConfig;
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
