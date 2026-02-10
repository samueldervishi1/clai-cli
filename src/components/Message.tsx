import { Box, Text } from "ink";
import { theme } from "../lib/theme.js";
import { renderMarkdown } from "../lib/markdown.js";
import type { ChatMessage } from "../lib/types.js";

interface MessageProps {
  message: ChatMessage;
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === "user";
  const content = isUser ? message.content : renderMarkdown(message.content);
  const bulletColor = isUser ? theme.prompt : theme.system;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text color={bulletColor}>•  </Text>
        <Text bold color={isUser ? theme.userColor : theme.accent}>
          {isUser ? "You" : "Clai"}
        </Text>
      </Box>
      <Box marginLeft={3}>
        <Text color={isUser ? undefined : theme.assistantColor} wrap="wrap">
          {content}
        </Text>
      </Box>
    </Box>
  );
}
