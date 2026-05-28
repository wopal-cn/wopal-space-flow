# 130-enhance-wsf-add-missing-init-workflows-for-phase-operations

## Metadata

- **Issue**: #130
- **Type**: enhance
- **Target Project**: space-flow
- **Created**: 2026-04-23
- **Status**: done

## Scope Assessment

- **Complexity**: Low
- **Confidence**: High

## Goal

补充 5 个缺失的 init 命令实现，消除 workflow 文件与 CLI 之间的不一致，使 `init insert-phase`、`init add-phase`、`init complete-milestone`、`init remove-phase`、`init audit-uat` 全部可用。

## Technical Context

WSF CLI 的 `init` 命令族是一组 compound commands，负责工作流启动时的上下文预加载：参数解析、项目路径定位、配置读取、状态预检。当前 `wsf-tools.cjs` 的 `init` switch 支持 18 个 workflow，但有 5 个 workflow 文件调用了不存在的 init 子命令：

| Workflow 文件 | 调用 | CLI 支持 |
|---|---|---|
| `insert-phase.md:41` | `init insert-phase $ARGUMENTS` | ❌ |
| `add-phase.md:34` | `init add-phase $ARGUMENTS` | ❌ |
| `complete-milestone.md:45` | `init complete-milestone $ARGUMENTS` | ❌ |
| `remove-phase.md:35` | `init remove-phase $ARGUMENTS` | ❌ |
| `audit-fix.md:12` | `init audit-uat 2>/dev/null` | ❌ |

这些 workflow 的 `init_context` 步骤依赖 init 命令返回 `project_root`、`roadmap_exists` 等字段。缺失导致 agent 执行时直接报错 `Unknown init workflow`。

init 命令的职责边界是**参数解析 + 状态预检**，不执行实际业务逻辑。业务逻辑由后续的 atomic 命令（`phase insert`、`phase add` 等）完成。

## In Scope

- 在 `init.cjs` 中实现 5 个缺失的 `cmdInit*` 函数
- 在 `wsf-tools.cjs` 的 init switch 中注册 5 个 case
- 更新 init 命令的 usage 注释

## Out of Scope

- 不修改 workflow 文件的调用方式
- 不修改现有 18 个 init 命令的逻辑
- 不处理 `docs-init`（audit-fix workflow 中的另一处不一致，属于不同问题）

## Affected Files

| Component | Files | Operation | Role |
|-----------|-------|-----------|------|
| wsf-tools | `wsf/bin/lib/init.cjs` | 修改 | 添加 5 个 cmdInit 函数 + 导出 |
| wsf-tools | `wsf/bin/wsf-tools.cjs` | 修改 | 注册 5 个 init case |

## Implementation

### Task 1: 实现 5 个缺失的 init 命令

**Files**: `projects/space-flow/wsf/bin/lib/init.cjs`, `projects/space-flow/wsf/bin/wsf-tools.cjs`

**Changes**:

- [x] Step 1: 在 `init.cjs` 中添加 `cmdInitAddPhase(cwd, raw)` — 调用 `loadConfig`，检查 `roadmap_exists`，返回 `project_root` + `roadmap_exists` + `phase_description`（从 raw args 解析，跳过末尾可选项目名）
- [x] Step 2: 在 `init.cjs` 中添加 `cmdInitInsertPhase(cwd, raw)` — 解析 `after_phase`（args 首个参数）+ `description`（剩余参数，跳过末尾可选项目名），检查 `roadmap_exists`，返回 `project_root` + `roadmap_exists` + `after_phase` + `description`
- [x] Step 3: 在 `init.cjs` 中添加 `cmdInitRemovePhase(cwd, raw)` — 解析 `phase`（args 首个参数），检查 `roadmap_exists`，返回 `project_root` + `roadmap_exists` + `phase`
- [x] Step 4: 在 `init.cjs` 中添加 `cmdInitCompleteMilestone(cwd, raw)` — 调用 `getMilestoneInfo`，返回 `project_root` + `milestone_version` + `milestone_name` + `roadmap_exists` + `phase_dir_count`
- [x] Step 5: 在 `init.cjs` 中添加 `cmdInitAuditUat(cwd, raw)` — 返回 `project_root` + `roadmap_exists` + `phases`（从 roadmap 解析的阶段列表），作为 UAT 审计的上下文
- [x] Step 6: 在 `init.cjs` 的 module.exports 中添加 5 个新函数的导出
- [x] Step 7: 在 `wsf-tools.cjs` 的 init switch 中添加 5 个 case：`add-phase`、`insert-phase`、`remove-phase`、`complete-milestone`、`audit-uat`，参数传递参照 `phase-op` 的 `args[2]` 模式
- [x] Step 8: 更新 `wsf-tools.cjs` 顶部 Compound Commands 注释，列出新增的 init 子命令

**Verification**:

- [x] Step 1: 运行 `node projects/space-flow/wsf/bin/wsf-tools.cjs --cwd projects/gesp init add-phase` 确认不报错且返回 JSON 含 `project_root` 和 `roadmap_exists`
- [x] Step 2: 运行 `node projects/space-flow/wsf/bin/wsf-tools.cjs --cwd projects/gesp init insert-phase` 确认不报错
- [x] Step 3: 运行 `node projects/space-flow/wsf/bin/wsf-tools.cjs --cwd projects/gesp init remove-phase` 确认不报错
- [x] Step 4: 运行 `node projects/space-flow/wsf/bin/wsf-tools.cjs --cwd projects/gesp init complete-milestone` 确认不报错
- [x] Step 5: 运行 `node projects/space-flow/wsf/bin/wsf-tools.cjs --cwd projects/gesp init audit-uat` 确认不报错
- [x] Step 6: 运行 `npm test` 确认现有测试不受影响

## Delegation Strategy

N/A — 单一任务，无需并行委派

## Test Plan

#### Unit Tests

N/A — 新增函数均为参数解析 + 状态读取的组合调用，逻辑简单，通过集成测试覆盖

#### Integration Tests

##### Case I1: init 命令在 gesp 项目上全部可执行
- Goal: 确认 5 个新 init 命令在有 .planning/ 的项目上正常返回 JSON
- Fixture: `projects/gesp/` 目录（已有 .planning/ 结构）
- Execution:
  - [x] Step 1: 对 5 个新 init 子命令各执行一次 `node wsf-tools.cjs --cwd projects/gesp init <workflow>`
  - [x] Step 2: 确认每次返回均为合法 JSON，包含 `project_root` 字段，且无 `Unknown init workflow` 错误
- Expected Evidence: 5 次调用均返回 JSON，exit code 0

#### E2E Tests

N/A — init 命令是内部 CLI，无独立用户界面

#### Regression Tests

##### Case R1: 现有 init 命令不受影响
- Goal: 确认新增代码未破坏已有 18 个 init 命令
- Fixture: `projects/gesp/` 目录
- Execution:
  - [x] Step 1: 运行 `node projects/space-flow/wsf/bin/wsf-tools.cjs --cwd projects/gesp init phase-op 1`，确认返回 JSON 含 `phase_found`
  - [x] Step 2: 运行 `npm test`（在 space-flow 目录），确认全部测试通过
- Expected Evidence: init 输出正常，测试全部 PASS

### Adjustment Strategy

N/A — 单一任务，无复杂阻塞场景

## Acceptance Criteria

### Agent Verification

- [x] 5 个新 init 命令在 gesp 项目上全部返回合法 JSON（exit code 0）
- [x] `npm test` 全部通过
- [x] `wsf-tools.cjs` 顶部注释已更新

### User Validation

#### Scenario 1: insert-phase 命令不再报错
- Goal: 确认 `/wsf-insert-phase` 工作流能正常执行 init 步骤
- Precondition: gesp 项目已有 ROADMAP.md 且包含至少一个阶段
- User Actions:
  1. 执行 `/wsf-insert-phase 1 Fix critical bug gesp`
  2. 观察是否不再出现 `Unknown init workflow: insert-phase` 错误
- Expected Result: 命令正常执行 init 步骤，返回项目上下文 JSON，进入后续 phase insert 流程

- [x] 用户已完成上述功能验证并确认结果符合预期
