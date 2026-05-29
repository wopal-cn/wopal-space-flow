---
name: Space Flow AGENT RULES
description: WSF — meta-prompting and spec-driven development system for AI coding tools
---

# Agent Development Rules

## 1. Canonical References

- PRD: `docs/products/wopal-space/PRD-wopalspace.md`
- DESIGN: `projects/space-flow/docs/DESIGN.md`
- Business Rules: `projects/space-flow/docs/BUSINESS_RULES.md`

## 2. Architecture and Directories

WSF deploys commands, agents, workflows, and hooks into target AI coding tool directories via the installer. Runtime chain: `/wsf-xxx` command → workflow orchestration → spawn sub-agent → `wsf-tools.cjs` handles state/config/git → `.planning/` persistence.

| Directory | Responsibility |
|---|---|
| `bin/install.js` | Multi-runtime installer: runtime detection, file copy, config injection |
| `commands/wsf/` | User entry commands (30+), YAML frontmatter + process definitions |
| `wsf/workflows/` | Orchestration logic, thin orchestrator pattern: load context → spawn agent → collect results |
| `agents/` | 24 specialized agent definitions, categorized as Research / Plan / Execute / Verify / Support |
| `wsf/bin/` | CLI toolkit: `wsf-tools.cjs` + 19 lib modules (state, config, phase, roadmap, etc.) |
| `wsf/templates/` | Document templates (PROJECT, ROADMAP, PLAN, SUMMARY, etc.) |
| `wsf/references/` | Shared knowledge docs (35+), consumed by workflows and agents via `@-reference` |
| `hooks/` | Runtime hooks: statusline, context monitor, prompt guard, etc. |
| `tests/` | Node.js built-in test runner files |

## 3. Development Commands

| Scenario | Command | When |
|---|---|---|
| Build hooks | `npm run build:hooks` | After hook source changes |
| Run tests | `npm test` | After any code change |
| Test + coverage | `npm run test:coverage` | Before PR |

Install verification (run from workspace root):

```bash
node projects/space-flow/bin/install.js --wopal-space --local
# Uninstall: add --uninstall
```

Do NOT run `--local` install from within a sub-project directory.

## 4. Implementation Rules

- Core code is plain Node.js CommonJS (`.cjs`), no TypeScript, no bundler. Exception: hooks use esbuild; `prepublishOnly` auto-triggers `build:hooks`.
- Installer is pure JS with zero external dependencies. Tests are single-file with no test framework dependencies.
- Multi-runtime support: the installer handles command/agent format conversion, path mapping, and hook adaptation at install time. Workflows and agents are authored in Claude Code's native format; the installer performs the transform.
- WopalSpace multi-project workspace: key entry commands accept a project parameter (e.g. `/wsf-new-project space-flow`), resolved to `projects/<name>/`. Path resolution is the responsibility of `wsf-tools.cjs` init layer; workflows must not guess the project root.
- WopalSpace runtime: single-root directory model (`skills/`, `wsf/`, `agents/` coexist under one directory). Do not create `.opencode/`, `settings.json`, or `package.json`.
- `--lang <code>` parameter: all document-generating commands/workflows/agents must support it. Decision chain: parameter → context inference (USER.md) → default English. Technical terms, file paths, and commands stay in English.
- Security: never commit `.env`, API keys, or user configs. Never modify upstream command/agent core logic without explicit reason.
- When changing project root resolution, multi-project space support, or `--cwd` passthrough, at minimum update `tests/core.test.cjs`, `tests/init.test.cjs`, `tests/dispatcher.test.cjs`.

## 5. Testing

- Follow TDD: write a failing test first, then implement code to make it pass.
- Framework: Node.js built-in test runner (`--test`), file naming `tests/*.test.cjs`.
- Coverage: c8, 70% lines threshold, covering `wsf/bin/lib/*.cjs`.
- Cross-platform runner: `scripts/run-tests.cjs`.

## 6. User-Supplied Rules

