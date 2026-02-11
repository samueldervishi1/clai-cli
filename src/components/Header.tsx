import { Box, Text, useStdout } from "ink";
import { getTheme } from "../lib/theme.js";
import { DEFAULT_MODEL } from "../lib/claude.js";

interface HeaderProps {
  version: string;
  model?: string;
}

export function Header({ version, model = DEFAULT_MODEL }: HeaderProps) {
  const theme = getTheme();
  const { stdout } = useStdout();
  const termWidth = Math.max((stdout?.columns ?? 80) - 2, 10);
  const modelDisplay = model.includes("haiku") ? "Haiku 4.5" : "Sonnet 4.5";

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box justifyContent="center">
        <Text bold color={theme.accent}>
          Clai
        </Text>
        <Text color={theme.dim}> v{version}</Text>
        <Text color={theme.dim}> · {modelDisplay}</Text>
      </Box>
      <Box justifyContent="center">
        <Text color={theme.dim}>/help · /clear · /model · /tokens · Ctrl+C exit</Text>
      </Box>
      <Text color={theme.border}>{"─".repeat(termWidth)}</Text>
    </Box>
  );
}
