import { Box, Text } from "ink";
import { theme } from "../lib/theme.js";
import { DEFAULT_MODEL } from "../lib/claude.js";

interface HeaderProps {
  version: string;
  model?: string;
}

export function Header({ version, model = DEFAULT_MODEL }: HeaderProps) {
  const cwd = process.cwd();
  const shortCwd = cwd.replace(process.env.HOME ?? "", "~");
  const modelDisplay = model.includes("haiku") ? "Haiku 4.5" : "Sonnet 4.5";

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text bold color={theme.accent}>Clai</Text>
        <Text color={theme.dim}> v{version}</Text>
        <Text color={theme.dim}>  {modelDisplay}</Text>
        <Text color={theme.dim}>  {shortCwd}</Text>
      </Box>
      <Text color={theme.system}>
        Type /help for commands · /clear to reset · /tokens for usage
      </Text>
      <Text color={theme.border}>{"─".repeat(80)}</Text>
    </Box>
  );
}
