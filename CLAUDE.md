# CLAUDE.md

Project-common rules are located in `AGENTS.md` (read via import). This file should contain instructions that apply only to Claude Code.

@AGENTS.md

## Claude Code 固有

- 変更後の検証は `/verify` スキル（`.claude/skills/verify`）を使う。中身は `AGENTS.md`「変更後の検証」と同じ手順
- `src/` 配下のファイルは Write / Edit 後に PostToolUse フックで自動的に `biome format` される（`.claude/settings.json`）。手動で整形し直す必要はない
- `.dev.vars` / `.env*` の読み取りや `env` / `printenv` は `.claude/settings.json` で deny している。回避しようとしないこと
