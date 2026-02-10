import { useState, useCallback, useEffect, useMemo } from "react";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { Box, useApp, useInput, useStdout } from "ink";
import { Header } from "./components/Header.js";
import { MessageList } from "./components/MessageList.js";
import { InputBar } from "./components/InputBar.js";
import { StatusBar } from "./components/StatusBar.js";
import { CommandSuggestions } from "./components/CommandSuggestions.js";
import { streamChat, MODELS, MODEL_DISPLAY, DEFAULT_MODEL } from "./lib/claude.js";
import { filterCommands } from "./lib/commands.js";
import {
  loadConfig,
  saveConfig,
  getConfigPath,
  addLifetimeSpend,
  getLifetimeSpend,
} from "./lib/config.js";
import { saveConversation, loadConversation, listConversations } from "./lib/conversations.js";
import type { ChatMessage, AppState, TokenUsage, MessageSegment, ChatImage } from "./lib/types.js";
import { VERSION } from "./lib/version.js";

const HELP_TEXT = `Available commands:
  /clear    — Clear conversation history and free up context
  /compact  — Summarize conversation to save context
  /config   — Show config. /config save to persist settings
  /copy     — Copy last Clai response to clipboard
  /edit     — Open $EDITOR for multi-line input
  /exit     — Quit Clai
  /help     — Show this help message
  /image    — Send an image. Usage: /image <path> [question]
  /load     — Load a saved conversation. /load to list
  /model    — Switch model (Haiku 4.5 ↔ Sonnet 4.5)
  /preset   — System prompt presets. /preset <name> or /preset save <name>
  /save     — Save conversation. /save [name]
  /system   — Set a system prompt. Usage: /system <prompt>
  /tokens   — Show token usage and cost details

Clai can also read, search, list, and write files in your working directory.
Just ask it to look at your code!`;

const IMAGE_EXTENSIONS: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

interface AppProps {
  initialMessage?: string;
}

export function App({ initialMessage }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const config = useMemo(() => loadConfig(), []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [streamSegments, setStreamSegments] = useState<MessageSegment[]>([]);
  const [appState, setAppState] = useState<AppState>("idle");
  const [error, setError] = useState<string | undefined>();
  const [currentModel, setCurrentModel] = useState<string>(config.defaultModel ?? DEFAULT_MODEL);
  const [systemPrompt, setSystemPrompt] = useState<string | undefined>(config.systemPrompt);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [totalUsage, setTotalUsage] = useState<TokenUsage>({
    inputTokens: 0,
    outputTokens: 0,
    totalCost: 0,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    setScrollOffset(0);
  }, [messages.length]);

  // Handle piped stdin input
  useEffect(() => {
    if (!initialMessage) return;
    handleSubmit(initialMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInput((_input, key) => {
    if (key.ctrl && _input === "c") {
      exit();
    }
    if (appState === "idle") {
      const scrollUp = key.pageUp || (key.upArrow && !inputValue);
      const scrollDown = key.pageDown || (key.downArrow && !inputValue);
      if (scrollUp) {
        setScrollOffset((prev) => Math.min(prev + 3, Math.max(0, messages.length - 1)));
      }
      if (scrollDown) {
        setScrollOffset((prev) => Math.max(0, prev - 3));
      }
    }
  });

  const addSystemMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      id: `system-${Date.now()}`,
      role: "assistant",
      content,
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const copyToClipboard = useCallback((text: string): boolean => {
    try {
      const cmd = process.platform === "darwin" ? "pbcopy" : "xclip -selection clipboard";
      execSync(cmd, { input: text });
      return true;
    } catch {
      return false;
    }
  }, []);

  const runStreamChat = useCallback(
    async (
      chatMessages: ChatMessage[],
      maxTokens?: number,
    ): Promise<{ text: string; segments: MessageSegment[] } | null> => {
      setAppState("streaming");
      setStreamSegments([]);

      try {
        let fullResponse = "";
        const localSegments: MessageSegment[] = [];
        const generator = streamChat(chatMessages, currentModel, maxTokens, systemPrompt);

        let result = await generator.next();
        while (!result.done) {
          const event = result.value;

          if (event.type === "text_delta") {
            fullResponse += event.text;
            const last = localSegments[localSegments.length - 1];
            if (last?.type === "text") {
              last.content += event.text;
            } else {
              localSegments.push({ type: "text", content: event.text });
            }
            setStreamSegments([...localSegments]);
          } else if (event.type === "tool_start") {
            localSegments.push({ type: "tool", name: event.tool.name, input: event.tool.input });
            setStreamSegments([...localSegments]);
          } else if (event.type === "tool_done") {
            for (let i = localSegments.length - 1; i >= 0; i--) {
              const seg = localSegments[i];
              if (seg?.type === "tool" && !seg.output) {
                seg.output = event.tool.output;
                seg.isError = event.tool.isError;
                break;
              }
            }
            setStreamSegments([...localSegments]);
          }

          result = await generator.next();
        }

        const { usage } = result.value;
        setTotalUsage((prev) => ({
          inputTokens: prev.inputTokens + usage.inputTokens,
          outputTokens: prev.outputTokens + usage.outputTokens,
          totalCost: prev.totalCost + usage.totalCost,
        }));
        addLifetimeSpend(usage.totalCost);

        return { text: fullResponse, segments: localSegments };
      } catch (err: unknown) {
        let msg: string;
        if (err && typeof err === "object" && "status" in err && "error" in err) {
          const apiErr = err as { status: number; error?: { error?: { message?: string } } };
          msg = apiErr.error?.error?.message ?? `API error (${apiErr.status})`;
        } else {
          msg = err instanceof Error ? err.message : String(err);
        }
        setError(msg);
        return null;
      } finally {
        setStreamSegments([]);
        setAppState("idle");
      }
    },
    [currentModel, systemPrompt],
  );

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || appState === "streaming") return;

      setInputValue("");
      setError(undefined);

      // === Commands ===

      if (trimmed.toLowerCase() === "exit" || trimmed === "/exit") {
        exit();
        return;
      }

      if (trimmed === "/clear") {
        setMessages([]);
        setTotalUsage({ inputTokens: 0, outputTokens: 0, totalCost: 0 });
        return;
      }

      if (trimmed === "/help") {
        addSystemMessage(HELP_TEXT);
        return;
      }

      if (trimmed === "/tokens") {
        const lifetime = getLifetimeSpend();
        const detail = `Token usage this session:
  Input:  ${totalUsage.inputTokens.toLocaleString()} tokens
  Output: ${totalUsage.outputTokens.toLocaleString()} tokens
  Cost:   $${totalUsage.totalCost.toFixed(4)}

Lifetime spend: $${lifetime.toFixed(4)}`;
        addSystemMessage(detail);
        return;
      }

      if (trimmed === "/model") {
        const newModel = currentModel === MODELS.haiku ? MODELS.sonnet : MODELS.haiku;
        setCurrentModel(newModel);
        addSystemMessage(`Switched to ${MODEL_DISPLAY[newModel]}`);
        return;
      }

      if (trimmed === "/system" || trimmed.startsWith("/system ")) {
        const prompt = trimmed.slice("/system".length).trim();
        if (!prompt) {
          if (systemPrompt) {
            addSystemMessage(`Current system prompt: "${systemPrompt}"`);
          } else {
            addSystemMessage("No system prompt set. Usage: /system <prompt>");
          }
          return;
        }
        setSystemPrompt(prompt);
        addSystemMessage(`System prompt set: "${prompt}"`);
        return;
      }

      if (trimmed === "/copy") {
        const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
        if (!lastAssistant) {
          setError("No Clai response to copy.");
          return;
        }
        const ok = copyToClipboard(lastAssistant.content);
        if (ok) {
          addSystemMessage("Copied last response to clipboard.");
        } else {
          setError("Failed to copy. Install xclip: sudo apt install xclip");
        }
        return;
      }

      if (trimmed === "/save" || trimmed.startsWith("/save ")) {
        if (messages.length === 0) {
          setError("No messages to save.");
          return;
        }
        const name = trimmed.slice("/save".length).trim() || undefined;
        try {
          const slug = saveConversation(messages, name);
          addSystemMessage(`Conversation saved as "${slug}". Use /load ${slug} to restore.`);
        } catch {
          setError("Failed to save conversation.");
        }
        return;
      }

      if (trimmed === "/load" || trimmed.startsWith("/load ")) {
        const name = trimmed.slice("/load".length).trim();
        if (!name) {
          const convos = listConversations();
          if (convos.length === 0) {
            addSystemMessage("No saved conversations. Use /save [name] to save one.");
          } else {
            const list = convos
              .slice(0, 10)
              .map((c) => `  ${c}`)
              .join("\n");
            addSystemMessage(`Saved conversations:\n${list}\n\nUse /load <name> to restore.`);
          }
          return;
        }
        const loaded = loadConversation(name);
        if (!loaded) {
          setError(`Conversation "${name}" not found. Use /load to list.`);
          return;
        }
        setMessages(loaded);
        setTotalUsage({ inputTokens: 0, outputTokens: 0, totalCost: 0 });
        addSystemMessage(`Loaded conversation "${name}" (${loaded.length} messages).`);
        return;
      }

      if (trimmed === "/config" || trimmed === "/config save") {
        if (trimmed === "/config save") {
          const existing = loadConfig();
          const ok = saveConfig({
            ...existing,
            defaultModel: currentModel,
            systemPrompt,
          });
          if (ok) {
            addSystemMessage(`Config saved to ${getConfigPath()}`);
          } else {
            setError("Failed to save config.");
          }
          return;
        }
        const modelName = MODEL_DISPLAY[currentModel] ?? currentModel;
        addSystemMessage(`Current settings:
  Model:   ${modelName}
  System:  ${systemPrompt ?? "(none)"}
  Config:  ${getConfigPath()}

Use /config save to persist current settings.`);
        return;
      }

      if (trimmed === "/preset" || trimmed.startsWith("/preset ")) {
        const arg = trimmed.slice("/preset".length).trim();
        const cfg = loadConfig();
        const presets = cfg.presets ?? {};

        if (!arg) {
          const names = Object.keys(presets);
          if (names.length === 0) {
            addSystemMessage(
              "No presets saved. Usage:\n  /preset save <name> — Save current system prompt\n  /preset <name> — Activate a preset",
            );
          } else {
            const list = names.map((n) => `  ${n}: "${presets[n]}"`).join("\n");
            addSystemMessage(`System prompt presets:\n${list}\n\nUse /preset <name> to activate.`);
          }
          return;
        }

        if (arg.startsWith("save ")) {
          const name = arg.slice("save ".length).trim();
          if (!name) {
            setError("Usage: /preset save <name>");
            return;
          }
          if (!systemPrompt) {
            setError("No system prompt set. Use /system first.");
            return;
          }
          presets[name] = systemPrompt;
          cfg.presets = presets;
          saveConfig(cfg);
          addSystemMessage(`Preset "${name}" saved.`);
          return;
        }

        if (arg === "delete" || arg.startsWith("delete ")) {
          const name = arg.slice("delete".length).trim();
          if (!name || !presets[name]) {
            setError(`Preset "${name}" not found.`);
            return;
          }
          delete presets[name];
          cfg.presets = presets;
          saveConfig(cfg);
          addSystemMessage(`Preset "${name}" deleted.`);
          return;
        }

        const preset = presets[arg];
        if (!preset) {
          setError(`Preset "${arg}" not found. Use /preset to list.`);
          return;
        }
        setSystemPrompt(preset);
        addSystemMessage(`Activated preset "${arg}": "${preset}"`);
        return;
      }

      if (trimmed.startsWith("/image ")) {
        const rest = trimmed.slice("/image ".length).trim();
        const parts = rest.split(/\s+/);
        const imagePath = parts[0];
        const question = parts.slice(1).join(" ") || "What's in this image?";

        if (!imagePath) {
          setError("Usage: /image <path> [question]");
          return;
        }

        const absPath = resolve(imagePath);
        if (!existsSync(absPath)) {
          setError(`File not found: ${imagePath}`);
          return;
        }

        const ext = extname(absPath).toLowerCase();
        const mediaType = IMAGE_EXTENSIONS[ext];
        if (!mediaType) {
          setError(`Unsupported image format: ${ext}. Use .jpg, .png, .gif, or .webp`);
          return;
        }

        try {
          const data = readFileSync(absPath).toString("base64");
          const image: ChatImage = { data, mediaType };

          const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: question,
            images: [image],
          };
          const updatedMessages = [...messages, userMessage];
          setMessages(updatedMessages);

          const chatResult = await runStreamChat(updatedMessages);
          if (chatResult) {
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                role: "assistant" as const,
                content: chatResult.text,
                segments: chatResult.segments,
              },
            ]);
          }
        } catch {
          setError("Failed to read image file.");
        }
        return;
      }

      if (trimmed === "/edit") {
        const tmpFile = `/tmp/clai-edit-${Date.now()}.md`;
        const editor = process.env.EDITOR ?? process.env.VISUAL ?? "nano";
        try {
          writeFileSync(tmpFile, "");
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          process.stdin.pause();

          execSync(`${editor} "${tmpFile}"`, { stdio: "inherit" });

          process.stdin.resume();
          if (process.stdin.isTTY) process.stdin.setRawMode(true);

          const content = readFileSync(tmpFile, "utf-8").trim();
          unlinkSync(tmpFile);

          if (!content) {
            addSystemMessage("Editor closed with no content.");
            return;
          }

          const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content,
          };
          const updatedMessages = [...messages, userMessage];
          setMessages(updatedMessages);

          const chatResult = await runStreamChat(updatedMessages);
          if (chatResult) {
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                role: "assistant" as const,
                content: chatResult.text,
                segments: chatResult.segments,
              },
            ]);
          }
        } catch (err) {
          process.stdin.resume();
          if (process.stdin.isTTY) process.stdin.setRawMode(true);
          try {
            unlinkSync(tmpFile);
          } catch {}
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Editor failed: ${msg}`);
        }
        return;
      }

      if (trimmed === "/compact") {
        if (messages.length < 4) {
          setError("Not enough messages to compact.");
          return;
        }
        const summaryRequest: ChatMessage[] = [
          ...messages,
          {
            id: "compact-req",
            role: "user",
            content:
              "Summarize our conversation so far in a concise paragraph. Include key topics discussed, any decisions made, and important context to remember.",
          },
        ];

        const compactResult = await runStreamChat(summaryRequest, 512);
        if (compactResult) {
          setMessages([
            {
              id: `compact-${Date.now()}`,
              role: "assistant",
              content: `[Conversation compacted]\n\n${compactResult.text}`,
            },
          ]);
        }
        return;
      }

      if (trimmed.startsWith("/")) {
        setError(`Unknown command: ${trimmed}. Type /help for available commands.`);
        return;
      }

      // === Regular chat message ===
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      const chatResult = await runStreamChat(updatedMessages);
      if (chatResult) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: chatResult.text,
          segments: chatResult.segments,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    },
    [
      messages,
      appState,
      exit,
      addSystemMessage,
      totalUsage,
      currentModel,
      systemPrompt,
      copyToClipboard,
      runStreamChat,
    ],
  );

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Header version={VERSION} model={currentModel} />
      <MessageList
        messages={messages}
        streamSegments={streamSegments}
        appState={appState}
        scrollOffset={scrollOffset}
      />
      <CommandSuggestions commands={filterCommands(inputValue)} />
      <InputBar
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        isDisabled={appState === "streaming"}
      />
      <StatusBar
        messageCount={messages.length}
        appState={appState}
        error={error}
        totalUsage={totalUsage}
      />
    </Box>
  );
}
