#!/usr/bin/env node

import { render } from "ink";
import { App } from "./App.js";
import { ensureApiKey } from "./lib/api-key.js";

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
