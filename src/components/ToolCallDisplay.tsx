import { Box, Text } from "ink";
import { theme } from "../lib/theme.js";
import type { ToolCallInfo } from "../lib/types.js";

const TOOL_LABELS: Record<string, string> = {
  read_file: "Read",
  list_dir: "List",
  search_files: "Search",
  write_file: "Write",
};

interface ToolCallDisplayProps {
  tools: ToolCallInfo[];
}

export function ToolCallDisplay({ tools }: ToolCallDisplayProps) {
  if (tools.length === 0) return null;

  return (
    <Box flexDirection="column" marginLeft={3}>
      {tools.map((tool, i) => {
        const label = TOOL_LABELS[tool.name] ?? tool.name;
        const target = (tool.input.path as string) ?? (tool.input.pattern as string) ?? "";
        const bulletColor = tool.isError ? theme.error : tool.output ? theme.system : theme.prompt;

        return (
          <Box key={`${tool.name}-${i}`} gap={1}>
            <Text color={bulletColor}>•</Text>
            <Text bold color={theme.accent}>{label}</Text>
            <Text color={theme.dim}>({target})</Text>
            {tool.output && !tool.isError && (
              <Text color={theme.dim}>✓</Text>
            )}
            {tool.isError && (
              <Text color={theme.error}> ✗ {tool.output}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
