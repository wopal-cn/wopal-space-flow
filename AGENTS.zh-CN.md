---
name: Space Flow AGENT RULES
description: WSF — meta-prompting and spec-driven development system for AI coding tools
---

# Agent Development Rules

## 1. Canonical References

- PRD: `docs/products/wopal-space/PRD-wopalspace.md`
- DESIGN: `projects/space-flow/docs/DESIGN.md`
- Business Rules: `projects/space-flow/docs/BUSINESS_RULES.md`

## 2. Architecture and Directories

WSF 通过安装器将命令、Agent、工作流和 hooks 部署到目标 AI coding 工具目录。运行时链：`/wsf-xxx` 命令 → workflow 编排 → spawn 子 agent → `wsf-tools.cjs` 处理状态/配置/git → `.planning/` 持久化。

| 目录 | 职责 |
|---|---|
| `bin/install.js` | 多 runtime 安装器，处理 runtime 检测、文件复制、配置注入 |
| `commands/wsf/` | 用户入口命令（30+），YAML frontmatter + process 定义 |
| `wsf/workflows/` | 编排逻辑，thin orchestrator 模式：加载上下文 → spawn agent → 收集结果 |
| `agents/` | 24 个 specialized agent 定义，按职责分 Research / Plan / Execute / Verify / Support 五类 |
| `wsf/bin/` | CLI 工具集：`wsf-tools.cjs` + 19 个 lib 模块（state/config/phase/roadmap 等） |
| `wsf/templates/` | 文档模板（PROJECT/ROADMAP/PLAN/SUMMARY 等） |
| `wsf/references/` | 共享知识文档（35+），供 workflow 和 agent `@-reference` |
| `hooks/` | Runtime hooks：状态栏、上下文监控、prompt guard 等 |
| `tests/` | Node.js 内置 test runner 测试文件 |

## 3. Development Commands

| 场景 | 命令 | 时机 |
|---|---|---|
| 构建 hooks | `npm run build:hooks` | hooks 源码变更后 |
| 运行测试 | `npm test` | 任何代码变更后 |
| 测试 + 覆盖率 | `npm run test:coverage` | 提 PR 前 |

安装验证（从空间根目录执行）：

```bash
node projects/space-flow/bin/install.js --wopal-space --local
# 卸载：加 --uninstall
```

禁止在子项目目录内执行 `--local` 安装。

## 4. Implementation Rules

- 核心代码纯 Node.js CommonJS（`.cjs`），无 TypeScript、无 bundler。hooks 例外：esbuild 打包，`prepublishOnly` 自动触发 `build:hooks`。
- 安装器纯 JS，零外部依赖。测试单文件，不依赖测试框架。
- 多 runtime 支持：安装器在 install-time 完成命令/agent 格式转换、路径映射和 hook 适配。workflow 和 agent 以 Claude Code 原生格式编写，installer 负责 transform。
- WopalSpace 多项目空间：关键入口命令支持项目参数（如 `/wsf-new-project space-flow`），解析为 `projects/<name>/`。路径解析责任在 `wsf-tools.cjs` init 层，workflow 不自猜项目根。
- WopalSpace runtime：单根目录模型（`skills/`、`wsf/`、`agents/` 共处同一目录），不创建 `.opencode/`、`settings.json`、`package.json`。
- `--lang <code>` 参数：所有生成文档的命令/workflow/agent 必须支持。决策链：参数 → 上下文推断（USER.md）→ 默认英文。技术术语、文件路径、命令保持英文。
- 安全红线：禁止提交 `.env`、API 密钥、用户配置。禁止修改上游命令/Agent 的核心逻辑，除非有明确理由。
- 涉及项目根解析、多项目空间支持、`--cwd` 透传时，至少更新 `tests/core.test.cjs`、`tests/init.test.cjs`、`tests/dispatcher.test.cjs`。

## 5. Testing

- 遵循 TDD：先写失败测试，再实现代码使其通过。
- 框架：Node.js 内置 test runner（`--test`），文件命名 `tests/*.test.cjs`。
- 覆盖率：c8，阈值 70% lines，覆盖 `wsf/bin/lib/*.cjs`。
- 跨平台运行器：`scripts/run-tests.cjs`。

## 6. User-Supplied Rules

