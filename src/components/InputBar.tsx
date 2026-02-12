import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { getTheme } from "../lib/theme.js";

interface InputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isDisabled: boolean;
  hasNewlines?: boolean;
}

export function InputBar({ value, onChange, onSubmit, isDisabled, hasNewlines }: InputBarProps) {
  const theme = getTheme();

  // Show visible newline indicator
  const displayValue = hasNewlines ? value.replace(/\n/g, "↵ ") : value;
  const lineCount = hasNewlines ? value.split("\n").length : 1;

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border}
      paddingX={1}
      width="100%"
      flexDirection="column"
    >
      <Box>
        <Text bold color={theme.prompt}>
          {">"}{" "}
        </Text>
        {isDisabled ? (
          <Text color={theme.dim}>Waiting for response...</Text>
        ) : (
          <>
            <TextInput
              value={displayValue}
              onChange={onChange}
              onSubmit={onSubmit}
              placeholder="Type a message..."
            />
            {hasNewlines && <Text color={theme.dim}> ({lineCount} lines)</Text>}
          </>
        )}
      </Box>
      {!isDisabled && hasNewlines && (
        <Text color={theme.dim} dimColor>
          Ctrl+Enter: newline | Enter: send
        </Text>
      )}
    </Box>
  );
}
