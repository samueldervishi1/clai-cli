import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as readline from "node:readline";

const CONFIG_DIR = resolve(
  process.env.XDG_CONFIG_HOME ?? resolve(process.env.HOME ?? "~", ".config"),
  "clai",
);
const ENV_PATH = resolve(CONFIG_DIR, ".env");

function loadSavedKey(): string | undefined {
  if (!existsSync(ENV_PATH)) return undefined;
  try {
    const content = readFileSync(ENV_PATH, "utf-8");
    const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    return match?.[1]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function saveKey(key: string): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(ENV_PATH, `ANTHROPIC_API_KEY=${key}\n`, { mode: 0o600 });
}

async function promptForKey(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    console.log("\n  Welcome to Clai!\n");
    rl.question("  Enter your Anthropic API key: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function ensureApiKey(isPiped: boolean): Promise<void> {
  // Already set in environment
  if (process.env.ANTHROPIC_API_KEY) return;

  // Try loading from saved config
  const saved = loadSavedKey();
  if (saved) {
    process.env.ANTHROPIC_API_KEY = saved;
    return;
  }

  // Can't prompt if stdin is piped
  if (isPiped) {
    console.error("Error: ANTHROPIC_API_KEY not set. Run `clai` interactively first to set it up.");
    process.exit(1);
  }

  // Prompt user
  const key = await promptForKey();
  if (!key || !key.startsWith("sk-ant-")) {
    console.error("  Invalid key. Expected format: sk-ant-...");
    process.exit(1);
  }

  saveKey(key);
  process.env.ANTHROPIC_API_KEY = key;
  console.log("  Key saved to ~/.config/clai/.env\n");
}
