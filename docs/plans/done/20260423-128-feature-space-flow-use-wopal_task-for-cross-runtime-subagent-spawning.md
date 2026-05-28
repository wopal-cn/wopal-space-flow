# 128-feature-space-flow-use-wopal_task-for-cross-runtime-subagent-spawning

## Metadata

- **Issue**: #128
- **Type**: feature
- **Target Project**: space-flow
- **Created**: 2026-04-23
- **Status**: done

## Scope Assessment

- **Complexity**: Medium
- **Confidence**: High

## Goal

让 WSF workflows 在 OpenCode 环境中优先使用 `wopal_task` 进行子代理委派，同时保持对 Claude Code、Copilot 等其他 runtime 的兼容性 fallback。

## Technical Context

### 当前架构

WSF 假设 runtime 提供阻塞式 `Task()` 工具，子代理执行完成后直接返回结果。核心 workflow（execute-phase、manager、plan-phase）使用 `Task(subagent_type, prompt)` 调用，通过解析返回文本中的 marker（如 `## PLANNING COMPLETE`）判断完成。

### 问题

1. **OpenCode Task 工具不支持关键参数**：`isolation="worktree"`、`run_in_background` 在 OpenCode 中实际无效（`tool/task.ts` schema 仅含 `description/prompt/subagent_type/task_id/command`）
2. **wopal_task 是空间已有的更强大替代方案**：原生异步 + 双向通信 + 进度监控 + 完成检测（verdict + idle 事件）
3. **WSF 现有 runtime_compatibility 框架仅覆盖 Copilot**：需要扩展检测层级，将 wopal_task 作为第一优先级

### 解决方案

不修改 WSF 上游核心逻辑，仅在 `<runtime_compatibility>` 块中声明 wopal_task 优先级规则，并在能力检测逻辑中增加工具可用性判断。这遵循"能力检测而非名称检测"原则，保持 WSF 作为通用工具的独立性。

### 关键发现

| Task 调用模式 | wopal_task 对应 |
|--------------|-----------------|
| `Task(prompt)` 阻塞等待 | `wopal_task` 异步启动 + `wopal_task_output` 轮询 |
| 文本 marker 检测 | verdict 判断（idle 事件） |
| `isolation="worktree"`（无效参数） | 子代理内部用 bash 创建 worktree |
| Spot-check fallback | 保持不变（磁盘产物验证） |

## In Scope

- 修改核心 workflow 的 `<runtime_compatibility>` 块，声明 wopal_task 优先级
- 修改 map-codebase.md 的 `detect_runtime_capabilities` step，增加工具可用性检测层级
- 修改 manager.md 的 Task 调用，增加 wopal_task 条件分支
- 修改 execute-phase.md 的 initialize step，增加 wopal_task 检测逻辑
- 新建 reference 文档 `wsf/references/subagent-tool-adapter.md`
- 新建 reference 文档 `wsf/references/runtime-detection.md`

## Out of Scope

- 修改 WSF 上游的 wsf-tools.cjs（保持通用）
- 修改所有 152 处 Task 调用（仅改高频入口：execute-phase、manager、plan-phase、map-codebase）
- 修改 agent 定义文件（agent-contracts.md 已覆盖完成标记契约）
- 实现 wopal_task 的 worktree 自动创建（子代理内部处理）

## Affected Files

| Component | Files | Operation | Role |
|-----------|-------|-----------|------|
| workflows | `wsf/workflows/execute-phase.md` | 修改 | 增加 wopal_task 检测和调用分支 |
| workflows | `wsf/workflows/manager.md` | 修改 | Plan/Execute handlers 增加 wopal_task 条件 |
| workflows | `wsf/workflows/map-codebase.md` | 修改 | detect_runtime_capabilities 增加检测层级 |
| workflows | `wsf/workflows/plan-phase.md` | 修改 | planner Task 调用增加 wopal_task 条件 |
| workflows | `wsf/workflows/quick.md` | 修改 | executor Task 调用增加 wopal_task 条件 |
| references | `wsf/references/subagent-tool-adapter.md` | 新建 | 跨 runtime 子代理适配规范 |
| references | `wsf/references/runtime-detection.md` | 新建 | 工具可用性检测流程规范 |

## Implementation

### Task 1: 新建 runtime-detection.md reference 文档

**Files**: `projects/space-flow/wsf/references/runtime-detection.md`

**Changes**:

- [x] Step 1: 创建文件，定义工具可用性检测流程
- [x] Step 2: 定义检测优先级：wopal_task → Task → inline
- [x] Step 3: 定义检测方法：尝试调用工具或检查工具 schema
- [x] Step 4: 定义 fallback 链：wopal_task → Task() → sequential inline

**Verification**:

- [x] Step 1: 文件存在且格式正确
- [x] Step 2: 内容覆盖三种检测层级和 fallback 链

### Task 2: 新建 subagent-tool-adapter.md reference 文档

**Files**: `projects/space-flow/wsf/references/subagent-tool-adapter.md`

**Changes**:

- [x] Step 1: 创建文件，定义 Task 与 wopal_task 的参数映射
- [x] Step 2: 定义完成检测机制对应关系（marker vs verdict）
- [x] Step 3: 定义 wopal_task 轮询模式（wopal_task_output section=text）
- [x] Step 4: 定义错误处理和 timeout 策略

**Verification**:

- [x] Step 1: 文件存在且格式正确
- [x] Step 2: 参数映射表完整

### Task 3: 修改 map-codebase.md detect_runtime_capabilities

**Files**: `projects/space-flow/wsf/workflows/map-codebase.md`

**Changes**:

- [x] Step 1: 在 `<step name="detect_runtime_capabilities">` 中增加 wopal_task 检测
- [x] Step 2: 检测顺序改为：wopal_task → Task → inline
- [x] Step 3: 新增 `spawn_agents_wopal_task` step 和 `collect_confirmations_wopal_task` step
- [x] Step 4: 更新检测逻辑，增加路由判断

**Verification**:

- [x] Step 1: grep 确认新增 wopal_task 检测逻辑
- [x] Step 2: 文件格式无破坏

### Task 4: 修改 execute-phase.md runtime_compatibility 和 initialize

**Files**: `projects/space-flow/wsf/workflows/execute-phase.md`

**Changes**:

- [x] Step 1: 扩展 `<runtime_compatibility>` 块，增加 wopal_task 优先级声明
- [x] Step 2: 在 initialize step 增加 delegation capability detection
- [x] Step 3: 在 execute_waves step 的 spawn executor 部分增加条件分支
- [x] Step 4: 定义 wopal_task 轮询模式替代 Task 阻塞等待

**Verification**:

- [x] Step 1: grep 确认 `<runtime_compatibility>` 包含 wopal_task
- [x] Step 2: grep 确认 initialize 检测逻辑
- [x] Step 3: 文件格式无破坏

### Task 5: 修改 manager.md Task 调用

**Files**: `projects/space-flow/wsf/workflows/manager.md`

**Changes**:

- [x] Step 1: Plan Phase N handler 增加 wopal_task 条件分支
- [x] Step 2: Execute Phase N handler 增加 wopal_task 条件分支
- [x] Step 3: 定义 delegation mode detection 说明

**Verification**:

- [x] Step 1: grep 确认 Plan handler 有 wopal_task 分支
- [x] Step 2: grep 确认 Execute handler 有 wopal_task 分支
- [x] Step 3: 文件格式无破坏

### Task 6: 修改 plan-phase.md 和 quick.md

**Files**: `projects/space-flow/wsf/workflows/plan-phase.md`, `projects/space-flow/wsf/workflows/quick.md`

**Changes**:

- [x] Step 1: plan-phase.md 增加 runtime_compatibility 块和 required_reading 引用
- [x] Step 2: plan-phase.md researcher/planner Task 调用增加 delegation mode 注释
- [x] Step 3: quick.md 增加 runtime_compatibility 块
- [x] Step 4: quick.md researcher/checker/planner/executor Task 调用增加 delegation mode 注释

**Verification**:

- [x] Step 1: grep 确认两文件有 wopal_task 条件
- [x] Step 2: 文件格式无破坏

## Delegation Strategy

N/A — 文档修改类任务，Wopal 直接执行

## Test Plan

#### Unit Tests

N/A — 文档变更无单元测试

#### Integration Tests

##### Case I1: runtime-detection 检测流程验证
- Goal: 确认新 reference 文档描述的检测流程可被 workflow 正确引用
- Fixture: OpenCode 环境 + wopal_task 工具可用
- Execution:
  - [x] Step 1: grep execute-phase.md 确认引用 runtime-detection.md
  - [x] Step 2: 确认文件路径 `@~/.claude/wsf/references/runtime-detection.md` 正确
- Expected Evidence: grep 返回匹配行

#### E2E Tests

N/A — 文档变更无需端到端测试。wopal_task 实际行为需在真实 OpenCode 环境中通过 /wsf-execute-phase 验证（见 User Validation）。

#### Regression Tests

N/A — 本次变更仅新增条件分支和 reference 文档，未修改现有 Task() 调用逻辑。Task → inline fallback 链保持不变。

### Adjustment Strategy

如发现 OpenCode Task tool 实际支持某些参数（需验证），调整检测逻辑；如发现 wopal_task 在特定场景不稳定，降低优先级或增加 retry 逻辑。

## Acceptance Criteria

### Agent Verification

- [x] 所有修改文件格式正确（grep 验证关键内容）
- [x] runtime-detection.md 和 subagent-tool-adapter.md 创建完成
- [x] execute-phase、manager、map-codebase、plan-phase、quick 均有 wopal_task 条件
- [x] 无破坏现有 fallback 链（Task → inline 仍可用）

### User Validation

#### Scenario 1: execute-phase 使用 wopal_task
- Goal: 确认在 OpenCode 环境 execute-phase 自动选择 wopal_task
- Precondition: OpenCode 运行 + wopal_task 工具可用
- User Actions:
  1. 运行 `/wsf-execute-phase 1 space-flow`（或任意 phase）
  2. 观察 workflow 输出
- Expected Result: 看到使用 wopal_task 启动 executor agent，而非 Task()

- [x] 用户已完成上述功能验证并确认结果符合预期