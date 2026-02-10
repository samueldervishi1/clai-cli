import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ChatMessage } from "./types.js";

const CONV_DIR = resolve(
  process.env.XDG_CONFIG_HOME ?? resolve(process.env.HOME ?? "~", ".config"),
  "clai",
  "conversations",
);

function ensureDir(): void {
  mkdirSync(CONV_DIR, { recursive: true });
}

export function saveConversation(messages: ChatMessage[], name?: string): string {
  ensureDir();
  const slug = name ?? new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${slug}.json`;
  const filepath = resolve(CONV_DIR, filename);
  writeFileSync(filepath, JSON.stringify(messages, null, 2) + "\n");
  return slug;
}

export function loadConversation(name: string): ChatMessage[] | null {
  const filepath = resolve(CONV_DIR, `${name}.json`);
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
