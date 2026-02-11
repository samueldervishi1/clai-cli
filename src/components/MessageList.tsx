import { useMemo } from "react";
import { Box, Text, useStdout } from "ink";
import Spinner from "ink-spinner";
import { Message } from "./Message.js";
import { getTheme } from "../lib/theme.js";
import type { ChatMessage, AppState, MessageSegment } from "../lib/types.js";

const TOOL_LABELS: Record<string, string> = {
  read_file: "Read",
  list_dir: "List",
  search_files: "Search",
  write_file: "Write",
};

interface MessageListProps {
  messages: ChatMessage[];
  streamSegments: MessageSegment[];
  appState: AppState;
  scrollOffset: number;
}

// Estimate how many terminal lines a message takes
function estimateLines(content: string, width: number): number {
  const lines = content.split("\n");
  let total = 2; // bullet line + margin
  for (const line of lines) {
    total += Math.max(1, Math.ceil((line.length + 3) / width)); // +3 for marginLeft
  }
  return total;
}

// Estimate lines for streaming segments
function estimateSegmentLines(segments: MessageSegment[], width: number): number {
  let total = 2; // • Clai header + margin
  for (const seg of segments) {
    if (seg.type === "text") {
      for (const line of seg.content.split("\n")) {
        total += Math.max(1, Math.ceil((line.length + 3) / width));
      }
    } else {
      total += 1; // tool line
    }
  }
  return total;
}

export function MessageList({
  messages,
  streamSegments,
  appState,
  scrollOffset,
}: MessageListProps) {
  const theme = getTheme();
  const { stdout } = useStdout();
  const termWidth = stdout?.columns ?? 80;
  const termHeight = stdout?.rows ?? 24;

  // Available lines: terminal minus header(~3), input(~3), status(~1)
  const availableLines = termHeight - 7;

  // Only render messages that fit on screen, with scroll offset support
  const { visible, hasAbove, hasBelow } = useMemo(() => {
    let linesUsed = 0;
    const result: ChatMessage[] = [];

    // Reserve lines for streaming content (only when at bottom)
    if (appState === "streaming" && scrollOffset === 0) {
      linesUsed += streamSegments.length > 0 ? estimateSegmentLines(streamSegments, termWidth) : 3; // spinner
    }

    // Reserve a line for scroll indicators
    const indicatorLines = scrollOffset > 0 ? 1 : 0;
    linesUsed += indicatorLines;

    // Start from scrollOffset messages before the end
    const endIdx = messages.length - scrollOffset;

    // Add messages backwards from endIdx until we run out of space
    for (let i = endIdx - 1; i >= 0; i--) {
      const msg = messages[i]!;
      const lines = estimateLines(msg.content, termWidth);
      if (linesUsed + lines > availableLines && result.length > 0) {
        break;
      }
      result.unshift(msg);
      linesUsed += lines;
    }

    return {
      visible: result,
      hasAbove: result.length > 0 && result[0] !== messages[0],
      hasBelow: scrollOffset > 0,
    };
  }, [messages, appState, streamSegments, termWidth, availableLines, scrollOffset]);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
      {messages.length === 0 && appState === "idle" && (
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <Text color={theme.dim}>Type a message to start chatting.</Text>
        </Box>
      )}

      {hasAbove && <Text color={theme.dim}> ↑ more messages above</Text>}

      {visible.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}

      {hasBelow && <Text color={theme.dim}> ↓ more messages below</Text>}

      {appState === "streaming" && scrollOffset === 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={theme.system}>• </Text>
            <Text bold color={theme.accent}>
              Clai
            </Text>
          </Box>

          <Box flexDirection="column" marginLeft={3}>
            {streamSegments.length === 0 ? (
              <Text color={theme.dim}>
                <Spinner type="dots" /> Thinking...
              </Text>
            ) : (
              streamSegments.map((seg, i) => {
                if (seg.type === "text") {
                  const isLast = i === streamSegments.length - 1;
                  return (
                    <Text key={i} color={theme.assistantColor} wrap="wrap">
                      {seg.content}
                      {isLast && <Text color={theme.dim}>▌</Text>}
                    </Text>
                  );
                }
                const label = TOOL_LABELS[seg.name] ?? seg.name;
                const target = (seg.input.path as string) ?? (seg.input.pattern as string) ?? "";
                return (
                  <Text key={i} color={theme.dim} dimColor>
                    {seg.isError ? "✗" : seg.output ? "✓" : "⟳"} {label} {target}
                  </Text>
                );
              })
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
