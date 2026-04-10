# WSF CLI Tools Reference

> Programmatic API reference for `wsf-tools.cjs`. Used by workflows and agents internally. For user-facing commands, see [Command Reference](COMMANDS.md).

---

## Overview

`wsf-tools.cjs` is a Node.js CLI utility that replaces repetitive inline bash patterns across WSF's ~50 command, workflow, and agent files. It centralizes: config parsing, model resolution, phase lookup, git commits, summary verification, state management, and template operations.

**Location:** `wsf/bin/wsf-tools.cjs`
**Modules:** 15 domain modules in `wsf/bin/lib/`

**Usage:**
```bash
node wsf-tools.cjs <command> [args] [--raw] [--cwd <path>]
```

**Global Flags:**
| Flag | Description |
|------|-------------|
| `--raw` | Machine-readable output (JSON or plain text, no formatting) |
| `--cwd <path>` | Override working directory (for sandboxed subagents) |

---

## State Commands

Manage `.planning/STATE.md` — the project's living memory.

```bash
# Load full project config + state as JSON
node wsf-tools.cjs state load

# Output STATE.md frontmatter as JSON
node wsf-tools.cjs state json

# Update a single field
node wsf-tools.cjs state update <field> <value>

# Get STATE.md content or a specific section
node wsf-tools.cjs state get [section]

# Batch update multiple fields
node wsf-tools.cjs state patch --field1 val1 --field2 val2

# Increment plan counter
node wsf-tools.cjs state advance-plan

# Record execution metrics
node wsf-tools.cjs state record-metric --phase N --plan M --duration Xmin [--tasks N] [--files N]

# Recalculate progress bar
node wsf-tools.cjs state update-progress

# Add a decision
node wsf-tools.cjs state add-decision --summary "..." [--phase N] [--rationale "..."]
# Or from files:
node wsf-tools.cjs state add-decision --summary-file path [--rationale-file path]

# Add/resolve blockers
node wsf-tools.cjs state add-blocker --text "..."
node wsf-tools.cjs state resolve-blocker --text "..."

# Record session continuity
node wsf-tools.cjs state record-session --stopped-at "..." [--resume-file path]
```

### State Snapshot

Structured parse of the full STATE.md:

```bash
node wsf-tools.cjs state-snapshot
```

Returns JSON with: current position, phase, plan, status, decisions, blockers, metrics, last activity.

---

## Phase Commands

Manage phases — directories, numbering, and roadmap sync.

```bash
# Find phase directory by number
node wsf-tools.cjs find-phase <phase>

# Calculate next decimal phase number for insertions
node wsf-tools.cjs phase next-decimal <phase>

# Append new phase to roadmap + create directory
node wsf-tools.cjs phase add <description>

# Insert decimal phase after existing
node wsf-tools.cjs phase insert <after> <description>

# Remove phase, renumber subsequent
node wsf-tools.cjs phase remove <phase> [--force]

# Mark phase complete, update state + roadmap
node wsf-tools.cjs phase complete <phase>

# Index plans with waves and status
node wsf-tools.cjs phase-plan-index <phase>

# List phases with filtering
node wsf-tools.cjs phases list [--type planned|executed|all] [--phase N] [--include-archived]
```

---

## Roadmap Commands

Parse and update `ROADMAP.md`.

```bash
# Extract phase section from ROADMAP.md
node wsf-tools.cjs roadmap get-phase <phase>

# Full roadmap parse with disk status
node wsf-tools.cjs roadmap analyze

# Update progress table row from disk
node wsf-tools.cjs roadmap update-plan-progress <N>
```

---

## Config Commands

Read and write `.planning/config.json`.

```bash
# Initialize config.json with defaults
node wsf-tools.cjs config-ensure-section

# Set a config value (dot notation)
node wsf-tools.cjs config-set <key> <value>

# Get a config value
node wsf-tools.cjs config-get <key>

# Set model profile
node wsf-tools.cjs config-set-model-profile <profile>
```

---

## Model Resolution

```bash
# Get model for agent based on current profile
node wsf-tools.cjs resolve-model <agent-name>
# Returns: opus | sonnet | haiku | inherit
```

Agent names: `wsf-planner`, `wsf-executor`, `wsf-phase-researcher`, `wsf-project-researcher`, `wsf-research-synthesizer`, `wsf-verifier`, `wsf-plan-checker`, `wsf-integration-checker`, `wsf-roadmapper`, `wsf-debugger`, `wsf-codebase-mapper`, `wsf-nyquist-auditor`

---

## Verification Commands

Validate plans, phases, references, and commits.

```bash
# Verify SUMMARY.md file
node wsf-tools.cjs verify-summary <path> [--check-count N]

# Check PLAN.md structure + tasks
node wsf-tools.cjs verify plan-structure <file>

# Check all plans have summaries
node wsf-tools.cjs verify phase-completeness <phase>

# Check @-refs + paths resolve
node wsf-tools.cjs verify references <file>

# Batch verify commit hashes
node wsf-tools.cjs verify commits <hash1> [hash2] ...

# Check must_haves.artifacts
node wsf-tools.cjs verify artifacts <plan-file>

# Check must_haves.key_links
node wsf-tools.cjs verify key-links <plan-file>
```

---

## Validation Commands

Check project integrity.

```bash
# Check phase numbering, disk/roadmap sync
node wsf-tools.cjs validate consistency

# Check .planning/ integrity, optionally repair
node wsf-tools.cjs validate health [--repair]
```

---

## Template Commands

Template selection and filling.

```bash
# Select summary template based on granularity
node wsf-tools.cjs template select <type>

# Fill template with variables
node wsf-tools.cjs template fill <type> --phase N [--plan M] [--name "..."] [--type execute|tdd] [--wave N] [--fields '{json}']
```

Template types for `fill`: `summary`, `plan`, `verification`

---

## Frontmatter Commands

YAML frontmatter CRUD operations on any Markdown file.

```bash
# Extract frontmatter as JSON
node wsf-tools.cjs frontmatter get <file> [--field key]

# Update single field
node wsf-tools.cjs frontmatter set <file> --field key --value jsonVal

# Merge JSON into frontmatter
node wsf-tools.cjs frontmatter merge <file> --data '{json}'

# Validate required fields
node wsf-tools.cjs frontmatter validate <file> --schema plan|summary|verification
```

---

## Scaffold Commands

Create pre-structured files and directories.

```bash
# Create CONTEXT.md template
node wsf-tools.cjs scaffold context --phase N

# Create UAT.md template
node wsf-tools.cjs scaffold uat --phase N

# Create VERIFICATION.md template
node wsf-tools.cjs scaffold verification --phase N

# Create phase directory
node wsf-tools.cjs scaffold phase-dir --phase N --name "phase name"
```

---

## Init Commands (Compound Context Loading)

Load all context needed for a specific workflow in one call. Returns JSON with project info, config, state, and workflow-specific data.

```bash
node wsf-tools.cjs init execute-phase <phase>
node wsf-tools.cjs init plan-phase <phase>
node wsf-tools.cjs init new-project
node wsf-tools.cjs init new-milestone
node wsf-tools.cjs init quick <description>
node wsf-tools.cjs init resume
node wsf-tools.cjs init verify-work <phase>
node wsf-tools.cjs init phase-op <phase>
node wsf-tools.cjs init todos [area]
node wsf-tools.cjs init milestone-op
node wsf-tools.cjs init map-codebase
node wsf-tools.cjs init progress
```

**Large payload handling:** When output exceeds ~50KB, the CLI writes to a temp file and returns `@file:/tmp/wsf-init-XXXXX.json`. Workflows check for the `@file:` prefix and read from disk:

```bash
INIT=$(node wsf-tools.cjs init execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

---

## Milestone Commands

```bash
# Archive milestone
node wsf-tools.cjs milestone complete <version> [--name <name>] [--archive-phases]

# Mark requirements as complete
node wsf-tools.cjs requirements mark-complete <ids>
# Accepts: REQ-01,REQ-02 or REQ-01 REQ-02 or [REQ-01, REQ-02]
```

---

## Utility Commands

```bash
# Convert text to URL-safe slug
node wsf-tools.cjs generate-slug "Some Text Here"
# → some-text-here

# Get timestamp
node wsf-tools.cjs current-timestamp [full|date|filename]

# Count and list pending todos
node wsf-tools.cjs list-todos [area]

# Check file/directory existence
node wsf-tools.cjs verify-path-exists <path>

# Aggregate all SUMMARY.md data
node wsf-tools.cjs history-digest

# Extract structured data from SUMMARY.md
node wsf-tools.cjs summary-extract <path> [--fields field1,field2]

# Project statistics
node wsf-tools.cjs stats [json|table]

# Progress rendering
node wsf-tools.cjs progress [json|table|bar]

# Complete a todo
node wsf-tools.cjs todo complete <filename>

# UAT audit — scan all phases for unresolved items
node wsf-tools.cjs audit-uat

# Git commit with config checks
node wsf-tools.cjs commit <message> [--files f1 f2] [--amend] [--no-verify]
```

> **`--no-verify`**: Skips pre-commit hooks. Used by parallel executor agents during wave-based execution to avoid build lock contention (e.g., cargo lock fights in Rust projects). The orchestrator runs hooks once after each wave completes. Do not use `--no-verify` during sequential execution — let hooks run normally.

# Web search (requires Brave API key)
node wsf-tools.cjs websearch <query> [--limit N] [--freshness day|week|month]
```

---

## Module Architecture

| Module | File | Exports |
|--------|------|---------|
| Core | `lib/core.cjs` | `error()`, `output()`, `parseArgs()`, shared utilities |
| State | `lib/state.cjs` | All `state` subcommands, `state-snapshot` |
| Phase | `lib/phase.cjs` | Phase CRUD, `find-phase`, `phase-plan-index`, `phases list` |
| Roadmap | `lib/roadmap.cjs` | Roadmap parsing, phase extraction, progress updates |
| Config | `lib/config.cjs` | Config read/write, section initialization |
| Verify | `lib/verify.cjs` | All verification and validation commands |
| Template | `lib/template.cjs` | Template selection and variable filling |
| Frontmatter | `lib/frontmatter.cjs` | YAML frontmatter CRUD |
| Init | `lib/init.cjs` | Compound context loading for all workflows |
| Milestone | `lib/milestone.cjs` | Milestone archival, requirements marking |
| Commands | `lib/commands.cjs` | Misc: slug, timestamp, todos, scaffold, stats, websearch |
| Model Profiles | `lib/model-profiles.cjs` | Profile resolution table |
| UAT | `lib/uat.cjs` | Cross-phase UAT/verification audit |
| Profile Output | `lib/profile-output.cjs` | Developer profile formatting |
| Profile Pipeline | `lib/profile-pipeline.cjs` | Session analysis pipeline |
