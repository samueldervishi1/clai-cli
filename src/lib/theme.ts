export interface ThemeColors {
  accent: string;
  userColor: string;
  assistantColor: string;
  dim: string;
  border: string;
  error: string;
  system: string;
  prompt: string;
}

const THEMES: Record<string, ThemeColors> = {
  dark: {
    accent: "#5cc9f5",
    userColor: "#a78bfa",
    assistantColor: "#e2e8f0",
    dim: "#64748b",
    border: "#334155",
    error: "#f87171",
    system: "#4ade80",
    prompt: "#facc15",
  },
  monokai: {
    accent: "#66d9ef",
    userColor: "#ae81ff",
    assistantColor: "#f8f8f2",
    dim: "#75715e",
    border: "#49483e",
    error: "#f92672",
    system: "#a6e22e",
    prompt: "#e6db74",
  },
  gruvbox: {
    accent: "#83a598",
    userColor: "#d3869b",
    assistantColor: "#ebdbb2",
    dim: "#928374",
    border: "#504945",
    error: "#fb4934",
    system: "#b8bb26",
    prompt: "#fabd2f",
  },
};

let currentThemeName = "gruvbox";

export function getTheme(): ThemeColors {
  return THEMES[currentThemeName] ?? THEMES.dark!;
}

export function setTheme(name: string): boolean {
  if (!THEMES[name]) return false;
  currentThemeName = name;
  return true;
}

export function getThemeName(): string {
  return currentThemeName;
}

export function listThemes(): string[] {
  return Object.keys(THEMES);
}

export const theme = THEMES.gruvbox!;
