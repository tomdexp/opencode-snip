# opencode-snip

OpenCode plugin that routes matching shell commands through [snip](https://github.com/edouard-claude/snip) to reduce LLM token consumption by 60-90%.

## What is snip?

[snip](https://github.com/edouard-claude/snip) is a CLI proxy that filters shell output before it reaches your LLM context window.

| Command | Before | After | Savings |
|---------|--------|-------|---------|
| `go test ./...` | 689 tokens | 16 tokens | 97.7% |
| `git log` | 371 tokens | 53 tokens | 85.7% |
| `cargo test` | 591 tokens | 5 tokens | 99.2% |

## Installation

### 1. Install snip

```bash
brew install edouard-claude/tap/snip
# or
go install github.com/edouard-claude/snip/cmd/snip@latest
```

### 2. Configure OpenCode

Add the plugin to your OpenCode config (`~/.config/opencode/opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-snip@latest"]
}
```

## How It Works

The plugin uses `tool.execute.before` to rewrite bash commands only when a real `snip` filter matches the command and flags.

- Commands without a matching filter are left untouched.
- Plugin-added `snip` is hidden from future LLM turns to avoid tool contamination.
- Explicit user-authored `snip ...` commands are preserved.

This plugin may still show `snip` in visible OpenCode tool history. The hiding is applied to the message stream sent back to the LLM.

## Matching Behavior

The plugin mirrors `snip`'s filter matching model:

- Match by base command and optional subcommand.
- Respect `exclude_flags` and `require_flags`.
- Load built-in filters from upstream `snip`.
- Load configured user filters from `snip config` filter directories.
- Respect `filters.enable.*` from `snip config`.

Project-local user filters follow `snip` trust rules: only trusted filter files are considered.

## Development

This package uses [semantic-release](https://semantic-release.gitbook.io/) for automated releases. Commit messages should follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

- `fix:` → patch release
- `feat:` → minor release
- `feat!:`, `fix!:` → major release

## License

MIT
