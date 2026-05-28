# GSD (Get Shit Done) 项目研究报告

> **日期**: 2026-03-27
> **项目**: [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)
> **定位**: Claude Code / OpenCode / Gemini CLI / Codex 的 meta-prompting 与 spec-driven development 系统
> **Fork**: `labs/fork/sampx/get-shit-done`
> **分析目标**: 识别可借鉴到 WopalSpace 的设计模式和工程实践

---

## 1. 项目概览

GSD 是一个轻量级但高度系统化的 AI 辅助开发框架，核心理念是 **解决 context rot**——随着 Claude 填满上下文窗口，输出质量退化的问题。

### 1.1 一句话总结

> **Plans are prompts, not documents that become prompts.** 计划本身就是给 Claude 执行的 prompt，而非需要二次转化的文档。

### 1.2 核心指标

| 维度 | 数据 |
|------|------|
| 命令数 | 30+ |
| Agent 数 | 11 个专用 agent |
| 工作流文件 | 30+ |
| CLI 工具 | `gsd-tools.cjs` (12 个模块) |
| 支持 Runtime | Claude Code, OpenCode, Gemini CLI, Codex |
| 安装方式 | `npx get-shit-done-cc@latest` |
| 许可证 | MIT |

### 1.3 解决的核心问题

```
传统方式:  Claude 全程单上下文 → 质量随上下文填充退化
GSD 方式:  编排器(15%) + 子 Agent(每个 200k) → 质量始终如一
```

---

## 2. 架构分析

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        GSD Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  用户 ──▶ Commands ──▶ Orchestrator ──▶ Subagents ──▶ 产出      │
│           (30+个)       (10-15%)       (每个200k)     (代码+文档) │
│                                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐            │
│  │ Commands  │───▶│  Workflows   │───▶│   Agents     │            │
│  │ .md 文件  │    │  .md 文件    │    │  .md 文件    │            │
│  │ (触发器)  │    │  (编排逻辑)  │    │  (执行器)    │            │
│  └──────────┘    └──────────────┘    └──────────────┘            │
│                         │                    │                    │
│                         ▼                    ▼                    │
│                  ┌──────────────┐    ┌──────────────┐            │
│                  │  gsd-tools   │    │  .planning/  │            │
│                  │  .cjs (CLI)  │    │  (状态存储)  │            │
│                  └──────────────┘    └──────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心工作流

```
new-project → discuss-phase → plan-phase → execute-phase → verify-work
     │              │              │             │              │
     ▼              ▼              ▼             ▼              ▼
 PROJECT.md    CONTEXT.md     PLAN.md      SUMMARY.md    VERIFICATION.md
 REQUIREMENTS  RESEARCH.md    (XML结构)     (执行报告)     (验证报告)
 ROADMAP.md                  must_haves                   gaps?
 STATE.md                    dependency                   passed?
 config.json                 waves
```

### 2.3 状态管理

所有项目状态存储在 `.planning/` 目录：

```
.planning/
├── PROJECT.md          # 项目愿景（始终加载）
├── REQUIREMENTS.md     # 需求追踪（REQ-ID 追溯）
├── ROADMAP.md          # 路线图（阶段 + 成功标准）
├── STATE.md            # 跨会话状态（位置/决策/阻塞）
├── config.json         # 工作流配置
├── research/           # 项目研究产出
│   ├── STACK.md
│   ├── FEATURES.md
│   ├── ARCHITECTURE.md
│   └── PITFALLS.md
├── phases/             # 阶段执行目录
│   └── 01-foundation/
│       ├── 01-CONTEXT.md
│       ├── 01-RESEARCH.md
│       ├── 01-01-PLAN.md
│       ├── 01-01-SUMMARY.md
│       └── 01-VERIFICATION.md
└── milestones/         # 已归档里程碑
    └── v1.0-phases/
```

---

## 3. 关键设计模式深度分析

### 3.1 Context Engineering（上下文工程）

这是 GSD 最核心的创新。

**问题模型**：

| 上下文使用率 | Claude 质量状态 | 表现 |
|-------------|----------------|------|
| 0-30% | PEAK | 全面、深入 |
| 30-50% | GOOD | 自信、扎实 |
| 50-70% | DEGRADING | 效率模式开始 |
| 70%+ | POOR | 简略、敷衍 |

**GSD 的解法**：

```
编排器上下文: ~10-15% (只做调度，不执行)
子 Agent 上下文: 100% fresh (每个任务全新 200k)
```

**关键文件 → 上下文角色**：

| 文件 | 职责 | 加载时机 |
|------|------|----------|
| `PROJECT.md` | 项目愿景，始终加载 | 每次 |
| `STATE.md` | 位置/决策/阻塞器 | 每次 |
| `ROADMAP.md` | 阶段目标与成功标准 | 计划/验证 |
| `CONTEXT.md` | 用户决策锁定 | 研究/计划 |
| `PLAN.md` | 原子任务 + 验证标准 | 执行 |
| `SUMMARY.md` | 执行结果 + 依赖图 | 历史参考 |

### 3.2 Wave Execution（波次并行执行）

**核心原则**：编排器协调，不执行。每个子 Agent 加载完整上下文独立工作。

```
Wave 1 (parallel)          Wave 2 (parallel)          Wave 3 (sequential)
┌─────────┐ ┌─────────┐    ┌─────────┐ ┌─────────┐    ┌─────────┐
│ Plan 01 │ │ Plan 02 │ →  │ Plan 03 │ │ Plan 04 │ →  │ Plan 05 │
│ User    │ │ Product │    │ Orders  │ │ Cart    │    │Checkout │
│ Model   │ │ Model   │    │ API     │ │ API     │    │   UI    │
└─────────┘ └─────────┘    └─────────┘ └─────────┘    └─────────┘
     │           │              ↑           ↑              ↑
     └───────────┴──────────────┴───────────┘              │
            Dependencies: Plan 03 needs Plan 01
                        Plan 04 needs Plan 02
                        Plan 05 needs Plans 03 + 04
```

**依赖图构建**：

每个 Task 记录：
- `needs`: 执行前必须存在什么
- `creates`: 执行后产出什么
- `has_checkpoint`: 是否需要用户交互

**垂直切片 vs 水平分层**：

```
✅ 垂直切片（优先）           ❌ 水平分层（避免）
Plan 01: User (model+API+UI)   Plan 01: 所有 Models
Plan 02: Product (model+API+UI) Plan 02: 所有 APIs
Plan 03: Order (model+API+UI)  Plan 03: 所有 UIs
→ 全部 Wave 1 并行            → 全部顺序执行
```

### 3.3 Deviation Rules（偏差处理规则）

执行器在执行过程中**必然**遇到计划外的情况。GSD 用 4 条规则自动决策：

| 规则 | 触发条件 | 动作 | 需要人工? |
|------|---------|------|----------|
| **Rule 1**: Auto-fix bugs | 代码行为与预期不符 | 内联修复 + 测试 + 验证 | 否 |
| **Rule 2**: Auto-add missing critical | 缺少正确性/安全性必需功能 | 添加 + 测试 + 验证 | 否 |
| **Rule 3**: Auto-fix blocking | 阻塞当前任务完成的问题 | 修复 + 继续 | 否 |
| **Rule 4**: Ask about architectural | 需要重大结构性修改 | 停止 → 返回检查点 | **是** |

**优先级逻辑**：
```
Rule 4 适用 → 停止（架构决策）
Rule 1-3 适用 → 自动修复
不确定 → 按 Rule 4 处理（问）
```

**边界约束**：
- 只修复**当前任务直接导致**的问题
- 前置警告/lint 错误/无关文件 → 记录到 `deferred-items.md`，不修复
- 每任务最多 3 次自动修复尝试

### 3.4 Goal-Backward Verification（目标反向验证）

**核心原则**：任务完成 ≠ 目标达成。

一个 "创建聊天组件" 的任务可以标记为完成（文件已创建），但目标 "可用的聊天界面" 可能并未达成（组件是空壳）。

**三级验证**：

```
Level 1: 文件存在？
Level 2: 内容实质？（非 stub/placeholder）
Level 3: 已连接？（import + 使用）
```

**最终状态映射**：

| Exists | Substantive | Wired | 状态 |
|--------|------------|-------|------|
| ✓ | ✓ | ✓ | ✓ VERIFIED |
| ✓ | ✓ | ✗ | ⚠️ ORPHANED |
| ✓ | ✗ | - | ✗ STUB |
| ✗ | - | - | ✗ MISSING |

**Stub 检测模式**（实用的正则）：

```javascript
// React 组件 stub
return <div>Placeholder</div>
return <div>{/* TODO */}</div>
onClick={() => {}}
onSubmit={(e) => e.preventDefault()}  // 只阻止默认行为

// API 路由 stub
return Response.json({ message: "Not implemented" });
return Response.json([]);  // 空数组无 DB 查询

// 连接断开
fetch('/api/messages')  // 无 await、无 .then、无赋值
```

### 3.5 Checkpoint Protocol（检查点协议）

三种检查点类型，自动化优先：

| 类型 | 占比 | 用途 | 自动化策略 |
|------|------|------|-----------|
| `checkpoint:human-verify` | 90% | 视觉/功能验证 | Claude 先自动化一切，人只确认结果 |
| `checkpoint:decision` | 9% | 实现方向选择 | 提供选项表 + 优缺点 |
| `checkpoint:human-action` | 1% | 无 API 的纯人工操作 | 邮件链接、2FA 等 |

**黄金法则**：如果 Claude 能通过 CLI/API 做到，Claude 必须自己做。检查点仅用于验证和决策，不用于人工劳动。

**Auth Gate 模式**（动态检查点）：
```
Claude 尝试自动化 → 认证错误 → 创建 human-action 检查点
→ 用户认证 → Claude 重试 → 继续
```

### 3.6 Plan Format（计划格式）

计划用 XML 结构化，直接作为 Claude 的执行 prompt：

```xml
---
phase: 01-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/models/user.ts, src/api/auth.ts]
autonomous: true
requirements: [AUTH-01, AUTH-02]
must_haves:
  truths: ["用户可以用邮箱登录"]
  artifacts: [{path: "src/api/auth/login/route.ts", provides: "登录端点"}]
  key_links: [{from: "LoginPage.tsx", to: "/api/auth/login", via: "fetch"}]
---

<objective>JWT 认证使用 jose 库</objective>

<tasks>
  <task type="auto">
    <name>创建登录端点</name>
    <files>src/app/api/auth/login/route.ts</files>
    <action>用 jose 创建 JWT，验证凭据，返回 httpOnly cookie</action>
    <verify><automated>curl -X POST localhost:3000/api/auth/login</automated></verify>
    <done>有效凭据返回 cookie，无效返回 401</done>
  </task>
</tasks>
```

**设计要点**：
- 每个 Plan 2-3 个 Task（~50% 上下文预算）
- Task 15-60 分钟 Claude 执行时间
- 接口优先排序：先定义契约 → 再实现 → 最后连接
- TDD 候选获得独立 Plan（RED→GREEN→REFACTOR 消耗 40-50% 上下文）

### 3.7 Model Profiles（模型配置）

三级模型配置，平衡成本与质量：

```javascript
const MODEL_PROFILES = {
  'gsd-planner':              { quality: 'opus', balanced: 'opus',   budget: 'sonnet' },
  'gsd-roadmapper':           { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'gsd-executor':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'gsd-phase-researcher':     { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
  'gsd-project-researcher':   { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
  'gsd-research-synthesizer': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsd-debugger':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'gsd-codebase-mapper':      { quality: 'sonnet', balanced: 'haiku', budget: 'haiku' },
  'gsd-verifier':             { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsd-plan-checker':         { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsd-integration-checker':  { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsd-nyquist-auditor':      { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
};
```

**设计逻辑**：
- 规划器用强模型（需要深度推理）
- 执行器按预算选（代码生成质量差异可控）
- 验证器/研究器用轻模型（模式匹配 + 信息搜集）
- 支持 per-agent override 覆盖

### 3.8 Discuss Phase（阶段讨论）

在计划前捕获用户的实现决策，而非直接让 Claude 猜测。

**流程**：
1. 加载前置上下文（跳过已决定的内容）
2. 侦察代码库（可复用资产 + 已有模式）
3. 分析阶段 → 识别灰色区域
4. 用户选择要讨论的区域
5. 每区域深入 4 个问题，用代码信息提供选项
6. 生成 CONTEXT.md

**下游消费者**：
- `gsd-phase-researcher` → 用决策聚焦研究方向
- `gsd-planner` → 用决策创建具体任务（锁定的决策不可变更）

**决策分类**：
```
Locked Decisions    → 必须按指定实现（用户明确选择的）
Deferred Ideas      → 不得出现在计划中（延后到其他阶段）
Claude's Discretion  → Claude 自行判断（用户说"你决定"的）
```

### 3.9 CLI 工具集 (gsd-tools.cjs)

12 个模块组成的 CLI 工具，处理所有状态管理：

| 模块 | 职责 |
|------|------|
| `core.cjs` | 共享工具、模型配置表、输出、配置加载 |
| `config.cjs` | 配置 CRUD |
| `state.cjs` | STATE.md 操作 |
| `phase.cjs` | 阶段管理（查找/添加/插入/删除/完成） |
| `roadmap.cjs` | 路线图解析 |
| `milestone.cjs` | 里程碑管理 |
| `verify.cjs` | 验证逻辑 |
| `template.cjs` | 模板处理 |
| `frontmatter.cjs` | YAML frontmatter CRUD |
| `commands.cjs` | 命令注册/分发 |
| `init.cjs` | 工作流初始化 |

**设计亮点**：
- 纯 Node.js CommonJS，零外部依赖
- 大输出自动写临时文件 + `@file:` 前缀（避免 Bash 缓冲区溢出）
- 跨平台路径处理

---

## 4. 与 WopalSpace 的对比分析

### 4.1 维度对比

```
┌──────────────────┬────────────────────────┬────────────────────────┐
│ 维度             │ GSD                    │ WopalSpace             │
├──────────────────┼────────────────────────┼────────────────────────┤
│ 定位             │ 项目级开发工作流        │ 空间级操作系统          │
│ 用户             │ 独立开发者              │ 超级个体               │
│ 状态管理         │ .planning/ 目录        │ projects<project>/docs/plans/   │
│                  │                        │ + MEMORY.md            │
│ Agent 架构       │ 11 个专用 agent        │ Wopal + Fae 双层       │
│ 并行执行         │ Wave-based 并行        │ 单任务顺序             │
│ 计划格式         │ XML 结构化             │ Markdown + YAML        │
│ 验证机制         │ 自动验证 + UAT         │ dev-flow 人工门控      │
│ 偏差处理         │ 4 条自动规则           │ 无自动处理             │
│ 上下文管理       │ 显式预算 (~50%)        │ 隐式                   │
│ 模型配置         │ profile 表驱动         │ 硬编码                 │
│ 研究机制         │ 内置 4 维度并行研究     │ 无内置                 │
│ 里程碑           │ 内置归档 + 版本管理     │ 手动归档               │
│ 部署             │ npm 包自动安装          │ wopal-cli 手动         │
│ 跨 Runtime       │ 4 个 Runtime 适配      │ OpenCode 专属          │
│ 工具链           │ Node.js CLI            │ Python CLI             │
└──────────────────┴────────────────────────┴────────────────────────┘
```

### 4.2 互补性分析

```
WopalSpace 强项                    GSD 强项
─────────────────                  ──────────
空间级治理 (AGENTS/MEMORY)         项目级执行效率
多层 Agent 协作 (Wopal+Fae)       11 专用 Agent 细分
技能系统 (锻造层)                  命令系统 (30+ 命令)
自研 CLI (wopal-cli)              成熟 CLI 工具集
记忆沉淀 (MEMORY.md)              STATE.md 跨会话状态
dev-flow (Issue 驱动)             端到端工作流 (6 步闭环)
```

---

## 5. WSF 子代理、命令、工作流联动机制（2026-04-17 更新）

### 5.1 三层联动架构

WSF（Wopal Space Flow）采用 **命令→工作流→子代理** 三层架构：

```
┌─────────────────────────────────────────────────────────────┐
│                        用户入口层                            │
│  Commands (.opencode/commands/*.md)                         │
│  - /wsf-new-project, /wsf-plan-phase, /wsf-execute-phase   │
│  - 解析参数、加载配置、触发工作流                             │
└─────────────────────┬───────────────────────────────────────┘
                      │ @-reference 加载工作流
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                        编排层                                │
│  Workflows (.opencode/wsf/workflows/*.md)                   │
│  - plan-phase.md (1075行) — 计划编排                         │
│  - execute-phase.md (1241+行) — 执行编排                     │
│  - 状态机、Gate 控制、调度子代理、信号解析                    │
└─────────────────────┬───────────────────────────────────────┘
                      │ Task() spawn
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                        执行层                                │
│  Subagents (.opencode/agents/wsf-*.md)                      │
│  - 24 个专业化代理，单一职责                                  │
│  - 新上下文窗口，完整执行环境                                 │
│  - 完成后输出 ## MARKER 信号                                 │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 核心机制

#### 信号传递（Agent Contract）

编排器通过**正则匹配**子代理输出的 H2 标记判断完成状态：

| 子代理 | 完成标记 |
|--------|---------|
| `wsf-phase-researcher` | `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` |
| `wsf-planner` | `## PLANNING COMPLETE` |
| `wsf-plan-checker` | `## VERIFICATION PASSED` / `## ISSUES FOUND` |
| `wsf-executor` | `## PLAN COMPLETE` / `## CHECKPOINT REACHED` |
| `wsf-verifier` | `## Verification Complete`（title case） |

#### Gate 类型（四类检查门）

| Gate | 位置 | 行为 | 示例 |
|------|------|------|------|
| **Pre-flight** | 入口 | 验证前置条件，不通过则阻塞 | PLAN.md 不存在 → 阻止执行 |
| **Revision** | 产出后 | 循环修正，迭代上限 (max 3) | Plan checker 发现问题 → replan |
| **Escalation** | 无法自动解决 | 上报用户决策 | Revision 3次仍 stall |
| **Abort** | 危险点 | 立即停止，保留状态 | 上下文极低时 |

#### 上下文预算

- **编排器**：~10-15%（只传文件路径，不传内容）
- **子代理**：100% fresh（自己加载文件，全新上下文）
- **大窗口模型**：≥500k 时启用跨 Phase 上下文（加载 prior phase CONTEXT.md + SUMMARY.md）

#### 扁平调用防冻结

Auto-advance 链使用 `Skill()` 而非 `Task()` 调用下一 Phase，`--no-transition` 标记保持调用栈平坦，避免嵌套 Task 冻结。

### 5.3 具体场景：`/wsf-plan-phase 3 --auto` 开发 Dashboard 逐步骤解析

#### Phase 1 — 计划阶段（plan-phase.md, 16 步）

| 步骤 | 操作 | 机制 |
|------|------|------|
| **1. 初始化** | `wsf-tools.cjs init plan-phase 3` | 返回 30+ 字段 JSON（路径、模型配置、已有制品状态） |
| **2. 参数解析** | 提取 `--auto`、`--research`、`--prd`、`--text` | 设置 TEXT_MODE 控制 CLI 菜单输出格式 |
| **3. 验证 Phase** | `wsf-tools.cjs roadmap get-phase 3` | 确认 Phase 3 在 ROADMAP.md 中存在 |
| **4. 加载 CONTEXT.md** | 检查 phase_dir 中 CONTEXT.md | 若无 → 提示用户先 run discuss-phase（不作为嵌套 Task，避免 #1009） |
| **5. Research** | `Task(subagent="wsf-phase-researcher")` | 传路径不传内容 → 子代理输出 `## RESEARCH COMPLETE` → 编排器正则检测 |
| **5.5 Nyquist** | 从 RESEARCH.md 提取验证架构 | 生成 VALIDATION.md 模板 |
| **5.6 UI Contract** | grep 检测 frontend 关键词 + 检查 UI-SPEC.md | 无 UI-SPEC → 要求先生成（auto-chain 下自动 spawn） |
| **5.7 Schema Push** | 扫描 ORM schema 文件模式 | 检测到 → 在 Plan 中强制注入 `[BLOCKING]` push 任务 |
| **8. Planning** | `Task(subagent="wsf-planner")` | Prompt 含 deep_work_rules：强制每个 task 必须有 read_first + 可验证 acceptance_criteria + 具体 action 值 |
| **10. Plan Checker** | `Task(subagent="wsf-plan-checker")` | 验证质量 → 输出 `## VERIFICATION PASSED` 或结构化 YAML issues |
| **12. Revision Loop** | 迭代 max 3 | Planner(拿到 issues) → Checker → Stall 检测(issue 不降) → Escalation |
| **13. 需求覆盖率** | grep Plan frontmatter `requirements_addressed` vs `phase_req_ids` | 未覆盖 → 用户选择重规划/移下阶段/接受 |
| **15. Auto-Advance** | `Skill(skill="wsf-execute-phase", args="3 --auto --no-transition")` | 扁平调用，避免嵌套冻结 |

#### Phase 2 — 执行阶段（execute-phase.md, 17+ 步）

| 步骤 | 操作 | 机制 |
|------|------|------|
| **1-2. 初始化** | `wsf-tools.cjs init execute-phase 3` | 读取反模式、worktree 配置、上下文窗口大小 |
| **5. 发现 Plans** | `wsf-tools.cjs phase-plan-index 3` | 返回 JSON：waves 分组 + 每个 plan 的 files_modified |
| **4. Overlap 检测** | Wave 内 files_modified 两两配对 | 重叠 → 本 Wave 强制串行 |
| **5. Wave 并行** | `Task(..., isolation="worktree", run_in_background=true)` | **关键**：每个 Task 单独发（序列化 dispatch 避免 .git/config.lock 竞争），但 run_in_background=true（并行执行） |
| **5.5. Worktree 合并** | 对每个 worktree branch → `git merge` | 备份+恢复 STATE.md/ROADMAP.md（main 永远权威）→ 删除 worktree |
| **7b. 跨 Plan 连线** | `wsf-tools.cjs verify key-links` | 检查 Plan 间的 import/export 在代码中真实存在 |
| **8. Checkpoint** | autonomous: false 的 Plan → 用户确认 | Auto-mode: human-verify 自动批准, decision 自动选首个, human-action 仍停等 |
| **9. 代码审查** | `Skill(skill="wsf-code-review")` | 生成 REVIEW.md，强制但非阻塞 |
| **10. 回归测试** | 读 prior VERIFICATION.md → 提取测试文件 → `npx jest` | 失败 → 修复/继续/回退 |
| **13. Goal 验证** | `Task(subagent="wsf-verifier")` | 从目标反向检查 Truths → Artifacts → Wiring → 创建 VERIFICATION.md |
| **15. 更新追踪** | `wsf-tools.cjs phase complete 3` | ROADMAP checkbox + STATE.md + REQUIREMENTS 追溯 |

### 5.4 24 个子代理分类

按调用链分：

| 链 | 子代理 | 被谁调用 |
|---|--------|---------|
| **核心执行** | planner, executor, verifier | plan-phase, execute-phase, verify-phase |
| **质量保障** | plan-checker, code-reviewer, code-fixer, ui-auditor, nyquist-auditor | 各阶段 Gate |
| **研究规划** | project-researcher, roadmapper, phase-researcher, research-synthesizer | new-project, plan-phase |
| **UI/文档** | ui-researcher, ui-checker, doc-writer, doc-verifier | ui-phase, doc-phase |
| **决策辅助** | advisor-researcher, assumptions-analyzer, intel-updater, codebase-mapper, user-profiler | discuss-phase, map-codebase |
| **调试安全** | debugger, integration-checker, security-auditor | debug, integration-check, secure-phase |

---
---

## 6. 附录：关键文件索引

| 文件 | 行数 | 核心内容 |
|------|------|---------|
| `agents/gsd-executor.md` | 489 | 执行器：原子提交 + 偏差规则 + 检查点协议 |
| `agents/gsd-planner.md` | 1309 | 规划器：任务分解 + 依赖图 + Goal-Backward |
| `agents/gsd-verifier.md` | 581 | 验证器：三级验证 + Stub 检测 + Gap 结构化 |
| `workflows/execute-phase.md` | 459 | 波次编排：依赖分析 + 并行调度 + 失败处理 |
| `workflows/new-project.md` | 1111 | 项目初始化：深度提问 + 研究 + 需求 + 路线图 |
| `references/checkpoints.md` | 776 | 检查点协议：自动化参考 + 反模式 |
| `bin/lib/core.cjs` | 492 | CLI 核心：模型配置表 + 工具函数 |
| `templates/summary.md` | 248 | 摘要模板：依赖图 + 技术追踪 |
| `commands/gsd/discuss-phase.md` | 90 | 讨论命令：灰色区域识别 + 决策捕获 |

---

*研究完成于 2026-03-27，基于 GSD v3.x（最新 main 分支）*
