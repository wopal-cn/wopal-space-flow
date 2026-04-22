---
name: wsf-health
description: Diagnose planning directory health and optionally repair issues
argument-hint: "[project] [--repair]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---
<objective>
Validate `.planning/` directory integrity and report actionable issues. Checks for missing files, invalid configurations, inconsistent state, and orphaned plans.
</objective>

<execution_context>
@~/.claude/wsf/workflows/health.md
</execution_context>

<context>
Project: optional first positional argument (e.g., `space-flow`). If specified, resolve to `$PROJECT_ROOT=projects/<project>/` via `wsf-tools init`.
--repair: optional flag to auto-fix repairable issues.
</context>

<process>
Execute the health workflow from @~/.claude/wsf/workflows/health.md end-to-end.
Parse --repair flag from arguments and pass to workflow.
</process>
