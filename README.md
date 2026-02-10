# Clai

A minimal terminal chat powered by the Claude API.

![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-strict-blue)
![License](https://img.shields.io/badge/license-MIT-gray)

## Setup

```bash
pnpm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
pnpm start
```

## Usage

```bash
pnpm start          # interactive chat
pnpm dev            # watch mode
echo "hi" | pnpm start   # pipe input
```

## Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/model` | Switch between Haiku 4.5 and Sonnet 4.5 |
| `/system` | Set a system prompt |
| `/preset` | Save/load system prompt presets |
| `/image` | Send an image for vision analysis |
| `/save` | Save conversation |
| `/load` | Load a saved conversation |
| `/copy` | Copy last response to clipboard |
| `/edit` | Open `$EDITOR` for multi-line input |
| `/compact` | Summarize conversation to save context |
| `/config` | View/persist settings |
| `/tokens` | Show usage and cost (session + lifetime) |
| `/clear` | Clear conversation |
| `/exit` | Quit |

## Features

- Real-time streaming (token-by-token SSE)
- File tools — read, search, list, and write files in your working directory
- Image vision support
- Conversation save/load
- Persistent config and lifetime spend tracking
- Pipe/stdin support
- Markdown rendering in terminal
- Scrollable message history (arrow keys)

## Tech

Node.js, TypeScript, Ink (React for CLIs), Anthropic SDK.

## License

MIT
