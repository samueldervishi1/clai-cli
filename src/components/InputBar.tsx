import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { getTheme } from "../lib/theme.js";

interface InputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isDisabled: boolean;
}

export function InputBar({ value, onChange, onSubmit, isDisabled }: InputBarProps) {
  const theme = getTheme();
  return (
    <Box borderStyle="round" borderColor={theme.border} paddingX={1} width="100%">
      <Text bold color={theme.prompt}>
        {">"}{" "}
      </Text>
      {isDisabled ? (
        <Text color={theme.dim}>Waiting for response...</Text>
      ) : (
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder="Type a message..."
        />
      )}
    </Box>
  );
}
