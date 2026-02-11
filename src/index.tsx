#!/usr/bin/env node

import { render } from "ink";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import * as readline from "node:readline";
import { App } from "./App.js";
import { VERSION } from "./lib/version.js";
import { ensureApiKey } from "./lib/api-key.js";

const arg = process.argv[2];

if (arg === "uninstall" || arg === "--uninstall") {
  const home = process.env.HOME ?? "~";
  const installDir = resolve(home, ".clai");
  const binPath = resolve(home, ".local/bin/clai");
  const configDir = resolve(process.env.XDG_CONFIG_HOME ?? resolve(home, ".config"), "clai");

  console.log("\n  Uninstalling Clai...\n");

  if (existsSync(binPath)) {
    rmSync(binPath);
    console.log(`  Removed ${binPath}`);
  }
  if (existsSync(installDir)) {
    rmSync(installDir, { recursive: true });
    console.log(`  Removed ${installDir}`);
  }

  if (existsSync(configDir)) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`  Remove config and conversations (${configDir})? [y/N] `, (answer) => {
      rl.close();
      if (answer.trim().toLowerCase() === "y") {
        rmSync(configDir, { recursive: true });
        console.log(`  Removed ${configDir}`);
      } else {
        console.log(`  Kept ${configDir}`);
      }
      console.log("\n  Clai uninstalled.\n");
      process.exit(0);
    });
  } else {
    console.log("\n  Clai uninstalled.\n");
    process.exit(0);
  }
}

if (arg === "--version" || arg === "-v") {
  console.log(`clai v${VERSION}`);
  process.exit(0);
}

const GOODBYES = [
  "See you later!",
  "Until next time.",
  "Happy coding!",
  "Bye for now!",
  "Stay curious.",
  "Keep building cool stuff!",
  "May your code compile on the first try.",
  "Off you go. Ship something great.",
  "Later, human.",
  "Catch you on the flip side.",
];

// Read piped stdin if not a TTY
async function readPipedInput(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf-8").trim();
  return text || undefined;
}

const isPiped = !process.stdin.isTTY;
const pipedInput = await readPipedInput();
await ensureApiKey(isPiped);

const app = render(<App initialMessage={pipedInput} />, {
  exitOnCtrlC: false,
  patchConsole: true,
});

app.waitUntilExit().then(() => {
  const msg = GOODBYES[Math.floor(Math.random() * GOODBYES.length)];
  console.log(`\n  ${msg}\n`);
});
