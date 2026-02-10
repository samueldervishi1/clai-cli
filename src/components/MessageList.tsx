import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { Message } from "./Message.js";
import { ToolCallDisplay } from "./ToolCallDisplay.js";
import { theme } from "../lib/theme.js";
import type { ChatMessage, AppState, ToolCallInfo } from "../lib/types.js";

interface MessageListProps {
  messages: ChatMessage[];
  streamingContent: string;
  appState: AppState;
  toolCalls: ToolCallInfo[];
}

export function MessageList({
  messages,
  streamingContent,
  appState,
  toolCalls,
}: MessageListProps) {
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      paddingX={1}
      overflow="hidden"
      justifyContent="flex-end"
    >
      {messages.length === 0 && appState === "idle" && (
        <Box marginTop={1}>
          <Text color={theme.dim}>Start a conversation. Type a message below.</Text>
        </Box>
      )}

      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}

      {appState === "streaming" && (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={theme.system}>•  </Text>
            <Text bold color={theme.accent}>Clai</Text>
          </Box>

          {/* Show tool calls */}
          <ToolCallDisplay tools={toolCalls} />

          {/* Show streaming text or spinner */}
          <Box marginLeft={3}>
            {streamingContent ? (
              <Text color={theme.assistantColor} wrap="wrap">
                {streamingContent}
                <Text color={theme.dim}>▌</Text>
              </Text>
            ) : toolCalls.length === 0 ? (
              <Text color={theme.dim}>
                <Spinner type="dots" /> Thinking...
              </Text>
            ) : null}
          </Box>
        </Box>
      )}
    </Box>
  );
}
