# Wopal Space Flow — 设计文档

> **Status**: Active
> **Updated**: 2026-05-29
> **Parent Architecture**: `docs/products/wopal-space/DESIGN-wopalspace.md`
> **Parent Product**: `docs/products/wopal-space/PRD-wopalspace.md`

## 0. Change Log

| Date | Type | Summary |
|---|---|---|
| 2026-05-29 | Updated | 对齐 design-project 模板：Header 补充 Parent Architecture、§3 重构为 Key Decisions、§4 重命名为 Module Architecture、§5/§6 重排序、删除 §8 Evolution Roadmap（实施进度归属 Phase 文档）、§9/§10 重编、修正委派工具名。 |
| 2026-05-27 | Updated | 整合原 PRD 的能力范围与渐进式演进路线入本设计文档；按新模板重组章节。 |
| 2026-04-10 | Created | 过渡期系统设计：空间内独立运行、接入空间基础设施、远景收敛路径 |

---

## 1. Project Role

Space Flow 是 WopalSpace 内的候选开发工作流系统，源自 WSF / GSD 的多阶段开发流程能力。当前在空间内独立验证，提供更强的计划、执行和验证机制，解决上下文劣化、任务拆解粗糙、验证流于形式等问题。

Space Flow 当前不属于空间原生工作流内核——它是独立候选路径。若经验证成立，长期目标是将其有效能力吸收为空间原生工作流内核。

| 边界 | 本阶段负责 | 不负责 |
|------|-----------|--------|
| 工作流 | 提供 discuss → plan → execute → verify 完整闭环 | 不要求与 dev-flow 共用状态机 |
| 运行时 | 在 OpenCode 环境下独立运行 | 不承担多 runtime 兼容 |
| 委派 | 优先接入 `wopal_task` 系列工具 | 不自行实现子代理调度基础设施 |
| 状态 | 使用 `.planning` 承载项目执行现场 | 不将 `.planning` 用于空间级长期记忆 |

---

## 2. Capability Scope

| 能力域 | 已落地 | 待建设 |
|--------|--------|--------|
| 工作流骨架 | 多阶段流程、命令/workflow/agent/模板基础结构、`.planning` 目录 | 完整支持 `projects/*` 嵌套项目 |
| 执行编排 | 多 agent 协作框架、波次并行设计、项目状态管理 | 原生接入 `wopal_task` 与空间插件工具 |
| 验证闭环 | 基础执行与验证设计 | Goal-Backward Verification、Stub Detection、Key Links |
| 工程基础 | 独立项目仓库、npm 包、CLI 工具集、测试基础设施 | 明确 `.planning` 与空间文档体系的边界 |
| 空间兼容 | 安装器已处理 OpenCode 路径转换、`findProjectRoot()` 已有子仓库检测 | 空间内真实项目闭环验证 |

---

## 3. Key Decisions

| 决策 | 理由 |
|------|------|
| 过渡期保持 Space Flow 与 dev-flow 双轨独立 | 先验证价值再决定是否整合，避免过早重构 |
| 只面向 OpenCode / 空间场景适配 | 空间当前只需要这一主路径 |
| 保留 `.planning/`，不立即移除 | 它已承载现有工作流状态，强拆会让适配任务升级 |
| 用 `wopal_task` 替代 runtime 阻塞式 subagent 假设 | 空间已有异步委派基础设施，必须吃到它的能力 |
| 长期记忆不放进 `.planning` | 空间已经有 `memory_manage` / `context_manage` |
| 优先导入 Deviation Rules、Goal-Backward、Wave Execution | 这是对 dev-flow 最有差异化价值的能力 |
| 先验证价值，再讨论整合 | 是否走向整合只取决于真实项目对照评估，不预设结论 |
| 优先利用空间基础设施 | `wopal_task`、`memory_manage`、`context_manage` 是已有能力，不重复建设 |
| 渐进式规划 | 每个 Phase 的详细计划在前序 Phase 完成后制定，每一步产生新认知 |

---

## 4. Module Architecture

### 4.1 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                         WopalSpace                            │
├──────────────────────────────────────────────────────────────┤
│  用户 / Wopal                                                │
│      ├── dev-flow（现有独立工作流）                           │
│      └── Space Flow（独立验证中的候选工作流）                 │
│             ├── commands/wsf/*.md                            │
│             ├── wsf/workflows/*.md                           │
│             ├── agents/*.md                                  │
│             ├── wsf/bin/wsf-tools.cjs                        │
│             └── .planning/                                   │
├──────────────────────────────────────────────────────────────┤
│                   Space Infrastructure                        │
│  OpenCode + wopal-plugin + wopal_task + memory/context tools │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 核心模块

| 模块 | 职责 | 消费者 |
|------|------|--------|
| `commands/wsf/*.md` | 工作流入口定义 | 用户 / Wopal |
| `wsf/workflows/*.md` | 编排逻辑 | commands |
| `agents/*.md` | 专用子代理角色 | workflows |
| `wsf/bin/wsf-tools.cjs` | 状态、路径、模板、验证等工具集 | workflows |
| `wsf/bin/lib/` | CLI 工具模块化实现（19 个 domain module） | wsf-tools.cjs |
| `.planning/` | 项目执行现场状态与产物 | workflows / 用户 |
| `bin/install.js` | 多 runtime 安装器 | 用户 |

### 4.3 Agent 模块

WSF 内置 24 个 specialized agent，按职责分五类：

| 类别 | Agent | 职责 |
|------|-------|------|
| Research | project-researcher、phase-researcher、ui-researcher | 域研究、阶段研究、UI 设计合约 |
| Plan | planner、roadmapper | 计划生成、路线图 |
| Execute | executor | 原子提交 + 偏差处理 |
| Verify | plan-checker、verifier、integration-checker | 计划质量、目标达成、跨阶段集成 |
| Support | debugger、codebase-mapper、nyquist-auditor、security-auditor 等 | 调试、映射、测试补齐、安全审计 |

编排模式：thin orchestrator（workflow.md）加载上下文后 spawn 子 agent，每个 agent 获得干净 context window。

---

## 5. Technical Stack Choices

| 技术 | 用途 | 边界 |
|------|------|------|
| Node.js CommonJS | npm 包形态 | 不引入额外 runtime 依赖 |
| OpenCode | 宿主运行时 | 只面向此路径，不兼容多 runtime |
| Markdown commands + workflows + templates | 工作流载体 | 不持有运行时状态 |
| `wopal_task` | 异步子代理调度 | 优先级高于 runtime 原生 Task |
| Git | 项目仓库版本控制 | 不承担空间级分发 |

---

## 6. Interfaces and Contracts

### 6.1 工作流入口

| 接口 | 说明 |
|------|------|
| `/wsf-new-project` | 初始化项目工作流上下文 |
| `/wsf-discuss-phase` | 收集灰区决策 |
| `/wsf-plan-phase` | 生成阶段计划 |
| `/wsf-execute-phase` | 执行计划 |
| `/wsf-verify-work` | 验证交付结果 |

过渡期约束：这些命令保留为 Space Flow 独立入口，不要求与 dev-flow 共用状态机，只保证 OpenCode 路径成立。

### 6.2 委派接口

Space Flow 原始设计假设 runtime 可阻塞式拉起 subagent。过渡期目标接入空间已有的异步委派基础设施：

| 能力 | 接口 | 约定 |
|------|------|------|
| 启动子任务 | `wopal_task` | 返回 task_id，非阻塞 |
| 查询状态/输出 | `wopal_task_output` | summary/text/tools 查询 |
| 回复/纠偏 | `wopal_task_reply` | 恢复等待/空闲中的任务，或中断纠偏 |
| 中止任务 | `wopal_task_abort` | 终止运行中的异步任务 |
| 清理任务 | `wopal_task_finish` | 终止非运行任务并删除会话 |

设计要求：workflow 不能依赖"子代理调用结束即拿到最终结果"；orchestrator 必须支持轮询、汇总和超时处理。

### 6.3 状态存储

`.planning/` 当前结构：

```
.planning/
├── PROJECT.md / REQUIREMENTS.md / ROADMAP.md
├── STATE.md / config.json
├── research/ / phases/
```

职责约束：`.planning/` 承担项目执行现场状态，不承担空间级长期记忆。当前阶段允许 `.planning/` 与空间文档并存，重点是减少冲突而非立即消灭。

### 6.4 路径解析

空间是多项目结构，路径解析必须支持 `projects/*` 嵌套：以当前运行目录、用户指定路径和 `.wopal-space/STRUCTURE.md` 为输入，输出目标项目根目录和 `.planning/` 位置，不能假设当前目录就是单项目根。

---

## 7. Data and State Model

| 状态 | 位置 | 说明 |
|------|------|------|
| 产品源码 | `projects/space-flow/` | Space Flow 项目仓库 |
| 产品文档 | `projects/space-flow/docs` | DESIGN / plans |
| 项目现场状态 | `<target-project>/.planning/` | 目标项目执行状态 |
| 研究文档 | `projects/spec-flow/docs/research` | GSD / WSF 研究资料 |

长期记忆由 `memory_manage` 承载，`.planning/` 不重复建设。

---

## 8. Related Documents

| 文档 | 说明 |
|------|------|
| `docs/products/wopal-space/PRD-wopalspace.md` | WopalSpace 整体愿景与阶段 |
| `docs/products/wopal-space/DESIGN-wopalspace.md` | WopalSpace 总体架构 |
| `docs/research/spec-flow/gsd-analysis.md` | GSD 差异化价值研究 |
| `projects/space-flow/AGENTS.md` | Space Flow 当前工程结构与规范 |
