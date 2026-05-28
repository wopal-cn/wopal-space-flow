# 127-fix-wsf-plan-phase-add-plan-filename-validation-after-planner-output

## Metadata

- **Issue**: #127
- **Type**: fix
- **Target Project**: space-flow
- **Created**: 2026-04-24
- **Status**: done

## Scope Assessment

- **Complexity**: Low
- **Confidence**: High

## Goal

修复 wsf-planner 提示词中变量名不一致导致的计划文件命名错误，防止 execute-phase 因找不到计划文件而无法启动。

## Technical Context

**根因分析**：

`wsf-planner.md` 内部混用 `{phase}` 和 `{padded_phase}` 两套变量名，导致 planner agent 无法确定正确的文件命名格式。

**矛盾链**：

1. `load_project_state` step（第 901 行）告诉 planner 从 init JSON 提取 `phase_number`，**未列出 `padded_phase`**
2. `write_phase_prompt` step（第 1112 行）要求用 `{padded_phase}` 构造文件名，并说"received from the orchestrator"
3. 但 orchestrator prompt（plan-phase.md 第 615 行）只传了 `**Phase:** {phase_number}`
4. planner **拿不到 `padded_phase`**，只能用 `phase_number`（如 `1`）去构造文件名
5. 结果可能产出 `1-01-PLAN.md` 而非 `01-01-PLAN.md`

**具体不一致位置**（wsf-planner.md）：

| 行号 | 当前变量 | 上下文 |
|------|---------|--------|
| 901 | `phase_number`（extract 列表缺 `padded_phase`） | load_project_state step |
| 527 | `{phase}` | plan_format 模板中 SUMMARY 路径 |
| 1179-1180 | `{phase}` | update_roadmap step 中 plan 列表 |
| 1188 | `$PHASE` | git_commit step 中 commit 命令 |
| 1219-1220 | `{phase}` | structured_returns 中 plan 表格 |

**设计原则**：
- 在源头修复（planner 提示词），而非加下游校验
- 保持所有现有流程和逻辑不变，只统一变量名
- `padded_phase` 概念保留（文件排序需要），但确保 planner 能正确获取和使用

## In Scope

- `agents/wsf-planner.md` 修复变量名不一致
- `wsf/workflows/plan-phase.md` step 8 planner prompt 中显式传递 `padded_phase`

## Out of Scope

- `wsf-tools.cjs` 或 `phase.cjs` 的修改（发现逻辑无问题）
- `execute-phase.md` 或其他 workflow 的修改
- step 9a 文件名校验作为安全网（优先级降低，不在本次修复范围）

## Affected Files

| Component | Files | Operation | Role |
|-----------|-------|-----------|------|
| agent | `agents/wsf-planner.md` | 修改 | 统一变量名，确保 padded_phase 可用 |
| workflow | `wsf/workflows/plan-phase.md` | 修改 | step 8 planner prompt 传递 padded_phase |

## Implementation

### Task 1: 修复 wsf-planner.md 变量名不一致

**Files**: `agents/wsf-planner.md`

**Changes**:

- [x] Step 1: 第 901 行 `load_project_state` step — 在 extract 字段列表中加入 `padded_phase` 和 `phase_slug`：
  - 当前：`Extract from init JSON: planner_model, researcher_model, checker_model, commit_docs, research_enabled, phase_dir, phase_number, has_research, has_context.`
  - 改为：`Extract from init JSON: planner_model, researcher_model, checker_model, commit_docs, research_enabled, phase_dir, phase_number, padded_phase, phase_slug, has_research, has_context.`

- [x] Step 2: 第 527 行 plan_format 模板 — 将 `{phase}` 改为 `{padded_phase}`：
  - 当前：`After completion, create .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md`
  - 改为：`After completion, create .planning/phases/XX-name/{padded_phase}-{plan}-SUMMARY.md`

- [x] Step 3: 第 1179-1180 行 update_roadmap step — 将 `{phase}` 改为 `{padded_phase}`：
  - 当前：
    ```
    - [ ] {phase}-01-PLAN.md — {brief objective}
    - [ ] {phase}-02-PLAN.md — {brief objective}
    ```
  - 改为：
    ```
    - [ ] {padded_phase}-01-PLAN.md — {brief objective}
    - [ ] {padded_phase}-02-PLAN.md — {brief objective}
    ```

- [x] Step 4: 第 1188 行 git_commit step — 将 `$PHASE` 改为 `$PADDED_PHASE`：
  - 当前：`node "$HOME/.claude/wsf/bin/wsf-tools.cjs" commit "docs($PHASE): create phase plan" --files .planning/phases/$PHASE-*/$PHASE-*-PLAN.md .planning/ROADMAP.md`
  - 改为：`node "$HOME/.claude/wsf/bin/wsf-tools.cjs" commit "docs($PADDED_PHASE): create phase plan" --files .planning/phases/$PADDED_PHASE-*/$PADDED_PHASE-*-PLAN.md .planning/ROADMAP.md`

- [x] Step 5: 第 1219-1220 行 structured_returns — 将 `{phase}` 改为 `{padded_phase}`：
  - 当前：
    ```
    | {phase}-01 | [brief] | 2 | [files] |
    | {phase}-02 | [brief] | 3 | [files] |
    ```
  - 改为：
    ```
    | {padded_phase}-01 | [brief] | 2 | [files] |
    | {padded_phase}-02 | [brief] | 3 | [files] |
    ```

- [x] Step 6: 第 1241 行 gap closure structured_returns — 同样将 `{phase}` 改为 `{padded_phase}`

- [x] Step 7: 第 862-866 行 TDD commit message — 将 `{phase}-{plan}` 改为 `{padded_phase}-{plan}`

**Verification**:

- [x] Step 1: `grep -n '{phase}' agents/wsf-planner.md` 确认不再存在未 padded 的 `{phase}` 文件名/路径用法（排除纯文本描述如 "Phase {N}"）
- [x] Step 2: `grep -n 'padded_phase' agents/wsf-planner.md` 确认所有文件名相关位置统一使用 `{padded_phase}`
- [x] Step 3: 确认 `load_project_state` extract 列表包含 `padded_phase`

### Task 2: plan-phase.md step 8 planner prompt 传递 padded_phase

**Files**: `wsf/workflows/plan-phase.md`

**Changes**:

- [x] Step 1: 在 step 8 planner prompt（第 614-642 行）中补充 padded_phase 上下文：
  - 当前（第 615 行）：`**Phase:** {phase_number}`
  - 改为：
    ```
    **Phase:** {phase_number}
    **Padded Phase:** {padded_phase}
    **Phase Directory:** {phase_dir}
    ```

**Verification**:

- [x] Step 1: grep 确认 planner prompt 模板中包含 `Padded Phase` 和 `Phase Directory`

## Delegation Strategy

N/A — 两个小改动，Complexity=Low，无需并行委派

## Test Plan

#### Unit Tests

N/A — 提示词修改是 markdown 文档，无自动化单元测试。

#### Integration Tests

##### Case I1: planner 提示词变量一致性

- Goal: 确认 wsf-planner.md 中所有文件名相关位置统一使用 `{padded_phase}`
- Fixture: `agents/wsf-planner.md` 源文件
- Execution:
  - [x] Step 1: `grep -n '{phase}.*PLAN\|{phase}.*SUMMARY\|{phase}.*commit\|{phase}-0' agents/wsf-planner.md` 确认无匹配
  - [x] Step 2: `grep -n 'padded_phase.*PLAN\|padded_phase.*SUMMARY' agents/wsf-planner.md` 确认有匹配
- Expected Evidence: 文件名相关位置全部使用 `{padded_phase}`

##### Case I2: plan-phase.md 传递了 padded_phase

- Goal: 确认 orchestrator prompt 传递了 padded_phase 给 planner
- Fixture: `wsf/workflows/plan-phase.md` 源文件
- Execution:
  - [x] Step 1: grep 确认 step 8 planner prompt 包含 `Padded Phase`
- Expected Evidence: planner 能从 prompt 中获取 padded_phase 值

#### Regression Tests

##### Case R1: planner init JSON 包含 padded_phase

- Goal: 确认 init plan-phase 输出包含 padded_phase 字段
- Fixture: `wsf/bin/lib/init.cjs` 源文件（只读，不修改）
- Execution:
  - [x] Step 1: 确认 init.cjs 第 226 行 `padded_phase` 字段未被修改
- Expected Evidence: `init` 命令仍输出 `padded_phase` 字段

### Adjustment Strategy

N/A — 纯文本替换，无复杂逻辑。若发现其他 `{phase}` 用法需要保留（如纯文本描述），在实施中逐个判断。

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| 遗漏某些 `{phase}` 用法本应保留（如"Phase {N}"描述性文本） | Low | Low | 实施时逐个确认，只改文件名/路径/commit 中的 `{phase}` |
| planner 已有的 frontmatter `phase: XX-name` 字段含义不同 | None | None | `phase` frontmatter 字段是 phase slug（如 `01-foundation`），不受本次修改影响 |

## Acceptance Criteria

### Agent Verification

- [x] `wsf-planner.md` 的 `load_project_state` extract 列表包含 `padded_phase`
- [x] `wsf-planner.md` 中所有文件名/路径/commit 相关位置统一使用 `{padded_phase}`
- [x] `plan-phase.md` step 8 planner prompt 包含 `Padded Phase` 和 `Phase Directory`
- [x] grep 确认无遗漏的文件名相关 `{phase}` 用法
- [x] 现有代码逻辑（phase.cjs、init.cjs）无变更

### User Validation

#### Scenario 1: planner 产出正确命名的计划文件

- Goal: 确认 plan-phase 完成后，计划文件命名格式正确
- Precondition: 对任意 phase 运行 `/wsf-plan-phase`
- User Actions:
  1. 运行 `/wsf-plan-phase 1` 完成规划
  2. 检查 `.planning/phases/01-xxx/` 下文件名格式为 `01-01-PLAN.md`、`01-02-PLAN.md`
  3. 运行 `/wsf-execute-phase 1`，确认能发现计划文件并启动执行
- Expected Result: 文件名正确 padded，execute-phase 正常启动

- [x] 用户已完成上述功能验证并确认结果符合预期
