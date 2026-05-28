# GSD (Get Shit Done) — 完整使用指南

> **日期**: 2026-04-09

---

## 1. 架构概览

GSD 是 meta-prompting 驱动的多 Agent 编排系统，将 OpenCode 从无状态问答机器变成结构化的项目交付管线。

```
68 命令 | 24 Agent | 55 工作流 | gsd-tools.cjs (80+ 子命令)
```

### 1.1 安装产物

安装后 `.opencode/` 下的结构：

```
.opencode/
  command/gsd-*.md           # 68 个用户命令
  agents/gsd-*.md            # 24 个专用 Agent
  get-shit-done/             # 工作流引擎
    workflows/*.md           # ~55 个工作流逻辑文件
    templates/*.md           # ~35 个文档模板
    references/*.md          # ~37 个参考文档
    contexts/*.md            # 执行上下文 profile
    bin/gsd-tools.cjs        # CLI 工具（80+ 子命令）
    bin/lib/*.cjs            # 模块化库
  hooks/                     # 9 个 hooks（OpenCode 不执行，仅存在）
  opencode.json              # 权限配置
```

### 1.2 规划目录结构

所有制品存放在 `.planning/` 下：

```
.planning/
  config.json                # 项目配置
  PROJECT.md                 # 项目上下文（随阶段演进）
  ROADMAP.md                 # 阶段计划 + 进度表
  STATE.md                   # 短期记忆（<150 行）
  REQUIREMENTS.md            # 可追溯的需求列表
  phases/
    {N}-{slug}/              # 每个阶段的制品
      {N}-CONTEXT.md         # 用户决策（discuss 产出）
      {N}-RESEARCH.md        # 技术研究
      {N}-VALIDATION.md      # Nyquist 验证策略
      {N}-PLAN.md            # 执行计划（XML 格式）
      {N}-SUMMARY.md         # 执行结果
      {N}-UAT.md             # UAT 验收状态
  milestones/                # 已归档里程碑
  quick/                     # 快速任务
  research/                  # 项目级研究
  intel/                     # 代码库情报
  codebase/                  # 代码库分析
  debug/                     # 调试会话
  threads/                   # 持久化上下文线程
```

---

## 2. 核心工作流

### 2.1 完整生命周期

```
/gsd-new-project        初始化：提问 → 研究 → 需求 → 路线图
        │
        ▼
┌─── Phase 循环 ───────────────────────────────┐
│                                               │
│  /gsd-discuss-phase N    收集阶段决策          │
│         │                                     │
│         ▼                                     │
│  /gsd-plan-phase N      研究 → 规划 → 验证    │
│         │                                     │
│         ▼                                     │
│  /gsd-execute-phase N   Wave 并行执行         │
│         │                                     │
│         ▼                                     │
│  /gsd-verify-work N     UAT 验收              │
│         │                                     │
│         ▼                                     │
│  [自动进入下一阶段]                            │
│                                               │
└───────────────────────────────────────────────┘
        │
        ▼
/gsd-complete-milestone  归档里程碑
```

### 2.2 阶段 1：`/gsd-new-project` — 项目初始化

**做什么**：交互式提问 → 可选领域研究 → 需求提取 → 路线图生成

**Agent 调用链**：
```
gsd-project-researcher (x4 并行: STACK / FEATURES / ARCHITECTURE / PITFALLS)
  → gsd-research-synthesizer (综合 4 份研究报告)
    → gsd-roadmapper (生成路线图)
```

**产出**：`.planning/` 完整初始化（PROJECT.md、ROADMAP.md、STATE.md、REQUIREMENTS.md、config.json、AGENTS.md）

**参数**：

| 参数 | 作用 |
|------|------|
| `--auto` | 跳过交互，从 @ 引用的文档读取需求 |

**交互流程**：
1. 询问项目描述和核心价值
2. 可选：领域研究（4 个并行 Agent 调查技术栈）
3. 提取需求（带 ID，可追溯）
4. 生成路线图（阶段划分 + 成功标准）
5. 创建 config.json（交互式 5 问题配置）

### 2.3 阶段 2：`/gsd-discuss-phase N` — 决策捕获

**做什么**：加载前置上下文 → 识别灰区 → 逐个讨论 → 输出 CONTEXT.md

**关键概念 — 灰区（Gray Area）**：GSD 自动分析哪些技术决策尚未确定，让你选择讨论哪些，其余使用推荐默认值。

**参数**：

| 参数 | 作用 |
|------|------|
| `--auto` | 自动选择推荐默认值，跳过交互 |
| `--chain` | 讨论完自动进入 plan + execute |
| `--power` | 批量导出问题到文件（适合离线思考） |
| `--batch` | 批量处理模式 |
| `--text` | 纯文本模式（适合远程会话） |

**CONTEXT.md 结构**：

```markdown
## Domain (边界)
项目范围和约束

## Decisions (锁定的选择)
D-01: [决策内容] → [选择] — 因为 [理由]

## Canonical References (必须参考)
执行阶段必须阅读的文件列表

## Code Context
代码库中与决策相关的现有模式

## Specifics
特定实现细节

## Deferred (推迟的决策)
留待后续阶段处理的事项
```

**可选替代**：`/gsd-list-phase-assumptions N` — 先展示 Agent 的假设，再讨论。适合对代码库已有了解的场景。

### 2.4 阶段 3：`/gsd-plan-phase N` — 规划

**做什么**：技术研究 → 生成执行计划 → 验证计划 → 修订循环（最多 3 轮）

**Agent 调用链**：
```
gsd-phase-researcher (技术研究，产出 RESEARCH.md)
  → gsd-planner (生成 PLAN.md)
    → gsd-plan-checker (目标逆向验证)
      → [修订循环: planner → checker，最多 3 轮]
```

**参数**：

| 参数 | 作用 |
|------|------|
| `--skip-research` | 跳过研究直接规划 |
| `--research` | 强制重新研究 |
| `--skip-verify` | 跳过 plan-checker 验证循环 |
| `--prd <file>` | 用外部 PRD 替代 discuss 阶段 |
| `--reviews` | 纳入跨 AI 审查反馈（需先跑 `/gsd-review`） |
| `--text` | 纯文本编号列表（非 XML 格式） |

**PLAN.md 核心结构（XML 格式）**：

```yaml
---
phase: 03-features
plan: 01
wave: 1                # 预计算的执行波次
depends_on: []         # 依赖的 plan ID
files_modified: []     # 本计划修改的文件
autonomous: true       # false = 含人工检查点
requirements: [REQ-01] # 关联需求 ID
user_setup: []         # 需要人类操作的外部服务
must_haves:
  truths: []           # 可观察的行为（目标达成的证据）
  artifacts: []        # 必须存在的文件
  key_links: []        # 关键连接关系
---

<objective>本计划要达成什么</objective>

<tasks>
  <task type="auto">
    <name>Task 1: 具体操作</name>
    <files>path/to/file.ext</files>
    <read_first>执行前必须阅读的参考文件</read_first>
    <action>具体实现步骤（含确切值）</action>
    <verify>验证命令</verify>
    <acceptance_criteria>Grep 可验证的条件</acceptance_criteria>
    <done>可衡量的完成标准</done>
  </task>

  <task type="checkpoint:human-verify" gate="blocking">
    <name>Checkpoint: 人工确认</name>
    <action>需要人类检查的内容</action>
  </task>

  <task type="checkpoint:decision" gate="blocking">
    <name>Checkpoint: 决策选择</name>
    <options>
      <option>A: 选项描述</option>
      <option>B: 选项描述</option>
    </options>
  </task>
</tasks>
```

**Task 类型**：

| 类型 | 行为 |
|------|------|
| `auto` | 全自主执行 |
| `checkpoint:human-verify` | 暂停，人工确认后继续 |
| `checkpoint:decision` | 暂停，人类选择后继续 |
| `checkpoint:human-action` | 暂停，人类执行一个操作后继续 |

**Wave 系统**：Wave 在规划时预计算（不是运行时分析），写入 PLAN.md frontmatter。同 Wave、无文件冲突的 plan 并行执行。

### 2.5 阶段 4：`/gsd-execute-phase N` — 执行

**做什么**：发现计划 → 分析依赖 → 分组为 Wave → 并行/顺序执行

**三种执行模式**：

| 模式 | 条件 | 行为 |
|------|------|------|
| A（自主） | `autonomous: true` | 单 subagent 全权执行，含 SUMMARY + commit |
| B（分段） | 含 checkpoint | 段间暂停，人工确认后 spawn 新 subagent 继续 |
| C（主上下文） | `--interactive` | 全部在主会话中顺序执行，无 subagent |

**偏差处理规则**：

| 规则 | 条件 | 处理 |
|------|------|------|
| Rule 1: Bug | 发现明显 bug | 自动修复，继续执行 |
| Rule 2: Missing Critical | 缺少关键功能 | 自动补充，继续执行 |
| Rule 3: Blocking | 遇到阻塞 | 记录并上报，继续执行其他任务 |
| Rule 4: Architectural | 架构级问题 | **停止执行**，等待人类决策 |

**参数**：

| 参数 | 作用 |
|------|------|
| `--wave N` | 只执行第 N 波 |
| `--gaps-only` | 只执行修复计划（gap_closure: true） |
| `--interactive` | 顺序内联执行（无 subagent） |

**提交协议**：每个 Task 独立原子提交，格式 `{type}({phase}-{plan}): {description}`

**产出**：`{N}-{plan}-SUMMARY.md`、更新 STATE.md / ROADMAP.md / REQUIREMENTS.md

### 2.6 阶段 5：`/gsd-verify-work N` — UAT 验收

**做什么**：逐条呈现测试 → 用户 pass/fail → 发现问题自动诊断 → 生成修复计划

**关键特性**：
- UAT 状态持久化（跨 `/clear` 存活）
- 从自然语言推断严重程度（不额外询问）
- 发现问题时自动 spawn debug agent 诊断根因
- 诊断后自动 spawn planner 创建修复计划
- 修复计划可通过 `/gsd-execute-phase N --gaps-only` 执行

**产出**：`{N}-UAT.md`

---

## 3. 快捷命令

### 3.1 轻量任务

| 命令 | 场景 | 开销 |
|------|------|------|
| `/gsd-fast "描述"` | 微任务（改 typo、小重构、忘提交） | 零 — 直接在当前上下文执行 |
| `/gsd-quick "描述"` | 小任务（加功能、改配置、小修复） | 低 — 有 PLAN.md + 原子提交 + STATE 追踪 |
| `/gsd-do "想做什么"` | 不知道用哪个命令 | 路由 — 分析意图后分发到合适命令 |

**`/gsd-quick` 参数**（可组合）：

| 参数 | 作用 |
|------|------|
| `--full` | 完整管线（discuss + research + plan-check + verify） |
| `--validate` | Plan-checking + 执行后验证 |
| `--discuss` | 轻量讨论阶段 |
| `--research` | 聚焦研究 |
| `--discuss --research --validate` | 等同 `--full` |

### 3.2 智能导航

| 命令 | 作用 |
|------|------|
| `/gsd-next` | 自动检测 STATE.md 状态，执行下一个逻辑步骤 |
| `/gsd-progress` | 总结已完成工作和接下来要做的，智能路由 |
| `/gsd-resume-work` | 恢复上次会话（检测 .continue-here.md 和未完成的 PLAN） |
| `/gsd-pause-work` | 创建会话交接点（.continue-here.md + WIP commit） |

### 3.3 自主模式

| 命令 | 作用 |
|------|------|
| `/gsd-autonomous` | 自动执行所有剩余阶段（discuss → plan → execute） |
| `/gsd-manager` | 交互式多阶段指挥中心（Dashboard + 推荐 + 后台调度） |

**`/gsd-autonomous` 参数**：

| 参数 | 作用 |
|------|------|
| `--from N` | 从阶段 N 开始 |
| `--to N` | 执行到阶段 N 停止 |
| `--only N` | 只执行阶段 N |
| `--interactive` | 讨论内联执行，plan/execute 后台调度 |

---

## 4. 研究与情报

| 命令 | 作用 | Agent |
|------|------|-------|
| `/gsd-map-codebase` | 4 并行 Agent 全量分析（tech/arch/quality/concerns） | gsd-codebase-mapper x4 |
| `/gsd-scan --focus <area>` | 轻量版，只分析一个维度 | gsd-codebase-mapper x1 |
| `/gsd-intel query <term>` | 代码库情报查询 | gsd-intel-updater |
| `/gsd-intel status` | 情报文件新鲜度检查 | — |
| `/gsd-intel refresh` | 重建情报索引 | gsd-intel-updater |
| `/gsd-explore [topic]` | 苏格拉底式头脑风暴 | — |
| `/gsd-research-phase N` | 独立阶段研究（不生成计划） | gsd-phase-researcher |
| `/gsd-list-phase-assumptions N` | 展示 Agent 对阶段的假设 | gsd-assumptions-analyzer |

**`/gsd-map-codebase` 产出**（`.planning/codebase/`）：

| Agent | 产出 |
|-------|------|
| tech | STACK.md + INTEGRATIONS.md |
| arch | ARCHITECTURE.md + STRUCTURE.md |
| quality | CONVENTIONS.md + TESTING.md |
| concerns | CONCERNS.md |

---

## 5. 质量管线

### 5.1 代码审查

| 命令 | 作用 | 参数 |
|------|------|------|
| `/gsd-code-review N` | 阶段代码审查 | `--depth=quick\|standard\|deep` |
| `/gsd-code-review-fix N` | 自动修复审查发现 | `--auto`（修复+重审循环，最多 3 轮） |
| `/gsd-review --phase N` | 跨 AI 同行审查 | `--gemini`, `--claude`, `--all` |

**审查深度**：

| 深度 | 行为 |
|------|------|
| quick | 模式匹配，快速扫描 |
| standard | 逐文件分析 |
| deep | 跨文件关联分析 |

### 5.2 专项审计

| 命令 | 作用 | Agent |
|------|------|-------|
| `/gsd-secure-phase N` | 安全威胁验证 | gsd-security-auditor |
| `/gsd-validate-phase N` | Nyquist 验证覆盖率审计 | gsd-nyquist-auditor |
| `/gsd-ui-review N` | 6 维视觉审计（前端） | gsd-ui-auditor |
| `/gsd-ui-phase N` | 生成 UI 设计契约 | gsd-ui-researcher + gsd-ui-checker |

### 5.3 里程碑审计

| 命令 | 作用 |
|------|------|
| `/gsd-audit-milestone` | 里程碑完整性审计（需求覆盖 + 跨阶段集成） |
| `/gsd-audit-uat` | 跨阶段 UAT 扫描（发现未解决的测试项） |
| `/gsd-audit-fix` | 审计 → 自动修复管线 |

---

## 6. 路线图管理

| 命令 | 作用 | 编号规则 |
|------|------|----------|
| `/gsd-add-phase "描述"` | 添加新阶段到末尾 | 整数递增（3, 4, 5...） |
| `/gsd-insert-phase N "描述"` | 在阶段 N 后插入 | 小数（2.1, 2.2...） |
| `/gsd-remove-phase N` | 删除未开始的阶段 | 自动重编号 |
| `/gsd-analyze-dependencies` | 分析阶段间依赖 | — |
| `/gsd-add-backlog "描述"` | 添加待办项 | 999.x |
| `/gsd-review-backlog` | 审查并提升待办 | — |

---

## 7. 调试与取证

| 命令 | 作用 | 参数 |
|------|------|------|
| `/gsd-debug "问题"` | 科学方法调试 | `--diagnose`（只找根因不修复） |
| `/gsd-forensics "描述"` | 事后调查（分析 git 历史 + .planning/ 制品） | — |

**调试流程**：收集症状 → 生成 3+ 独立假设 → 逐个验证 → 定位根因

---

## 8. Git 与发布

| 命令 | 作用 |
|------|------|
| `/gsd-ship N` | 推送 + 创建 PR（自动生成 body） |
| `/gsd-pr-branch` | 创建干净 PR 分支（过滤 .planning/ 提交） |
| `/gsd-undo --last N` | 安全回退最近 N 个提交 |
| `/gsd-undo --phase NN` | 回退整个阶段的提交 |
| `/gsd-undo --plan NN-MM` | 回退特定 plan 的提交 |

---

## 9. 会话管理

| 命令 | 作用 | 产出 |
|------|------|------|
| `/gsd-pause-work` | 创建会话交接点 | `.continue-here.md` + WIP commit |
| `/gsd-resume-work` | 恢复上次会话 | 检测 STATE.md + 未完成 PLAN |
| `/gsd-session-report` | 生成会话报告 | SESSION_REPORT.md |

**`/gsd-resume-work` 恢复逻辑**：
1. 加载 STATE.md（或重建）
2. 检测 .continue-here.md 检查点
3. 检测未完成工作（有 PLAN.md 但无 SUMMARY.md）
4. 呈现状态 → 推荐下一步

---

## 10. 配置与管理

| 命令 | 作用 |
|------|------|
| `/gsd-settings` | 交互式配置（5 问题：模型、研究、验证等） |
| `/gsd-set-profile <tier>` | 切换模型配置（quality / balanced / budget / inherit） |
| `/gsd-health` | 诊断 .planning/ 目录完整性（`--repair` 自动修复） |
| `/gsd-stats` | 项目统计（进度、指标、时间线） |
| `/gsd-profile-user` | 生成开发者画像 |
| `/gsd-docs-update` | 自动生成/更新项目文档 |

### 10.1 config.json 关键配置

```jsonc
{
  "model_profile": "inherit",     // quality | balanced | budget | inherit
  "mode": "yolo",                 // yolo（宽松） | strict（严格）
  "granularity": "coarse",        // coarse（少 plan） | fine（多 plan）
  "workflow": {
    "research": true,             // plan 前是否自动研究
    "plan_check": true,           // 是否启用 plan-checker 验证
    "verifier": false,            // 执行后是否自动验证
    "nyquist_validation": true,   // Nyquist 验证策略
    "auto_advance": false,        // 阶段间是否自动推进
    "ui_phase": true,             // 前端阶段是否自动生成 UI-SPEC
    "discuss_mode": "discuss",    // discuss | assumptions
    "skip_discuss": false         // 是否跳过 discuss 阶段
  },
  "git": {
    "branching_strategy": "none"  // none | phase | milestone
  }
}
```

---

## 11. Agent 体系

### 11.1 完整层级关系

```
/gsd-new-project
  ├── gsd-project-researcher  (x4 并行: STACK/FEATURES/ARCHITECTURE/PITFALLS)
  ├── gsd-research-synthesizer
  └── gsd-roadmapper

/gsd-discuss-phase
  └── gsd-advisor-researcher  (xN 并行，每个灰区一个)

/gsd-plan-phase
  ├── gsd-phase-researcher
  ├── gsd-planner
  └── gsd-plan-checker        (修订循环 max 3)

/gsd-execute-phase
  ├── gsd-executor            (xN 并行，每个 plan 一个)
  └── gsd-verifier

/gsd-code-review
  └── gsd-code-reviewer

/gsd-code-review-fix
  ├── gsd-code-fixer
  └── gsd-code-reviewer       (重审循环 max 3)

/gsd-debug
  └── gsd-debugger

/gsd-map-codebase
  └── gsd-codebase-mapper     (x4 并行: tech/arch/quality/concerns)

/gsd-audit-milestone
  └── gsd-integration-checker

/gsd-secure-phase
  └── gsd-security-auditor

/gsd-validate-phase
  └── gsd-nyquist-auditor

/gsd-ui-phase
  ├── gsd-ui-researcher
  └── gsd-ui-checker          (修订循环 max 3)

/gsd-ui-review
  └── gsd-ui-auditor

/gsd-docs-update
  ├── gsd-doc-writer          (xN 并行)
  └── gsd-doc-verifier        (xN 并行)

/gsd-intel
  └── gsd-intel-updater

/gsd-profile-user
  └── gsd-user-profiler
```

### 11.2 核心设计模式

| 模式 | 使用者 | 原理 |
|------|--------|------|
| **Goal-Backward** | roadmapper, planner, plan-checker, verifier | 从目标出发推导必须存在的条件 |
| **Escalation Gate** | verifier, security-auditor | 无法解决的问题上报给人类 |
| **Revision Gate** | plan-checker, ui-checker | 有界质量循环（max 3 轮），达到上限后升级 |
| **Decision Coverage** | planner | 每个决策 D-XX 必须映射到 plan/task |
| **Scope Reduction Ban** | planner | 禁止 "v1"、"placeholder"、"simplified" — 应拆分阶段 |
| **Wave Parallelism** | execute-phase | 同 Wave 无文件冲突的 plan 并行 spawn |
| **Atomic Commits** | executor | 每个 Task 独立提交 |
| **Context Fidelity** | 所有下游 Agent | CONTEXT.md 锁定的决策不可违背 |

---

## 12. OpenCode 特定注意事项

1. **Hooks 不生效**：OpenCode 不支持 hooks 注册机制，`.opencode/hooks/` 下的 9 个文件不会被调用
2. **命令调用**：直接 `/gsd-xxx`，从 `.opencode/command/` 加载
3. **Subagent 映射**：GSD 的 `Task()` 映射到 OpenCode 的 subagent 机制，24 个 Agent 已部署到 `.opencode/agents/`
4. **权限**：`opencode.json` 已配置 GSD 读取权限
5. **计划格式**：OpenCode 下 planner 可能输出简化格式（非 XML），使用 `--text` 模式会强制使用纯文本编号列表

---

## 13. 典型工作流模式

### 模式 A：全新项目

```
/gsd-new-project
/gsd-map-codebase          # 可选：了解已有代码
/gsd-discuss-phase 1
/gsd-plan-phase 1
/gsd-execute-phase 1
/gsd-verify-work 1
/gsd-ship 1
```

### 模式 B：自主全流程

```
/gsd-new-project
/gsd-autonomous             # 自动 discuss→plan→execute 所有阶段
/gsd-audit-milestone
/gsd-complete-milestone 1.0
```

### 模式 C：快速任务

```
/gsd-quick "添加暗色模式切换"       # 有 GSD 保证
/gsd-fast "修复 README typo"       # 零开销
/gsd-do "我想添加搜索功能"          # 智能路由
```

### 模式 D：会话连续

```
/gsd-pause-work            # 会话结束
# （新会话）/clear
/gsd-resume-work           # 恢复
/gsd-next                  # 继续下一步
```

### 模式 E：质量管线

```
/gsd-code-review 3 --depth=deep
/gsd-code-review-fix 3 --auto
/gsd-secure-phase 3
/gsd-validate-phase 3
```

### 模式 F：棕地项目（已有代码库）

```
/gsd-new-milestone "v1.1 通知功能"
/gsd-map-codebase
/gsd-discuss-phase 3       # 接续已有阶段编号
/gsd-plan-phase 3
/gsd-execute-phase 3
/gsd-verify-work 3
```

---

## 14. 与 dev-flow 的关系

| 维度 | dev-flow | GSD |
|------|----------|-----|
| 定位 | Wopal 空间原生开发工作流 | 第三方 spec-driven 系统 |
| 粒度 | Issue → Plan → 执行 → 验证 | Phase → Wave → Plan → Task |
| 并行 | 单线程 | Wave 并行执行 |
| 状态 | Plan 文件驱动 | STATE.md 状态机 |
| Agent | fae（单一执行者） | 24 个专用 Agent |
| 研究 | 无内置 | 内置 phase-researcher + advisor-researcher |
| 验证 | 人工 | UAT + Nyquist + Security + UI 审计 |
| 适用 | 空间内开发任务 | 独立项目的完整交付管线 |

**互补关系**：dev-flow 适合空间内的日常开发（轻量、快速），GSD 适合独立项目的完整交付（重型、全面）。

---

## 15. 卸载

```bash
scripts/gsd.sh uninstall
```

清理所有 `.opencode/` 下的 GSD 文件（command、agents、hooks、get-shit-done/）和残留的空目录。
