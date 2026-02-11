import { Box, Text } from "ink";
import { theme } from "../lib/theme.js";
import type { AppState, TokenUsage } from "../lib/types.js";

interface StatusBarProps {
  messageCount: number;
  appState: AppState;
  error?: string;
  totalUsage: TokenUsage;
}

export function StatusBar({ messageCount, appState, error, totalUsage }: StatusBarProps) {
  const costDisplay = totalUsage.totalCost > 0 ? `$${totalUsage.totalCost.toFixed(4)}` : "";

  return (
    <Box justifyContent="space-between" paddingX={1}>
      {error ? (
        <Text color={theme.error} wrap="truncate">
          {error}
        </Text>
      ) : appState === "streaming" ? (
        <Text color={theme.accent}>Streaming response...</Text>
      ) : (
        <Text color={theme.dim}>
          {messageCount} message{messageCount !== 1 ? "s" : ""}
          {costDisplay ? ` · ${costDisplay}` : ""}
        </Text>
      )}
      <Text color={theme.dim}>
        {appState === "streaming" ? "Esc to stop · " : "/help · "}Ctrl+C to exit
      </Text>
    </Box>
  );
}
