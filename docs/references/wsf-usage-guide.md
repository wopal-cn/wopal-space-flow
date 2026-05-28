# WSF (Wopal Space Flow) — 完整使用指南

> **日期**: 2026-04-20

---

## 0. WSF 是什么

WSF 是 **GSD (Get Shit Done) 的 fork 与空间化改造**，当前状态为 GSD 的完整复制，正逐步精简并融入 Wopal Space。

演变链路：

```
GSD (labs/research/get-shit-done)
  → space-flow (projects/space-flow/)  ← GSD 的 fork
    → WSF                              ← space-flow 的精简与空间化
```

- **GSD**: 原始项目，OpenCode 上的 68 命令 + 24 Agent + 55 工作流
- **space-flow**: GSD 的 fork，WSF 的源码基础
- **WSF**: space-flow 的精简版，命令前缀由 `/gsd-` 改为 `/wsf-`，深度适配 Wopal 多项目空间

### 与 GSD 的关系

| 维度 | 现状 | 目标 |
|------|------|------|
| 核心工作流 | 与 GSD 一致（new-project → discuss → plan → execute） | 保留核心链路，裁剪边缘命令 |
| Agent 体系 | 24 个 Agent 完整复制 | 按需精简，保留高频使用的 Agent |
| 命令数量 | 68 个（与 GSD 相同） | 裁剪到 20-30 个核心命令 |
| 运行环境 | Claude Code CLI（原 GSD 运行于 OpenCode） | 深度适配空间多项目结构 |
| 规划目录 | `.planning/`（与 GSD 相同） | 增加 workspace 隔离支持 |

---

## 1. 架构概览

WSF 是面向单人 Agentic 开发的层次化规划系统，运行于 Claude Code CLI 之上。

```
24 子 Agent（源自 GSD）| 核心工作流 | PRD 导入 | Wave 并行执行
```

### 1.1 安装产物

安装后 `.claude/wsf/` 下的结构：

```
.claude/wsf/
  workflows/*.md             # 工作流定义（源自 GSD）
  agents/                    # 专用子 Agent（源自 GSD，逐步精简中）
  commands/                  # 命令实现
  references/                # 参考文档
  contexts/                  # 执行上下文 profile
```

### 1.2 规划目录结构

所有制品存放在 `.planning/` 下（与 GSD 完全一致）：

```
.planning/
  PROJECT.md                 # 项目愿景与需求
  ROADMAP.md                 # 阶段路线图
  STATE.md                   # 项目记忆与上下文
  config.json                # 工作流配置
  REQUIREMENTS.md            # 需求列表（REQ-ID）
  phases/
    {N}-{slug}/              # 每个阶段的制品
      {N}-CONTEXT.md         # 用户决策
      {N}-RESEARCH.md        # 技术研究
      {N}-PLAN.md            # 执行计划
      {N}-SUMMARY.md         # 执行结果
      REVIEW.md              # 代码审查
      VERIFICATION.md        # 验证报告
  milestones/                # 已归档里程碑
  quick/                     # 快速任务
  debug/                     # 调试会话
  todos/                     # 待办事项
  research/                  # 项目级研究
  codebase/                  # 代码库分析（棕地项目）
  intel/                     # 代码库情报
```

---

## 2. 核心工作流

### 2.1 完整生命周期

```
/wsf-new-project          初始化：提问 → 研究 → 需求 → 路线图
        │
        ▼
┌─── Phase 循环 ─────────────────────────────────┐
│                                                 │
│  /wsf-discuss-phase N    收集阶段决策            │
│         │                                       │
│         ▼                                       │
│  /wsf-plan-phase N      研究 → 规划 → 验证      │
│         │                                       │
│         ▼                                       │
│  /wsf-execute-phase N   Wave 并行执行           │
│         │                                       │
│         ▼                                       │
│  [自动进入下一阶段]                              │
│                                                 │
└─────────────────────────────────────────────────┘
        │
        ▼
/wsf-complete-milestone   归档里程碑
```

### 2.2 阶段 1：`/wsf-new-project` — 项目初始化

**做什么**：交互式提问 → 可选领域研究 → 需求提取 → 路线图生成

**Agent 调用链**：
```
wsf-project-researcher (x4 并行: STACK / FEATURES / ARCHITECTURE / PITFALLS)
  → wsf-research-synthesizer (综合 4 份研究报告)
    → wsf-roadmapper (生成路线图)
```

**产出**：`.planning/` 完整初始化（PROJECT.md、ROADMAP.md、STATE.md、REQUIREMENTS.md、config.json）

### 2.3 棕地项目：`/wsf-map-codebase` — 代码库分析

**做什么**：4 个并行 Explore Agent 全量分析已有代码库

**产出**（`.planning/codebase/`）：

| Agent | 产出 |
|-------|------|
| tech | STACK.md + INTEGRATIONS.md |
| arch | ARCHITECTURE.md + STRUCTURE.md |
| quality | CONVENTIONS.md + TESTING.md |
| concerns | CONCERNS.md |

**使用时机**：在已有代码库上运行 `/wsf-new-project` 之前先运行此命令。

### 2.4 阶段 2：`/wsf-discuss-phase N` — 决策捕获

**做什么**：加载前置上下文 → 识别灰区 → 逐个讨论 → 输出 CONTEXT.md

**关键概念 — 灰区（Gray Area）**：WSF 自动分析哪些技术决策尚未确定，让你选择讨论哪些，其余使用推荐默认值。

**参数**：

| 参数 | 作用 |
|------|------|
| `--batch` | 批量处理（一次问 2-5 个问题） |

**CONTEXT.md 结构**：

```markdown
## Domain (边界)
项目范围和约束

## Decisions (锁定的选择)
D-01: [决策内容] → [选择] — 因为 [理由]

## Specifics
特定实现细节

## Deferred (推迟的决策)
留待后续阶段处理的事项
```

**替代方案**：`/wsf-list-phase-assumptions N` — 先展示 Agent 的假设，再讨论。适合对代码库已有了解的场景。

### 2.5 阶段 3：`/wsf-plan-phase N` — 规划

**做什么**：技术研究 → 生成执行计划 → 目标逆向验证 → 修订循环

**Agent 调用链**：
```
wsf-phase-researcher (技术研究，产出 RESEARCH.md)
  → wsf-planner (生成 PLAN.md)
    → wsf-plan-checker (目标逆向验证)
      → [修订循环: planner → checker，最多 3 轮]
```

**参数**：

| 参数 | 作用 |
|------|------|
| `--prd <file>` | 用外部 PRD 替代 discuss 阶段 |
| `--reviews` | 纳入跨 AI 审查反馈 |

**PRD Express Path**：当你已有清晰的 PRD 时，直接传入 PRD 文件，跳过 discuss 阶段。你的 PRD 会直接变成 CONTEXT.md 中的 locked decisions。

```bash
/wsf-plan-phase 1 --prd docs/prd.md
```

### 2.6 阶段 4：`/wsf-execute-phase N` — 执行

**做什么**：发现计划 → 分析依赖 → 按 Wave 分组 → 并行/顺序执行

**Wave 系统**：同 Wave 且无文件冲突的 plan 并行 spawn subagent 执行。不同 Wave 顺序执行。

**参数**：

| 参数 | 作用 |
|------|------|
| `--wave N` | 只执行第 N 波 |

**提交协议**：每个 Task 独立原子提交。

**产出**：`{N}-{plan}-SUMMARY.md`、更新 STATE.md / ROADMAP.md / REQUIREMENTS.md

---

## 3. 快捷命令

### 3.1 轻量任务

| 命令 | 场景 | 开销 |
|------|------|------|
| `/wsf-fast "描述"` | 微任务（改 typo、小重构、忘提交） | 零 — 直接在当前上下文执行 |
| `/wsf-quick "描述"` | 小任务（加功能、改配置、小修复） | 低 — 有 PLAN.md + 原子提交 |
| `/wsf-do "想做什么"` | 不知道用哪个命令 | 路由 — 分析意图后分发到合适命令 |

**`/wsf-quick` 参数**（可组合）：

| 参数 | 作用 |
|------|------|
| `--full` | 完整管线（discuss + research + plan-check + verify） |
| `--discuss` | 轻量讨论阶段 |
| `--research` | 聚焦研究 |
| `--validate` | Plan-checking + 执行后验证 |
| `--discuss --research --validate` | 等同 `--full` |

---

## 4. 智能导航

| 命令 | 作用 |
|------|------|
| `/wsf-progress` | 显示进度条、完成百分比、最近工作摘要、智能路由下一步 |
| `/wsf-next` | 自动检测 STATE.md 状态，执行下一个逻辑步骤 |
| `/wsf-resume-work` | 恢复上次会话（读 STATE.md、显示最近工作、推荐下一步） |
| `/wsf-pause-work` | 创建会话交接点（.continue-here 文件 + STATE.md 更新） |

---

## 5. 质量管线

### 5.1 代码审查

| 命令 | 作用 |
|------|------|
| `/wsf-code-review N` | 审查阶段代码，产出 REVIEW.md |
| `/wsf-code-review-fix N` | 自动修复 REVIEW.md 中的问题，逐条原子提交 |

### 5.2 专项审计

| 命令 | 作用 |
|------|------|
| `/wsf-verify-work N` | 对话式 UAT 验收 |
| `/wsf-secure-phase N` | 安全威胁验证 |
| `/wsf-validate-phase N` | Nyquist 验证覆盖率审计 |
| `/wsf-ui-review N` | 6 维前端视觉审计 |
| `/wsf-ui-phase N` | 生成 UI 设计契约（UI-SPEC.md） |

### 5.3 里程碑审计

| 命令 | 作用 |
|------|------|
| `/wsf-audit-milestone` | 里程碑完整性审计 |
| `/wsf-audit-uat` | 跨阶段 UAT 扫描 |
| `/wsf-plan-milestone-gaps` | 将审计发现的 gap 转为新阶段 |

---

## 6. 路线图管理

| 命令 | 作用 | 编号规则 |
|------|------|----------|
| `/wsf-add-phase "描述"` | 添加新阶段到末尾 | 整数递增（3, 4, 5...） |
| `/wsf-insert-phase N "描述"` | 在阶段 N 后插入紧急工作 | 小数（7.1, 7.2...） |
| `/wsf-remove-phase N` | 删除未开始的阶段 | 自动重编号 |

---

## 7. 调试

| 命令 | 作用 |
|------|------|
| `/wsf-debug "问题"` | 科学方法调试（症状 → 假设 → 测试 → 根因） |

调试会话持久化到 `.planning/debug/`，跨 `/clear` 存活。运行 `/wsf-debug`（无参数）恢复活跃会话。

---

## 8. 会话管理

| 命令 | 作用 |
|------|------|
| `/wsf-pause-work` | 创建 `.continue-here` + 更新 STATE.md |
| `/wsf-resume-work` | 加载 STATE.md，检测未完成工作，推荐下一步 |
| `/wsf-session-report` | 生成会话报告（token 估算、工作摘要、结果） |

---

## 9. 发布

| 命令 | 作用 |
|------|------|
| `/wsf-ship N` | 推送分支 + 创建 PR（自动生成 body） |
| `/wsf-pr-branch` | 创建干净 PR 分支（过滤 .planning/ 提交） |

前提条件：阶段已验证、`gh` CLI 已安装并认证。

---

## 10. 配置与管理

### 10.1 配置命令

| 命令 | 作用 |
|------|------|
| `/wsf-settings` | 交互式配置（模型配置、研究/验证开关） |
| `/wsf-set-profile <tier>` | 切换模型配置 |

### 10.2 模型配置

| 配置 | 含义 |
|------|------|
| `quality` | Opus 用于所有阶段 |
| `balanced` | Opus 规划 + Sonnet 执行（默认） |
| `budget` | Sonnet 编写 + Haiku 研究/验证 |
| `inherit` | 使用当前会话模型 |

### 10.3 config.json 关键配置

```jsonc
{
  "planning": {
    "commit_docs": true,       // true = 提交到 git, false = 本地保留
    "search_gitignored": false // .planning/ 被 gitignore 时启用
  }
}
```

---

## 11. 工作流模式

### 11.1 Interactive vs YOLO

| 模式 | 行为 |
|------|------|
| Interactive | 每个重大决策确认，检查点暂停 |
| YOLO | 自动批准大多数决策，仅关键检查点停止 |

在 `.planning/config.json` 中设置，随时可改。

---

## 12. 文件结构总览

```
.planning/
├── PROJECT.md            # 项目愿景
├── ROADMAP.md            # 阶段路线图
├── STATE.md              # 项目记忆
├── REQUIREMENTS.md       # 可追溯需求列表
├── config.json           # 工作流配置
├── todos/                # 待办事项
│   ├── pending/          # 等待中
│   └── done/             # 已完成
├── debug/                # 调试会话
│   └── resolved/         # 已归档
├── milestones/           # 已归档里程碑
│   ├── v1.0-ROADMAP.md
│   ├── v1.0-REQUIREMENTS.md
│   └── v1.0-phases/      # 归档阶段
├── codebase/             # 代码库分析（棕地项目）
│   ├── STACK.md
│   ├── ARCHITECTURE.md
│   ├── STRUCTURE.md
│   ├── CONVENTIONS.md
│   ├── TESTING.md
│   ├── INTEGRATIONS.md
│   └── CONCERNS.md
└── phases/
    ├── 01-foundation/
    │   ├── 01-01-PLAN.md
    │   └── 01-01-SUMMARY.md
    └── 02-core-features/
        ├── 02-01-PLAN.md
        └── 02-01-SUMMARY.md
```

---

## 13. 典型工作流模式

### 模式 A：全新项目

```
/wsf-new-project
/wsf-plan-phase 1
/wsf-execute-phase 1
/wsf-verify-work 1
```

### 模式 B：棕地项目（已有代码库）

```
/wsf-map-codebase
/wsf-new-project          # 会读取 codebase/ 分析结果
/wsf-plan-phase 1
/wsf-execute-phase 1
```

### 模式 C：PRD 驱动（已有 PRD）

```
/wsf-new-project          # 初始化项目结构
/wsf-plan-phase 1 --prd docs/prd.md  # 直接用 PRD
/wsf-execute-phase 1
/wsf-verify-work 1
```

### 模式 D：PRD 渐进式完善（PRD 不完整）

```
PRD v0.1
/wsf-discuss-phase 1      # 通过提问发现 PRD 盲区
# 根据讨论结果修改 PRD
/wsf-plan-phase 1 --prd docs/prd-v0.2.md  # 用新版本
/wsf-execute-phase 1
```

### 模式 E：快速任务

```
/wsf-quick "添加暗色模式切换"       # 有 WSF 保证
/wsf-fast "修复 README typo"       # 零开销
/wsf-do "我想添加搜索功能"          # 智能路由
```

### 模式 F：会话连续

```
/wsf-pause-work            # 会话结束
# （新会话）/clear
/wsf-resume-work           # 恢复
/wsf-progress              # 查看进度
```

### 模式 G：质量管线

```
/wsf-code-review 3
/wsf-code-review-fix 3
/wsf-secure-phase 3
/wsf-verify-work 3
```

### 模式 H：里程碑完成

```
/wsf-audit-milestone
/wsf-plan-milestone-gaps   # gap 转成新阶段
/wsf-complete-milestone 1.0.0
/wsf-new-milestone "v2.0 功能"
```

### 模式 I：研究型项目（无明确终点）

WSF 本质是 spec-driven（规格驱动），但研究型项目可以通过重新定义"产出"来适配。

#### 核心适配策略

**策略一：用 Success Criteria 定义"探索完成"**

Phase goal 写探索目标，Success Criteria 写"探索产出"而非"功能交付"：

```markdown
## Phase 1: 技术栈调研

Goal: 确定技术栈可行性
Success Criteria:
1. 完成 STACK.md（技术选型 + 理由）
2. 完成 ARCHITECTURE.md（候选架构）
3. 关键技术原型验证通过

## Phase 2: 领域建模

Goal: 建立领域概念模型
Success Criteria:
1. 完成 DOMAIN.md（核心实体 + 关系）
2. 关键场景流程图绘制完成
```

**策略二：研究产物当 phase 输出**

`/wsf-new-project` 会生成 `.planning/research/` 目录：

| 文件 | 内容 |
|------|------|
| STACK.md | 技术栈调研 |
| FEATURES.md | 功能发现 |
| ARCHITECTURE.md | 架构候选 |
| PITFALLS.md | 风坑点 |

研究型项目可以把这些当作 phase 交付物，不强制要求代码产出。

**策略三：Phase 状态由磁盘产物自动判定**

WSF 的 phase 状态不是手动设置，而是根据 `.planning/{phase}/` 目录下的文件自动判定（`disk_status`）：

| disk_status | 判定条件 |
|-------------|----------|
| `complete` | `summaries >= plans` 且 `plans > 0` |
| `partial` | `summaries > 0` 但 `< plans` |
| `planned` | 有 PLAN.md 但无 SUMMARY.md |
| `researched` | 有 RESEARCH.md 但无 PLAN.md |
| `discussed` | 有 CONTEXT.md 但无 RESEARCH.md/PLAN.md |
| `empty` | 目录存在但无产物 |
| `no_directory` | 目录不存在 |

研究型项目的关键是：**用 SUMMARY.md 标记 phase 完成**。即使没有代码产出，也可以写一个 SUMMARY.md 记录研究结论，WSF 就会判定 phase 为 `complete`。

#### ROADMAP 示例（研究型）

```markdown
## Phase 1: 技术调研

Goal: 确定技术栈可行性
Success Criteria:
1. STACK.md 完成并覆盖至少 3 个候选方案
2. 关键技术 PoC 通过
Dependencies: 无

## Phase 2: 架构探索

Goal: 设计可扩展的架构骨架
Success Criteria:
1. ARCHITECTURE.md 完成（含数据流图）
2. 核心模块边界清晰
Dependencies: Phase 1

## Phase 3: 领域建模

Goal: 建立领域概念模型
Success Criteria:
1. DOMAIN.md 完成（实体 + 关系 + 生命周期）
2. 至少 3 个关键场景流程验证
Dependencies: Phase 2
```

#### Milestone vs Phase 关系

```
Milestone（大目标）
  └─ Phase 1（子目标）
  └─ Phase 2（子目标）
  └─ Phase 3（子目标）
```

- Milestone 是版本级交付（v1、v2）
- Phase 是 Milestone 内的增量
- `/wsf-complete-milestone` 归档当前版本，清空 ROADMAP 准备下一版本

#### 关键结论

WSF 不强制"功能交付"，强制的是：

1. Goal 必须可检验（有产出）
2. Success Criteria 必须具体（能判断完成）
3. 产物写入 `.planning/`（可追溯）

研究型项目把"产出文档/原型/模型"当 Goal，把"文档完成/原型运行/模型验证"当 Success Criteria，即可适配。

---

## 14. Agent 体系

> **源自 GSD**，当前 24 个 Agent 完整复制，后续按空间使用频率精简。

```
/wsf-new-project
  ├── wsf-project-researcher  (x4 并行)
  ├── wsf-research-synthesizer
  └── wsf-roadmapper

/wsf-plan-phase
  ├── wsf-phase-researcher
  ├── wsf-planner
  └── wsf-plan-checker  (修订循环 max 3)

/wsf-execute-phase
  └── wsf-executor  (xN 并行)

/wsf-code-review
  └── wsf-code-reviewer

/wsf-code-review-fix
  └── wsf-code-fixer

/wsf-debug
  └── wsf-debugger

/wsf-map-codebase
  └── wsf-codebase-mapper  (x4 并行)

/wsf-secure-phase
  └── wsf-security-auditor

/wsf-validate-phase
  └── wsf-nyquist-auditor

/wsf-ui-phase
  ├── wsf-ui-researcher
  └── wsf-ui-checker

/wsf-ui-review
  └── wsf-ui-auditor

/wsf-intel
  └── wsf-intel-updater

/wsf-profile-user
  └── wsf-user-profiler
```

---

## 15. 核心设计模式

> **继承自 GSD**，是 GSD 工作流的核心价值所在。

| 模式 | 使用者 | 原理 |
|------|--------|------|
| **Goal-Backward** | roadmapper, planner, plan-checker, verifier | 从目标出发逆向推导必须存在的条件 |
| **Revision Gate** | plan-checker, ui-checker | 有界质量循环（max 3 轮），超限后升级 |
| **Wave Parallelism** | execute-phase | 同 Wave 无文件冲突的 plan 并行执行 |
| **Atomic Commits** | executor | 每个 Task 独立提交 |
| **Context Fidelity** | 所有下游 Agent | CONTEXT.md 锁定的决策不可违背 |
| **Escalation Gate** | verifier, security-auditor | 无法解决的问题上报给人类 |
| **Decision Coverage** | planner | 每个决策 D-XX 必须映射到 plan/task |
| **Scope Reduction Ban** | planner | 禁止 "v1"、"placeholder" — 应拆分阶段 |

---

## 16. WSF 精简计划

WSF 当前为 GSD 的完整复制，以下是要精简的方向：

### 要保留（核心链路）

| 命令 | 原因 |
|------|------|
| `new-project` / `new-milestone` | 项目初始化入口 |
| `discuss-phase` / `plan-phase` / `execute-phase` | 核心三段式 |
| `progress` / `next` | 进度查看与导航 |
| `pause-work` / `resume-work` | 会话管理 |
| `quick` / `fast` / `do` | 轻量任务 |
| `verify-work` | UAT 验收 |
| `settings` / `set-profile` | 配置管理 |

### 要裁剪（低频/冗余）

| 命令 | 原因 |
|------|------|
| `join-discord` | 社区功能，空间内不需要 |
| `review`（跨 AI 审查） | 需要多个外部 AI CLI，使用频率低 |
| `plant-seed` | 可用 `note` 替代 |
| `workstreams` | 空间内用 dev-flow 替代 |
| `thread` | 跨会话上下文用 pause/resume 替代 |

### 要改造（适配空间）

| 方向 | 说明 |
|------|------|
| 多项目 workspace 隔离 | 支持每个子项目独立 `.planning/` |
| Agent 精简 | 24 → 10-15 个高频 Agent |
| 命令别名 | 提供更简短的别名（如 `/wsf-n` = `/wsf-next`） |

---

## 17. 更新 WSF

```bash
npx wsf-cc@latest
```

或使用 WSF 自带命令：

```bash
/wsf-update
```

后者会显示版本对比、changelog 和破坏性变更，确认后再安装。
