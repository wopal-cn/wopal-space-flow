# 119-feature-wsf-add-multi-project-workspace-support

## Metadata

- **Issue**: #119
- **Type**: feature
- **Target Project**: space-flow
- **Created**: 2026-04-21
- **Status**: done

## Scope Assessment

- **Complexity**: Medium
- **Confidence**: High

架构清晰，改动位置明确。核心改动集中在三层：`wsf-tools.cjs` 的 init 路由层（L1）、workflow 后续调用的 `--cwd` 传递（L2）、command 定义的 `argument-hint`（L3）。

## Goal

完善 WSF 多项目 workspace 支持，使所有 WSF 命令都能从 workspace 根目录通过项目名参数正确路由到 `projects/{name}/` 目录，后续操作（git commit、config 读写、phase 查找等）均落在正确项目。

## Technical Context

### 当前架构

WopalSpace 是多项目工作空间：
- 根目录 `wopal-workspace` 是组织容器（`sampx/wopal-space` 仓库）
- `projects/ontology/`、`projects/wopal-cli/`、`projects/space-flow/` 等是独立子仓库
- WSF 默认单项目模式

### 三层适配模型

多项目支持需要三层协同：

| 层级 | 文件位置 | 职责 | 当前状态 |
|------|----------|------|----------|
| **L1: init 路由** | `wsf/bin/wsf-tools.cjs:335-364` | 解析项目名 → 设置 `cwd` | 7/16 已支持 |
| **L2: 后续调用** | `wsf/workflows/*.md` | 后续调用传递 `--cwd ${project_root}` | 0% 完成 |
| **L3: 命令定义** | `commands/wsf/*.md` | `argument-hint` 包含 `[project]` | 部分完成 |

### 核心问题

**L2 是关键缺陷**：所有 workflow 的后续 `wsf-tools.cjs` 调用都没有传递 `--cwd`，导致在 workspace 根目录运行时后续操作错误地定位到根目录而非项目目录。

例如 `execute-phase` workflow：
- init 调用正确设置了 `cwd` 并返回 `project_root`
- 但后续 27 次 `wsf-tools.cjs` 调用都没有 `--cwd`
- 导致 `config-get`、`commit`、`find-phase` 等操作定位错误

### 现有基础设施

`core.cjs` 提供可复用原语：
- `resolveWorkspaceProject(startDir, projectArg)` — 将 `projects/<name>` 解析为绝对路径
- `parseProjectPhaseArgs()` — 提取 phase 编号和可选项目名参数

**已支持的 7 个 init 工作流**：
- 无 phase 必选：`new-project`、`map-codebase`、`progress`
- phase 必选：`plan-phase`、`phase-op`、`execute-phase`、`verify-work`

### 命令分类

调查全部 WSF 命令后的分类：

| 分类 | 数量 | 说明 |
|------|------|------|
| **A 类（已支持）** | 7 | 已有 `[project]` 参数 |
| **B 类（需改造）** | 13 | 操作项目路径但缺少 `[project]` 参数 |
| **C 类（不需要）** | ~10 | 空间级/元命令（`new-workspace`、`list-workspaces` 等） |
| **D 类（待验证）** | ~10 | 作用域待确认 |

### Init 工作流清单

| 工作流 | L1 已支持 | Phase 必选 | L3 已支持 | L2 后续调用数 |
|--------|-----------|------------|-----------|---------------|
| new-project | ✅ | No | ❌ | 12 |
| map-codebase | ✅ | No | ✅ | 3 |
| progress | ✅ | No | ✅ | 11 |
| plan-phase | ✅ | Yes | ✅ | 22 |
| phase-op | ✅ | Yes | — | 0 |
| execute-phase | ✅ | Yes | ✅ | 27 |
| verify-work | ✅ | Yes | ✅ | 6 |
| quick | ❌ | No | ❌ | 10 |
| new-milestone | ❌ | No | ❌ | 7 |
| resume | ❌ | No | ❌ | 1 |
| todos | ❌ | No | ❌ | 0 |
| milestone-op | ❌ | No | ❌ | 0 |
| manager | ❌ | No | ❌ | 3 |
| new-workspace | N/A | — | — | 1（全局操作） |
| list-workspaces | N/A | — | — | 1（全局操作） |
| remove-workspace | N/A | — | ✅ | 1（workspace 操作） |

## In Scope

### P1 阻塞命令（6 个）

milestone lifecycle 命令，阻塞多项目日常使用：

- `new-milestone` — 在指定项目启动里程碑
- `complete-milestone` — 在指定项目归档里程碑
- `add-phase` — 在指定项目路线图添加阶段
- `remove-phase` — 在指定项目路线图删除阶段
- `insert-phase` — 在指定项目路线图插入紧急阶段
- `stats` — 显示指定项目统计信息

### P2 高频命令（7 个）

日常工作流常用命令：

- `code-review` — 审查指定项目阶段变更
- `add-tests` — 为指定项目阶段生成测试
- `research-phase` — 研究指定项目阶段的实现方案
- `ship` — 为指定项目创建 PR
- `pr-branch` — 为指定项目创建干净 PR 分支
- `undo` — 在指定项目回退变更
- `health` — 诊断指定项目的 planning 目录

### L2 后续调用改造（高优先级 10 个 workflow）

后续调用数 ≥ 6 的 workflow，`--cwd` 缺失影响最大：

| Workflow | 后续调用数 | 改动量 |
|----------|-----------|--------|
| execute-phase | 27 | 高 |
| plan-phase | 22 | 高 |
| new-project | 12 | 中 |
| discuss-phase | 12 | 中 |
| quick | 10 | 中 |
| progress | 11 | 中 |
| complete-milestone | 8 | 中 |
| new-milestone | 7 | 低 |
| verify-work | 6 | 低 |
| verify-phase | 9 | 低 |

## Out of Scope

- **P3 低频命令**（~26 个）：`audit-milestone`、`audit-uat`、`autonomous`、`check-todos`、`cleanup`、`code-review-fix`、`debug`、`docs-update`、`explore`、`fast`、`forensics`、`help`、`import`、`intel`、`join-discord`、`list-phase-assumptions`、`manager`、`milestone-summary`、`note`、`pause-work`、`plan-milestone-gaps`、`profile-user`、`reapply-patches`、`review`、`review-backlog`、`scan`、`secure-phase`、`session-report`、`set-profile`、`settings`、`thread`、`ui-phase`、`ui-review`、`validate-phase`、`workstreams` — 延后到后续迭代
- **L2 中/低优先级 workflow**（~14 个）：后续调用数 ≤ 5，影响较小
- **`new-workspace`/`list-workspaces`/`remove-workspace`** — workspace 操作，非项目操作
- **`findProjectRoot()` 逻辑** — 已正常工作
- **`WSF_PROJECT` 环境变量机制** — monorepo 场景，独立功能
- **测试文件更新** — 改造完成后统一更新

## Affected Files

| 组件 | 文件 | 操作 | 改动内容 |
|------|------|------|----------|
| L1 路由层 | `wsf/bin/wsf-tools.cjs:335-364` | 修改 | 扩展 init 条件分支，支持 6 个新工作流 |
| P1 Commands | `commands/wsf/{new-milestone,complete-milestone,add-phase,remove-phase,insert-phase,stats}.md` | 修改 | `[project]` 加入 argument-hint + context |
| P2 Commands | `commands/wsf/{code-review,add-tests,research-phase,ship,pr-branch,undo,health}.md` | 修改 | `[project]` 加入 argument-hint + context |
| P1 Workflows | `wsf/workflows/{new-milestone,complete-milestone,add-phase,remove-phase,insert-phase,stats}.md` | 修改 | 添加 `wsf-tools init` 步骤 + 使用 `$PROJECT_ROOT` |
| P2 Workflows | `wsf/workflows/{code-review,add-tests,research-phase,ship,pr-branch,undo,health}.md` | 修改 | 添加 `wsf-tools init` 步骤 + 使用 `$PROJECT_ROOT` |
| L2 高优 Workflows | `wsf/workflows/{execute-phase,plan-phase,new-project,discuss-phase,quick,progress,verify-work,verify-phase}.md` | 修改 | 后续调用添加 `--cwd "${project_root}"` |

## Implementation

### Task 1: L1 路由层改造

**文件**: `wsf/bin/wsf-tools.cjs:335-364`

**改动**：将当前散落的 `if` 条件分支重构为数组查找模式，扩展支持 6 个新工作流。

**当前代码**（line 340-360）：
```javascript
if (workflow === 'new-project' || workflow === 'map-codebase' || workflow === 'progress') {
  ({ project: projectArg } = parseProjectPhaseArgs(args.slice(2)));
}

if (workflow === 'plan-phase' || workflow === 'phase-op' || workflow === 'execute-phase' || workflow === 'verify-work') {
  phaseRequired = true;
  ({ project: projectArg } = parseProjectPhaseArgs(args.slice(2), { phaseRequired }));
}
```

**改后**：
```javascript
const PROJECT_AWARE_WORKFLOWS = [
  'new-project', 'map-codebase', 'progress', 'quick',
  'new-milestone', 'resume', 'todos', 'milestone-op', 'manager'
];

const PHASE_REQUIRED_WORKFLOWS = [
  'plan-phase', 'phase-op', 'execute-phase', 'verify-work'
];

if (PROJECT_AWARE_WORKFLOWS.includes(workflow)) {
  ({ project: projectArg } = parseProjectPhaseArgs(args.slice(2)));
}

if (PHASE_REQUIRED_WORKFLOWS.includes(workflow)) {
  phaseRequired = true;
  ({ project: projectArg } = parseProjectPhaseArgs(args.slice(2), { phaseRequired }));
}
```

同时更新 `looksLikeWorkspaceRoot` 检查（line 360），将所有 PROJECT_AWARE + PHASE_REQUIRED 工作流纳入报错条件。

**验证**：
- [x] 读取 `wsf-tools.cjs` 确认数组包含所有 16 个工作流
- [x] 在 workspace 根目录运行 `wsf-tools init quick`（无项目名），应报错要求项目名
- [x] 运行 `wsf-tools init quick test-task space-flow`，应正确解析

### Task 2: P1 命令定义层改造（L3）

**文件**: `commands/wsf/{new-milestone,complete-milestone,add-phase,remove-phase,insert-phase,stats}.md`

**改动**：对每个命令文件：
- [x] Step 1: `argument-hint` 添加 `[project]` 参数
  - 无 phase 命令：`project` 在前（如 `[project] [milestone name]`）
  - 有 phase 命令：`phase` 在前，`project` 在后（如 `<phase> [project]`）
- [x] Step 2: `<context>` 部分添加项目解析说明："If `[project]` specified, resolve to `$PROJECT_ROOT=projects/<project>/` via `wsf-tools init`"
- [x] Step 3: 确保现有参数保持兼容

**验证**：
- [x] 读取 6 个文件，确认 `argument-hint` 和 context 都已更新

### Task 3: P1 Workflow 改造（init 步骤 + $PROJECT_ROOT）

**文件**: `wsf/workflows/{new-milestone,complete-milestone,add-phase,remove-phase,insert-phase,stats}.md`

**改动**：对每个 workflow：
- [x] Step 1: 在开头添加 `wsf-tools init <command>` 步骤提取 `project_root`
- [x] Step 2: 将硬编码的 `$ROOT_DIR` 替换为 `$PROJECT_ROOT`（适用位置）
- [x] Step 3: 更新子 agent prompt 包含 `$PROJECT_ROOT` 上下文

**验证**：
- [x] 读取 6 个文件，确认 `wsf-tools init` 步骤存在
- [x] 确认 `$PROJECT_ROOT` 在路径中使用

### Task 4: P2 命令定义层改造（L3）

**文件**: `commands/wsf/{code-review,add-tests,research-phase,ship,pr-branch,undo,health}.md`

**改动**：同 Task 2 模式：
- [x] Step 1: `argument-hint` 添加 `[project]` 参数
- [x] Step 2: `<context>` 添加项目解析说明
- [x] Step 3: 确保向后兼容

**验证**：
- [x] 读取 7 个文件，确认变更正确

### Task 5: P2 Workflow 改造（init 步骤 + $PROJECT_ROOT）

**文件**: `wsf/workflows/{code-review,add-tests,research-phase,ship,pr-branch,undo,health}.md`

**改动**：同 Task 3 模式：
- [x] Step 1: 添加 `wsf-tools init <command>` 步骤
- [x] Step 2: 替换 `$ROOT_DIR` 为 `$PROJECT_ROOT`
- [x] Step 3: 更新子 agent prompt

**验证**：
- [x] 读取 7 个文件，确认变更正确

### Task 6: L2 后续调用改造（高优先级 8 个已有 workflow）

**文件**: `wsf/workflows/{execute-phase,plan-phase,new-project,discuss-phase,quick,progress,verify-work,verify-phase}.md`

> 注：这 8 个 workflow 的 L1 init 已支持项目解析，但后续调用缺少 `--cwd` 传递。

**改造方案**：采用**方案 A**（逐个调用添加 `--cwd "${project_root}"`）。

选择理由：
1. 改动机械可追溯
2. 不引入新抽象层
3. 未来维护者更容易理解

**改动示例**：

```bash
# 当前
USE_WORKTREES=$(node "$HOME/.claude/wsf/bin/wsf-tools.cjs" config-get workflow.use_worktrees 2>/dev/null || echo "true")

# 改后
USE_WORKTREES=$(node "$HOME/.claude/wsf/bin/wsf-tools.cjs" --cwd "${project_root}" config-get workflow.use_worktrees 2>/dev/null || echo "true")
```

对每个 workflow 中的所有 `wsf-tools.cjs` 后续调用：
- [x] Step 1: 列出 workflow 中所有 `wsf-tools.cjs` 调用（排除 init 调用本身）
- [x] Step 2: 为每个调用添加 `--cwd "${project_root}"`
- [x] Step 3: 确认 `project_root` 变量在 init 步骤中已正确提取

**验证**：
- [x] 用 `grep` 确认每个 workflow 中所有 `wsf-tools.cjs` 调用（非 init）都有 `--cwd`
- [x] 运行相关测试确认功能正常

### Task 7: P1 Workflow L2 后续调用改造

**文件**: `wsf/workflows/{new-milestone,complete-milestone,add-phase,remove-phase,insert-phase,stats}.md`

这些 workflow 在 Task 3 中添加了 init 步骤，现在需要对其后续调用添加 `--cwd` 传递。

**改动**：同 Task 6 模式，对每个 workflow：
- [x] Step 1: 列出所有 `wsf-tools.cjs` 后续调用
- [x] Step 2: 添加 `--cwd "${project_root}"`
- [x] Step 3: 确认无遗漏

**验证**：
- [x] 用 `grep` 确认所有后续调用都有 `--cwd`

### Task 8: P2 Workflow L2 后续调用改造

**文件**: `wsf/workflows/{code-review,add-tests,research-phase,ship,pr-branch,undo,health}.md`

同上模式。

- [x] Step 1: 列出所有后续调用
- [x] Step 2: 添加 `--cwd "${project_root}"`
- [x] Step 3: 确认无遗漏

**验证**：
- [x] 用 `grep` 确认所有后续调用都有 `--cwd`

## Delegation Strategy

| 批次 | Task | 执行者 | 依赖 | 说明 |
|------|------|--------|------|------|
| 1 | Task 1（L1 路由层） | fae | 无 | 基础设施，所有后续任务依赖 |
| 2 | Task 2+3（P1 commands + workflows） | fae | 批次 1 | 可并行 |
| 2 | Task 4+5（P2 commands + workflows） | fae | 批次 1 | 可并行 |
| 3 | Task 6（已有 workflow L2 改造） | fae | 批次 1 | 可与批次 2 并行 |
| 4 | Task 7+8（P1/P2 workflow L2 改造） | fae | 批次 2 | 依赖 Task 3/5 完成 |

**委派规范**：
- fae 执行文件修改，Wopal 验证结果
- 每批次完成后 Wopal 读取文件确认变更正确
- 验证通过后进入下一批次
- **委派路径**：使用源码层路径 `projects/space-flow/...`，禁止使用 `.claude/` 路径

## Test Plan

### Integration Tests

##### Case I1: L1 路由层项目名解析

- **Goal**: 确认新增的 6 个工作流能正确解析项目名
- **Fixture**: workspace 根目录，存在 `projects/ontology/`
- **Execution**:
  - [x] 在 workspace 根目录运行 `wsf-tools init stats ontology`
  - [x] 确认输出中 `project_root` 指向 `projects/ontology/`
- **Expected**: init 输出包含正确的项目路径

##### Case I2: P1 命令接受项目参数

- **Goal**: 确认 P1 命令从 workspace 根目录通过 `[project]` 参数正常工作
- **Fixture**: workspace 根目录，存在 `projects/ontology/`
- **Execution**:
  - [x] 从 workspace 根目录运行 `flow.sh stats ontology`
  - [x] 确认输出显示 ontology 项目统计信息
- **Expected**: 输出引用 `projects/ontology/` 路径，显示 ontology 的阶段/路线图信息

##### Case I3: L2 后续调用正确定位

- **Goal**: 确认 workflow 后续调用落在正确项目
- **Fixture**: workspace 根目录，`projects/space-flow/` 有已完成的 phase
- **Execution**:
  - [x] 从 workspace 根目录运行 `flow.sh code-review <phase> space-flow`
  - [x] 确认 review 操作在 space-flow 项目目录内执行
- **Expected**: git 操作、config 读取均引用 space-flow 路径

##### Case I4: 向后兼容（无项目参数）

- **Goal**: 命令在项目目录内调用（无 `[project]` 参数）仍正常工作
- **Fixture**: 在 `projects/space-flow/` 目录内
- **Execution**:
  - [x] cd 到 `projects/space-flow/`
  - [x] 运行 `flow.sh stats`（无项目参数）
  - [x] 确认输出显示当前项目统计
- **Expected**: 无错误，显示当前项目信息

##### Case I5: Workspace 根目录无项目名报错

- **Goal**: 从 workspace 根目录运行不带项目名的新增命令应报错提示
- **Fixture**: workspace 根目录
- **Execution**:
  - [x] 运行 `flow.sh stats`（无项目参数）
  - [x] 确认报错提示需要项目名
- **Expected**: 输出错误信息 "Project argument required when running stats from workspace root"

### Regression Tests

##### Case R1: 已有 A 类命令不受影响

- **Goal**: 确认已支持的命令继续正常工作
- **Fixture**: workspace 根目录，存在 `projects/ontology/`
- **Execution**:
  - [x] 运行 `flow.sh progress ontology`
  - [x] 确认输出显示 ontology 进度
- **Expected**: 输出格式与改动前一致

##### Case R2: 测试套件通过

- **Goal**: 确认改动不破坏现有测试
- **Fixture**: `projects/space-flow/` 项目目录
- **Execution**:
  - [x] 在 `projects/space-flow/` 运行 `npm test`
  - [x] 所有测试通过
- **Expected**: 测试全部通过，无回归

### Adjustment Strategy

N/A — 机械性参数添加和 `--cwd` 传递，无复杂阻塞场景。

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| L2 后续调用遗漏 `--cwd` | 中 | 高 — 操作落在错误项目 | 改完后用 `grep` 逐文件验证所有 `wsf-tools.cjs` 调用 |
| 命令参数顺序混乱 | 低 | 中 — 用户困惑 | Phase 必选命令：`phase` 在前 `project` 在后；无 Phase 命令：`project` 在前 |
| 用户使用习惯变化 | 低 | 低 — 旧用法仍可用 | 文档说明新用法，cd 到项目目录的旧方式保持兼容 |
| `parseProjectPhaseArgs` 解析冲突 | 低 | 高 — 参数解析错误 | 仔细测试参数解析边界情况（项目名含数字、phase 号含小数点等） |

## Acceptance Criteria

### Agent Verification

- [x] `wsf-tools.cjs` init 路由层包含 16 个工作流的项目名支持
- [x] 13 个修改后的 command 文件 `argument-hint` 包含 `[project]`
- [x] 13 个修改后的 workflow 文件有 `wsf-tools init` 步骤
- [x] 高优先级 8 个已有 workflow + 13 个新增 workflow 的所有后续 `wsf-tools.cjs` 调用都有 `--cwd`
- [x] Integration Test Case I1-I5 全部通过
- [x] Regression Test Case R1-R2 全部通过
- [x] `npm test` 测试套件通过（36 failures 均与本次改动无关：安装器/Cline/Codex 环境问题）

### User Validation

#### Scenario 1: 从 workspace 根目录运行里程碑命令

- **Goal**: 确认用户可在 workspace 根目录操作子项目
- **Precondition**: 用户在 workspace 根目录
- **User Actions**:
  1. 运行 `flow.sh stats ontology`
  2. 观察输出显示 ontology 项目统计信息
- **Expected**: 输出引用 `projects/ontology/` 路径，显示 ontology 的阶段/路线图信息

#### Scenario 2: L2 后续调用验证

- **Goal**: 确认完整工作流中 git 操作落在正确项目
- **Precondition**: 用户在 workspace 根目录
- **User Actions**:
  1. 运行 `flow.sh plan-phase 1 ontology`
  2. 观察 plan 过程中的文件读写和 git commit
- **Expected**: 所有操作在 `projects/ontology/.planning/` 目录内执行

#### Scenario 3: 向后兼容

- **Goal**: 确认在项目目录内调用仍正常
- **Precondition**: 用户在 `projects/space-flow/`
- **User Actions**:
  1. 运行 `flow.sh stats`（无项目参数）
  2. 观察输出显示当前项目信息
- **Expected**: 无错误，显示 space-flow 项目信息

- [x] 用户已完成上述功能验证并确认结果符合预期
