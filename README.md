# vibe-code

> Security-first CLI wrapper for Claude Code with opinionated prompts and guardrails.

## What is vibe-code?

`vibe-code` wraps [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with:

- **Security-first prompts** injected automatically
- **Structured workflows** (brick-by-brick development)
- **Multiple modes** for different skill levels
- **Guardrails** that validate AI output
- **Secure project templates**

## Installation

```bash
npm install -g vibe-code
```

## Quick Start

```bash
# Initialize in your project
vibe init

# Start Claude Code with vibe configuration
vibe start

# Change modes
vibe mode guided
```

## Modes

| Mode | Description | Best For |
|------|-------------|----------|
| `learning` | Maximum explanation, suggests best practices, warns about anti-patterns | Beginners |
| `guided` | Brick-by-brick workflow, requires approval at each step | Intermediate |
| `expert` | Fast execution with security defaults, minimal commentary | Advanced |

## Commands

| Command | Description |
|---------|-------------|
| `vibe init` | Initialize vibe-code in current project |
| `vibe start` | Launch Claude Code with configuration |
| `vibe mode [mode]` | View or change current mode |
| `vibe config` | View or modify configuration |
| `vibe setup` | Interactive setup wizard for Claude Code |
| `vibe doctor` | Diagnose and fix issues with setup |
| `vibe audit [path]` | Security audit existing code |
| `vibe template <name>` | Scaffold from secure template |

## Getting Started

### First Time Setup

If you don't have Claude Code installed, run the setup wizard:

```bash
vibe setup
```

This will:
1. Check if Claude Code is installed
2. Guide you through installation (npm or Homebrew)
3. Help you authenticate with Anthropic
4. Verify everything is working

### Troubleshooting

If you encounter issues, run the doctor command:

```bash
vibe doctor        # View diagnostics
vibe doctor --fix  # Attempt automatic fixes
```

## How It Works

1. `vibe init` creates a `CLAUDE.md` file with security-first prompts
2. `vibe start` launches Claude Code, which reads `CLAUDE.md`
3. Claude Code operates with your configured mode and guardrails

## Configuration

### Global Config (`~/.vibe/config.json`)

```json
{
  "defaultMode": "guided",
  "editor": "code"
}
```

### Project Config (`.vibe/config.json`)

```json
{
  "mode": "guided",
  "projectName": "my-project",
  "template": "api"
}
```

## Security Philosophy

vibe-code enforces:

- ✅ TypeScript only (no JavaScript)
- ✅ Input validation on all boundaries
- ✅ No hardcoded secrets
- ✅ No `eval()` or dynamic execution
- ✅ Least privilege permissions
- ✅ Auth on all endpoints by default
- ✅ Brick-by-brick development with approval gates

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start -- --help

# Lint
npm run lint

# Type check
npm run typecheck

# Test
npm test
```

## License

MIT
