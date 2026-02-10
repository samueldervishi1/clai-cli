import { useState, useCallback } from "react";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { Box, useApp, useInput, useStdout } from "ink";
import { Header } from "./components/Header.js";
import { MessageList } from "./components/MessageList.js";
import { InputBar } from "./components/InputBar.js";
import { StatusBar } from "./components/StatusBar.js";
import { CommandSuggestions } from "./components/CommandSuggestions.js";
import { streamChat, MODELS, MODEL_DISPLAY, DEFAULT_MODEL } from "./lib/claude.js";
import { filterCommands } from "./lib/commands.js";
import type { ChatMessage, AppState, TokenUsage, ToolCallInfo } from "./lib/types.js";

const VERSION = "0.3.0";

const HELP_TEXT = `Available commands:
  /clear    — Clear conversation history and free up context
  /compact  — Summarize conversation to save context
  /copy     — Copy last Clai response to clipboard
  /exit     — Quit Clai
  /help     — Show this help message
  /model    — Switch model (Haiku 4.5 ↔ Sonnet 4.5)
  /save     — Save conversation to a file
  /system   — Set a system prompt. Usage: /system <prompt>
  /tokens   — Show token usage and cost details

Clai can also read, search, list, and write files in your working directory.
Just ask it to look at your code!`;

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [appState, setAppState] = useState<AppState>("idle");
  const [error, setError] = useState<string | undefined>();
  const [currentModel, setCurrentModel] = useState<string>(DEFAULT_MODEL);
  const [systemPrompt, setSystemPrompt] = useState<string | undefined>();
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
  const [totalUsage, setTotalUsage] = useState<TokenUsage>({
    inputTokens: 0,
    outputTokens: 0,
    totalCost: 0,
  });

  useInput((_input, key) => {
    if (key.ctrl && _input === "c") {
      exit();
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
      const cmd = process.platform === "darwin"
        ? "pbcopy"
        : "xclip -selection clipboard";
      execSync(cmd, { input: text });
      return true;
    } catch {
      return false;
    }
  }, []);

  const runStreamChat = useCallback(
    async (chatMessages: ChatMessage[], maxTokens?: number) => {
      setAppState("streaming");
      setStreamingContent("");
      setToolCalls([]);

      try {
        let fullResponse = "";
        const generator = streamChat(chatMessages, currentModel, maxTokens, systemPrompt);

        let result = await generator.next();
        while (!result.done) {
          const event = result.value;

          if (event.type === "text_delta") {
            fullResponse += event.text;
            setStreamingContent(fullResponse);
          } else if (event.type === "tool_start") {
            setToolCalls((prev) => [...prev, event.tool]);
          } else if (event.type === "tool_done") {
            setToolCalls((prev) =>
              prev.map((t, i) =>
                i === prev.length - 1
                  ? { ...t, output: event.tool.output, isError: event.tool.isError }
                  : t,
              ),
            );
          }

          result = await generator.next();
        }

        const { usage } = result.value;
        setTotalUsage((prev) => ({
          inputTokens: prev.inputTokens + usage.inputTokens,
          outputTokens: prev.outputTokens + usage.outputTokens,
          totalCost: prev.totalCost + usage.totalCost,
        }));

        return fullResponse;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return null;
      } finally {
        setStreamingContent("");
        setToolCalls([]);
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
        const detail = `Token usage this session:
  Input:  ${totalUsage.inputTokens.toLocaleString()} tokens
  Output: ${totalUsage.outputTokens.toLocaleString()} tokens
  Cost:   $${totalUsage.totalCost.toFixed(4)}`;
        addSystemMessage(detail);
        return;
      }

      if (trimmed === "/model") {
        const newModel = currentModel === MODELS.haiku ? MODELS.sonnet : MODELS.haiku;
        setCurrentModel(newModel);
        addSystemMessage(`Switched to ${MODEL_DISPLAY[newModel]}`);
        return;
      }

      if (trimmed.startsWith("/system")) {
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

      if (trimmed === "/save") {
        if (messages.length === 0) {
          setError("No messages to save.");
          return;
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `clai-chat-${timestamp}.md`;
        const content = messages
          .map((m) => `## ${m.role === "user" ? "You" : "Clai"}\n\n${m.content}`)
          .join("\n\n---\n\n");
        try {
          writeFileSync(filename, content);
          addSystemMessage(`Conversation saved to ${filename}`);
        } catch {
          setError(`Failed to save file.`);
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

        const fullResponse = await runStreamChat(summaryRequest, 512);
        if (fullResponse) {
          setMessages([
            {
              id: `compact-${Date.now()}`,
              role: "assistant",
              content: `[Conversation compacted]\n\n${fullResponse}`,
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

      const fullResponse = await runStreamChat(updatedMessages);
      if (fullResponse) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: fullResponse,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    },
    [messages, appState, exit, addSystemMessage, totalUsage, currentModel, systemPrompt, copyToClipboard, runStreamChat],
  );

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Header version={VERSION} model={currentModel} />
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        appState={appState}
        toolCalls={toolCalls}
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
