# Clai

A minimal terminal chat powered by the Claude API.

![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-strict-blue)
![License](https://img.shields.io/badge/license-MIT-gray)

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/samueldervishi1/clai-cli/master/install.sh | bash
```

Requires Node.js 22+ and pnpm (or npm). On first run, Clai will ask for your Anthropic API key and save it to `~/.config/clai/.env`.

## Usage

```bash
clai                        # interactive chat
echo "explain this" | clai  # pipe input
```

## Dev

```bash
git clone https://github.com/samueldervishi1/clai-cli.git
cd clai-cli
pnpm install
pnpm start        # run from source
pnpm dev           # watch mode
pnpm build         # compile to dist/
pnpm format        # prettier
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
- First-run API key setup (no manual .env needed)

## License

MIT
