import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import type { ChatMessage } from "./types.js";

const CONV_DIR = resolve(
  process.env.XDG_CONFIG_HOME ?? resolve(process.env.HOME ?? "~", ".config"),
  "clai",
  "conversations",
);

function ensureDir(): void {
  mkdirSync(CONV_DIR, { recursive: true });
}

/** Sanitize conversation name to prevent path traversal */
function safeName(name: string): string | null {
  // Strip any directory components — only allow the base name
  const base = basename(name);
  if (!base || base === "." || base === ".." || base !== name) return null;
  return base;
}

export function saveConversation(messages: ChatMessage[], name?: string): string {
  ensureDir();
  const slug = name ?? new Date().toISOString().replace(/[:.]/g, "-");
  const safe = safeName(slug);
  if (!safe) throw new Error("Invalid conversation name.");
  const filepath = resolve(CONV_DIR, `${safe}.json`);
  writeFileSync(filepath, JSON.stringify(messages, null, 2) + "\n");
  return safe;
}

export function loadConversation(name: string): ChatMessage[] | null {
  const safe = safeName(name);
  if (!safe) return null;
  const filepath = resolve(CONV_DIR, `${safe}.json`);
  if (!existsSync(filepath)) return null;
  try {
    const raw = readFileSync(filepath, "utf-8");
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return null;
  }
}

export function listConversations(): string[] {
  ensureDir();
  try {
    return readdirSync(CONV_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}
