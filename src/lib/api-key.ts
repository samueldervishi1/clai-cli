import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as readline from "node:readline";

const CONFIG_DIR = resolve(
  process.env.XDG_CONFIG_HOME ?? resolve(process.env.HOME ?? "~", ".config"),
  "clai",
);
const ENV_PATH = resolve(CONFIG_DIR, ".env");

function loadSavedKeys(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  try {
    const content = readFileSync(ENV_PATH, "utf-8");
    const keys: Record<string, string> = {};

    const anthropicMatch = content.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (anthropicMatch?.[1]) {
      keys.ANTHROPIC_API_KEY = anthropicMatch[1].trim();
    }

    const groqMatch = content.match(/^GROQ_API_KEY=(.+)$/m);
    if (groqMatch?.[1]) {
      keys.GROQ_API_KEY = groqMatch[1].trim();
    }

    return keys;
  } catch {
    return {};
  }
}

function saveKeys(keys: Record<string, string>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const lines = Object.entries(keys).map(([k, v]) => `${k}=${v}`);
  writeFileSync(ENV_PATH, lines.join("\n") + "\n", { mode: 0o600 });
}

async function promptForKey(keyName: string, prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.on("close", () => {
      // Ctrl+C or Ctrl+D during prompt
      console.log("\n");
      process.exit(0);
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function ensureApiKey(isPiped: boolean): Promise<void> {
  // Load all saved keys
  const savedKeys = loadSavedKeys();

  // Set any saved keys in environment
  for (const [key, value] of Object.entries(savedKeys)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  // Already set in environment
  if (process.env.ANTHROPIC_API_KEY) return;

  // Can't prompt if stdin is piped
  if (isPiped) {
    console.error("Error: ANTHROPIC_API_KEY not set. Run `clai` interactively first to set it up.");
    process.exit(1);
  }

  // Prompt user for Anthropic key (primary/required)
  console.log("\n  Welcome to Clai!\n");
  const key = await promptForKey("ANTHROPIC_API_KEY", "  Enter your Anthropic API key: ");
  if (!key || !key.startsWith("sk-ant-") || key.length < 20 || !/^[\w-]+$/.test(key)) {
    console.error("  Invalid key. Expected format: sk-ant-...");
    process.exit(1);
  }

  savedKeys.ANTHROPIC_API_KEY = key;
  saveKeys(savedKeys);
  process.env.ANTHROPIC_API_KEY = key;
  console.log("  Key saved to ~/.config/clai/.env\n");
}

/**
 * Prompt for Groq API key if not already configured
 * Called lazily when user switches to a Groq model
 */
export async function ensureGroqApiKey(): Promise<void> {
  // Already set in environment
  if (process.env.GROQ_API_KEY) return;

  // Load saved keys
  const savedKeys = loadSavedKeys();
  if (savedKeys.GROQ_API_KEY) {
    process.env.GROQ_API_KEY = savedKeys.GROQ_API_KEY;
    return;
  }

  // Prompt user
  console.log("\n  Groq models require a Groq API key (free at https://console.groq.com)\n");
  const key = await promptForKey(
    "GROQ_API_KEY",
    "  Enter your Groq API key (or press Ctrl+C to cancel): ",
  );

  if (!key || key.length < 20 || !/^gsk_[\w]+$/.test(key)) {
    console.error("  Invalid key. Expected format: gsk_...");
    throw new Error("Invalid Groq API key");
  }

  savedKeys.GROQ_API_KEY = key;
  saveKeys(savedKeys);
  process.env.GROQ_API_KEY = key;
  console.log("  Groq API key saved to ~/.config/clai/.env\n");
}
