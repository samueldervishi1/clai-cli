import { Box, Text } from "ink";
import { theme } from "../lib/theme.js";
import type { Command } from "../lib/commands.js";

interface CommandSuggestionsProps {
  commands: Command[];
}

export function CommandSuggestions({ commands }: CommandSuggestionsProps) {
  if (commands.length === 0) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border}
      paddingX={1}
      width="100%"
    >
      {commands.map((cmd) => (
        <Box key={cmd.name} gap={2}>
          <Text bold color={theme.accent}>
            {cmd.name.padEnd(14)}
          </Text>
          <Text color={theme.dim}>{cmd.description}</Text>
        </Box>
      ))}
    </Box>
  );
}
