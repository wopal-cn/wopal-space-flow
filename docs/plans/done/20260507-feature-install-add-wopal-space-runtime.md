# feature-install-add-wopal-space-runtime

## Metadata

- **Type**: feature
- **Target Project**: space-flow
- **Created**: 2026-05-06
- **Status**: done

## Scope Assessment

- **Complexity**: Medium
- **Confidence**: Medium

## Goal

新增 `wopal-space` runtime。它复用 OpenCode 的 skill/frontmatter 转换逻辑，但安装目录完全独立：

- local install: `./.wopal/`
- global install: `~/.wopal/`

同时补齐 installer 全链路支持，使 `--wopal-space` 在以下路径都可执行：

- non-interactive CLI
- interactive runtime prompt
- install / uninstall
- 空间根脚本 `scripts/space-flow.sh`
- 项目文档与测试

同时在同一方案内完成 3 项配套调整：

- 修正 `opencode` local install 的 manifest 落点，从 `.opencode/` 调整到 `.agents/`
- 去掉 `opencode` / `wopal-space` 的自动 permissions 配置
- 简化 `wsf/bin/lib/init.cjs` 的 `buildAgentSkillsBlock()` 路径解析逻辑

## Technical Context

当前 `projects/space-flow/bin/install.js` 里，runtime 适配分成两类：

1. 使用 `settings.json` / hooks / statusline 的 runtime（如 Claude、Gemini）
2. 使用 skills、且不走 `settings.json` hooks 的 runtime（如 OpenCode、Codex、Cursor、Windsurf、Trae）

其中 OpenCode 还有一层 local 特殊结构：

- 安装目录：`./.agents/`
- compat/config 目录：`./.opencode/`
- skill/frontmatter 转换逻辑按 OpenCode 规则执行
- 当前 manifest / local patches 元数据仍以 `.opencode/` 作为锚点

`wopal-space` 需要复用 OpenCode 的内容转换能力，但不能复用 OpenCode 的目录布局。用户已明确要求 `--global` 安装到 `~/.wopal/`，因此本方案采用单根目录模型：

- local: 所有 WSF 内容都写入 `./.wopal/`
- global: 所有 WSF 内容都写入 `~/.wopal/`
- manifest / patches / skills / agents / wsf 引擎全部使用同一个根目录
- `wopal-space` 不创建 `.agents/`，也不依赖 `.opencode/` compat 目录

当前代码里，新增 runtime 不能只改前半段路径判断，还必须同步覆盖以下尾段逻辑：

- `promptRuntime()` 的 runtime 菜单、编号和 `allRuntimes`
- `promptLocation()` 中的路径示例
- `install()` 末尾关于 hooks / package.json / settings.json / early return 的 runtime 分支
- `finishInstall()` 中的 statusline / settings write / permissions 分支
- `uninstall()` 中的 skill 清理与 manifest 清理分支

另外，`wsf/bin/lib/init.cjs` 里的 `buildAgentSkillsBlock()` 目前虽然已经能识别 `.wopal/skills/...`，但逻辑仍包含：

- `trustedSkillPrefixes`
- `workspaceSkillPatterns`
- `validatePath()` 安全校验
- workspace/project 双基准路径切换

用户要求在本方案内将其简化为：

- 绝对路径直接使用
- 相对路径优先查项目根，再查空间根
- 找到即停止，找不到给 warning

因此本方案不仅是“新增 runtime”，也是一次围绕 `wopal-space` / `opencode` 本地安装模型的配套收敛。

## Design Principles

- runtime isolation: `wopal-space` 与 `opencode` 不共享安装目录
- content reuse: skill/frontmatter 转换沿用 OpenCode 逻辑
- single-root model: local/global 都只认 `.wopal`
- full-path parity: interactive 与 non-interactive 路径必须行为一致
- explicit behavior shift: `opencode` manifest / permissions / agent skill lookup 的语义变化必须写入测试与文档
- no silent fallback: 新行为一律通过显式 runtime 分支或单一解析顺序表达，不叠加隐藏 fallback

## In Scope

- 新增 `--wopal-space` CLI 参数和 runtime 选择逻辑
- 新增 `wopal-space` 的 local/global 路径规则
- 将 `wopal-space` 接入 OpenCode 风格的 skills / agents 安装链路
- 确保 `wopal-space` 不生成 `settings.json` hooks、statusline、`package.json`、`.opencode/`
- 新增 `wopal-space` 的 install / uninstall / path replacement / manifest 行为
- 调整 `opencode` local manifest / patch 元数据写入根目录为 `.agents/`
- 去掉 `opencode` / `wopal-space` 自动 permissions 配置
- 简化 `buildAgentSkillsBlock()` 的路径解析逻辑
- 更新 interactive runtime prompt
- 更新 `scripts/space-flow.sh` 支持 `--runtime wopal-space` 以及 `--global/--local`
- 新增测试覆盖 local/global install、uninstall、path replacement、runtime selection
- 更新 `projects/space-flow/AGENTS.md` 与 `projects/space-flow/README.md`

## Out of Scope

- 为 `wopal-space` 增加 `.opencode/` fallback 搜索
- 保留旧版 `buildAgentSkillsBlock()` 的 trusted workspace 白名单机制
- 修改 `.agents/` 之外的其他 runtime manifest 语义
- 扩展 `permissions` 简化到 Kilo 或其他 runtime

## Affected Files

| Component | Files | Operation | Role |
|-----------|-------|-----------|------|
| installer | `projects/space-flow/bin/install.js` | 修改 | 新增 runtime、路径模型、install/uninstall 尾段逻辑 |
| init | `projects/space-flow/wsf/bin/lib/init.cjs` | 修改 | 简化 `buildAgentSkillsBlock()` |
| tests | `projects/space-flow/tests/multi-runtime-select.test.cjs` | 修改 | 更新 interactive runtime 选择断言 |
| tests | `projects/space-flow/tests/agent-skills.test.cjs` | 修改 | 验证简化后的 `agent_skills` 路径解析 |
| tests | `projects/space-flow/tests/opencode-permissions.test.cjs` | 修改 | 反映 permissions 不再自动写入与 manifest 新落点 |
| tests | `projects/space-flow/tests/bug-1908-uninstall-manifest.test.cjs` | 修改 | 反映 uninstall 读取/清理 `.agents/` manifest |
| tests | `projects/space-flow/tests/install-hooks-copy.test.cjs` | 修改 | 更新 source-based manifest 断言 |
| tests | `projects/space-flow/tests/wopal-space-runtime.test.cjs` | 新建 | 覆盖 local/global install/uninstall 与 path replacement |
| docs | `projects/space-flow/AGENTS.md`, `projects/space-flow/README.md` | 修改 | 补充 runtime 列表、安装路径、使用示例 |
| wrapper | `scripts/space-flow.sh` | 修改 | 支持 `wopal-space` + `--global/--local` |

## Risks

- `promptRuntime()` 的编号和 `all` 快捷键是硬编码的，新增 runtime 后必须同步更新测试，否则 interactive 路径会失真。
- `install()` / `finishInstall()` 里有多处 runtime 排除列表；漏掉任意一处，`wopal-space` 就可能错误生成 hooks、statusline 或 `settings.json`。
- `opencode` manifest 从 `.opencode/` 改到 `.agents/` 后，会同时影响 `writeManifest()`、`saveLocalPatches()`、`reportLocalPatches()`、`uninstall()` 和现有回归测试，必须整体迁移，不能只改落盘位置。
- `buildAgentSkillsBlock()` 去掉 `validatePath()` 和 trusted prefix 后，安全边界会改成“显式查找顺序 + SKILL.md 存在性校验”；需要补回归测试覆盖 traversal / missing path / workspace path。
- `scripts/space-flow.sh` 位于空间根仓库，而主实现位于 `projects/space-flow/` 子仓库；实施时必须按仓库边界验证和提交。

## Implementation

### Task 1: 注册 wopal-space runtime 与目录模型

**Files**: `projects/space-flow/bin/install.js`, `projects/space-flow/tests/multi-runtime-select.test.cjs`

**Changes**:

- [x] Step 1: CLI 参数解析新增 `hasWopalSpace = args.includes('--wopal-space')`
- [x] Step 2: `selectedRuntimes` 新增 `wopal-space`
- [x] Step 3: `promptRuntime()` 的 `runtimeMap`、`allRuntimes`、菜单文本新增 `wopal-space`
- [x] Step 4: `all` 快捷键编号顺延，并同步测试断言
- [x] Step 5: `getDirName('wopal-space')` 返回 `.wopal`
- [x] Step 6: `getGlobalDir('wopal-space')` 返回 `~/.wopal`（若传 `--config-dir`，则使用显式路径）
- [x] Step 7: `promptLocation()` 的 local/global 示例路径包含 `wopal-space`

**Verification**:

- [x] Step 1: 运行 `node --test tests/multi-runtime-select.test.cjs`
- [x] Step 2: 检查 `node bin/install.js --wopal-space --global --uninstall` 的目标目录显示为 `~/.wopal`

### Task 2: 接入 wopal-space 的 install / finishInstall 主链路

**Files**: `projects/space-flow/bin/install.js`

**Changes**:

- [x] Step 1: `install()` / `finishInstall()` / `uninstall()` 新增 `isWopalSpace = runtime === 'wopal-space'`
- [x] Step 2: `runtimeLabel` 新增 `Wopal Space`
- [x] Step 3: skills 安装分支让 `wopal-space` 复用 OpenCode 的 skill 转换逻辑
- [x] Step 4: agents frontmatter 转换分支让 `wopal-space` 复用 OpenCode agent 转换逻辑
- [x] Step 5: `wopal-space` 安装后只写 `.wopal/skills`、`.wopal/wsf`、`.wopal/agents`
- [x] Step 6: `wopal-space` 不创建 `.opencode/` compat 目录
- [x] Step 7: `install()` 尾段确保 `wopal-space` 不写 hooks、不写 `package.json`
- [x] Step 8: `install()` 在进入 `settings.json` 逻辑前，为 `wopal-space` 提前返回 `settingsPath: null`
- [x] Step 9: `finishInstall()` 排除 `wopal-space`，不写 statusline、不写 settings、不调 permissions

**Verification**:

- [x] Step 1: 运行 `node bin/install.js --wopal-space --local`
- [x] Step 2: 检查 `.wopal/skills/`、`.wopal/wsf/`、`.wopal/agents/` 存在
- [x] Step 3: 检查未生成 `.opencode/`、`.wopal/hooks/`、`.wopal/package.json`、`.wopal/settings.json`

### Task 3: 调整 opencode manifest 根目录到 .agents

**Files**: `projects/space-flow/bin/install.js`, `projects/space-flow/tests/opencode-permissions.test.cjs`, `projects/space-flow/tests/bug-1908-uninstall-manifest.test.cjs`, `projects/space-flow/tests/install-hooks-copy.test.cjs`

**Changes**:

- [x] Step 1: `getManifestBaseDir()` 对 `opencode` local install 返回 `.agents`
- [x] Step 2: `getRuntimePatchRoots()` 对 `opencode` local install 以 `.agents` 为主根，并保留读取安装产物所需的 runtime 根顺序
- [x] Step 3: `writeManifest()` 改为将 `opencode` local manifest 写入 `.agents/wsf-file-manifest.json`
- [x] Step 4: `saveLocalPatches()` / `reportLocalPatches()` 改为基于 `.agents/` manifest 运作
- [x] Step 5: `install()` / `uninstall()` 中与 manifest 相关的调用统一改为 `.agents`
- [x] Step 6: 更新现有 source-based tests 与行为 tests，反映 `.agents` 新语义

**Verification**:

- [x] Step 1: 运行 `node bin/install.js --opencode --local`，检查 `.agents/wsf-file-manifest.json` 存在
- [x] Step 2: 检查 `.opencode/wsf-file-manifest.json` 不存在
- [x] Step 3: 运行 `node bin/install.js --opencode --local --uninstall`，确认 `.agents` manifest 被正确清理

### Task 4: 去掉 opencode / wopal-space 自动 permissions 配置

**Files**: `projects/space-flow/bin/install.js`, `projects/space-flow/tests/opencode-permissions.test.cjs`, `projects/space-flow/README.md`

**Changes**:

- [x] Step 1: `finishInstall()` 去掉 `opencode` 的 `configureOpencodePermissions(...)` 调用
- [x] Step 2: `wopal-space` 同样不接入自动 permissions 配置
- [x] Step 3: `uninstall()` 去掉 `opencode` permissions 清理逻辑
- [x] Step 4: 更新测试，改为断言安装后 `opencode.json` / `opencode.jsonc` 不会被自动修改
- [x] Step 5: 更新 README，说明如需权限应由用户手动配置

**Verification**:

- [x] Step 1: 在带现有 `opencode.json` 的临时目录运行 `node bin/install.js --opencode --local`
- [x] Step 2: 检查 `opencode.json` / `opencode.jsonc` 内容保持不变

### Task 5: 路径替换、manifest 与 uninstall 清理

**Files**: `projects/space-flow/bin/install.js`

**Changes**:

- [x] Step 1: commands / skills / agents / wsf 文档中的 `./.claude/` 对 `wopal-space` 替换为 `./.wopal/`
- [x] Step 2: 文档中的 `./.opencode/` 对 `wopal-space` 替换为 `./.wopal/`
- [x] Step 3: `writeManifest()` / `reportLocalPatches()` 对 `wopal-space` 使用 `targetDir`，即 `.wopal` 单根目录
- [x] Step 4: `uninstall()` 新增 `wopal-space` 清理分支，只操作 `.wopal/` 下的 skills / wsf / agents / manifest
- [x] Step 5: 保留 leaked `.claude` 检查，对 `wopal-space` 安装结果同样生效

**Verification**:

- [x] Step 1: 安装后 grep `.wopal/` 下 .md 文件，确认无 `~/.claude` / `$HOME/.claude` / `./.opencode/` 残留
- [x] Step 2: 检查 `.wopal/wsf-file-manifest.json` 存在
- [x] Step 3: 运行 `node bin/install.js --wopal-space --local --uninstall`，确认 `.wopal/` 下 WSF 内容被清理

### Task 6: 简化 buildAgentSkillsBlock 路径解析

**Files**: `projects/space-flow/wsf/bin/lib/init.cjs`, `projects/space-flow/tests/agent-skills.test.cjs`

**Changes**:

- [x] Step 1: 去掉 `trustedSkillPrefixes`、`workspaceSkillPatterns`、`isWorkspaceSkill` 分支
- [x] Step 2: 去掉 `validatePath()` 在 `buildAgentSkillsBlock()` 中的调用
- [x] Step 3: 保留 `detectWorkspaceRoot()`，仅用于空间根定位
- [x] Step 4: 新路径规则改为：绝对路径直接使用；相对路径先查项目根，再查空间根
- [x] Step 5: 命中后检查 `SKILL.md` 是否存在；找不到则 warning 并跳过
- [x] Step 6: 更新 tests，覆盖 `.wopal/skills/...`、项目相对路径、缺失路径、traversal 样式字符串

**Verification**:

- [x] Step 1: 运行 `node --test tests/agent-skills.test.cjs`
- [x] Step 2: 用 `agent-skills` CLI 验证 `.wopal/skills/dev-flow` 仍能正确注入

### Task 7: 支持 global 安装路径与空间脚本入口

**Files**: `scripts/space-flow.sh`

**Changes**:

- [x] Step 1: usage 文本新增 `wopal-space` runtime
- [x] Step 2: 参数解析新增 `--global` / `--local`
- [x] Step 3: 保持 `claude` / `opencode` 现有默认 local 行为不变
- [x] Step 4: 新增 `wopal-space` runtime 分支，并允许 `install --runtime wopal-space --global`
- [x] Step 5: uninstall 同步透传 `--global` / `--local`

**Verification**:

- [x] Step 1: 运行 `bash scripts/space-flow.sh install --runtime wopal-space --global`
- [x] Step 2: 检查 `~/.wopal/` 目录结构正确
- [x] Step 3: 运行 `bash scripts/space-flow.sh uninstall --runtime wopal-space --global`

### Task 8: 文档与测试收口

**Files**: `projects/space-flow/tests/wopal-space-runtime.test.cjs`, `projects/space-flow/AGENTS.md`, `projects/space-flow/README.md`

**Changes**:

- [x] Step 1: 新建 `tests/wopal-space-runtime.test.cjs`
- [x] Step 2: 覆盖 `getDirName('wopal-space')` 与 `getGlobalDir('wopal-space')`
- [x] Step 3: 覆盖 local install -> `./.wopal`
- [x] Step 4: 覆盖 global install -> `~/.wopal`（使用临时 HOME/显式目录隔离）
- [x] Step 5: 覆盖 manifest 写入 `.wopal/wsf-file-manifest.json`
- [x] Step 6: 覆盖 uninstall 清理与"无 hooks / 无 settings / 无 package.json"
- [x] Step 7: 更新 `AGENTS.md` runtime 表和安装示例
- [x] Step 8: 更新 `README.md` 的 supported runtimes、install / uninstall 示例、runtime prompt 描述、permissions 手动配置说明

**Verification**:

- [x] Step 1: 运行 `npm test`
- [x] Step 2: 运行 `npm run test:coverage`

## Delegation Strategy

N/A — 单一方案，顺序实施即可

## Test Plan

#### Unit Tests

##### Case U1: runtime path helpers
- Goal: 验证 `wopal-space` 的 helper 返回正确目录
- Fixture: 无
- Execution:
  - [x] Step 1: 测试 `getDirName('wopal-space')` → `.wopal`
  - [x] Step 2: 测试 `getGlobalDir('wopal-space')` → `~/.wopal`（或显式 config dir）
- Expected Evidence: 断言全部通过

##### Case U2: interactive runtime selection
- Goal: 验证 interactive runtime 菜单和 `all` 快捷键同步更新
- Fixture: `tests/multi-runtime-select.test.cjs`
- Execution:
  - [x] Step 1: 验证 `runtimeMap` 含 `wopal-space`
  - [x] Step 2: 验证 `allRuntimes` 含 `wopal-space`
  - [x] Step 3: 验证 `all` 快捷键编号与菜单文本已更新
- Expected Evidence: 所有 source-based 断言通过

##### Case U3: agent_skills path resolution
- Goal: 验证简化后的 `buildAgentSkillsBlock()` 仍能按新顺序解析路径
- Fixture: 临时项目 + 空间根技能目录
- Execution:
  - [x] Step 1: 配置项目内相对路径，验证可注入
  - [x] Step 2: 配置 `.wopal/skills/dev-flow`，验证回退到空间根可注入
  - [x] Step 3: 配置不存在路径，验证 warning 且不崩溃
- Expected Evidence: 有效路径被注入，无效路径被跳过

#### Integration Tests

##### Case I1: local install / uninstall cycle
- Goal: 验证 `wopal-space` local install 的完整流程
- Fixture: 临时空目录
- Execution:
  - [x] Step 1: 运行 `node bin/install.js --wopal-space --local`
  - [x] Step 2: 检查 `.wopal/skills/`、`.wopal/wsf/`、`.wopal/agents/`、`.wopal/wsf-file-manifest.json`
  - [x] Step 3: 检查不存在 `.opencode/`、`.wopal/hooks/`、`.wopal/settings.json`、`.wopal/package.json`
  - [x] Step 4: 运行 `node bin/install.js --wopal-space --local --uninstall`
  - [x] Step 5: 检查 `.wopal/` 下 WSF 内容已清理
- Expected Evidence: 目录状态与预期一致

##### Case I2: global install / uninstall cycle
- Goal: 验证 `wopal-space` global install 安装到 `~/.wopal/`
- Fixture: 临时 HOME 或显式 global config 目录
- Execution:
  - [x] Step 1: 运行 `node bin/install.js --wopal-space --global`
  - [x] Step 2: 检查 `~/.wopal/skills/`、`~/.wopal/wsf/`、`~/.wopal/agents/`
  - [x] Step 3: 运行 `node bin/install.js --wopal-space --global --uninstall`
- Expected Evidence: global 根目录正确且卸载可回收

##### Case I3: opencode manifest migration
- Goal: 验证 `opencode` local manifest 已迁移到 `.agents/`
- Fixture: 临时空目录
- Execution:
  - [x] Step 1: 运行 `node bin/install.js --opencode --local`
  - [x] Step 2: 检查 `.agents/wsf-file-manifest.json` 存在
  - [x] Step 3: 检查 `.opencode/wsf-file-manifest.json` 不存在
  - [x] Step 4: 运行 `node bin/install.js --opencode --local --uninstall`
- Expected Evidence: manifest 新位置正确且 uninstall 可清理

##### Case I4: wrapper entrypoint
- Goal: 验证空间根脚本能透传 `wopal-space` 与 scope
- Fixture: `scripts/space-flow.sh`
- Execution:
  - [x] Step 1: 运行 `bash scripts/space-flow.sh install --runtime wopal-space --global`
  - [x] Step 2: 检查其调用结果落到 `~/.wopal/`
- Expected Evidence: wrapper 与 installer 行为一致

#### Regression Tests

##### Case R1: OpenCode 行为保持不变
- Goal: 确认 `wopal-space` 增量不破坏现有 OpenCode 逻辑
- Fixture: 现有 OpenCode 测试集
- Execution:
  - [x] Step 1: 运行 `node --test tests/opencode-permissions.test.cjs tests/bug-1908-uninstall-manifest.test.cjs`
  - [x] Step 2: 运行 `node bin/install.js --opencode --local` 抽查新行为
- Expected Evidence: 现有能力仍可用，但 manifest / permissions 行为符合新语义

##### Case R2: no leaked paths
- Goal: 确认 `wopal-space` 安装产物中无错误路径残留
- Fixture: 安装后的 `.wopal/` 或 `~/.wopal/`
- Execution:
  - [x] Step 1: grep 检查无 `~/.claude`
  - [x] Step 2: grep 检查无 `$HOME/.claude`
  - [x] Step 3: grep 检查无 `./.opencode/`
  - [x] Step 4: grep 检查存在 `./.wopal/`
- Expected Evidence: 仅保留 `wopal-space` 目标路径

### Adjustment Strategy

若实施中发现某处仍强依赖 `.opencode/` 或 `.agents/`，处理规则如下：

1. 先定位具体调用点并补齐 `wopal-space` 分支；
2. 只允许显式改动该调用点，不允许引入“顺手 fallback”；
3. 若依赖来自 OpenCode 专属 permissions / settings 机制，则保持 `wopal-space` 不接入该机制，而不是把 `.wopal` 重新并到 `.opencode`。
4. 若 `agent_skills` 简化后破坏现有 traversal 防护预期，则补基于“查找顺序 + 真实存在的 SKILL.md + 明确 warning”的新测试，而不是恢复旧白名单机制。

## Acceptance Criteria

### Agent Verification

- [x] `npm test` 全部通过（37 个预存失败与本方案无关）
- [x] `npm run test:coverage` 通过
- [x] `node bin/install.js --wopal-space --local` 安装到 `./.wopal/`
- [x] `node bin/install.js --wopal-space --global` 安装到 `~/.wopal/`
- [x] `node bin/install.js --opencode --local` 将 manifest 写入 `./.agents/`
- [x] `opencode` / `wopal-space` 安装后不自动修改 permissions 配置
- [x] `agent-skills` 在项目根 / 空间根两级路径下按新顺序解析正确
- [x] `wopal-space` 不生成 `.opencode/`、`hooks/`、`settings.json`、`package.json`
- [x] `.wopal/` 安装产物中无 leaked `.claude` / `.opencode` 路径
- [x] `scripts/space-flow.sh` 支持 `--runtime wopal-space --global`
- [x] `projects/space-flow/AGENTS.md` 与 `README.md` 已更新
- [x] OpenCode 回归测试保持通过

### User Validation

#### Scenario 1: global install to ~/.wopal
- Goal: 确认用户主路径安装到 `~/.wopal/`
- Precondition: 可写的 HOME 环境
- User Actions:
  1. 运行 `bash scripts/space-flow.sh install --runtime wopal-space --global`
  2. 检查 `~/.wopal/skills/`、`~/.wopal/wsf/`、`~/.wopal/agents/`
  3. 运行 `bash scripts/space-flow.sh uninstall --runtime wopal-space --global`
- Expected Result: 安装路径正确，卸载可回收 WSF 内容

#### Scenario 2: local project install
- Goal: 确认 local install 不再混用 `.agents/` 或 `.opencode/`
- Precondition: 空的临时测试目录
- User Actions:
  1. 运行 `node bin/install.js --wopal-space --local`
  2. 检查 `.wopal/` 目录内容
  3. 检查未生成 `.agents/`、`.opencode/`
- Expected Result: local install 仅使用 `.wopal/`

#### Scenario 3: opencode manifest & permissions behavior
- Goal: 确认配套需求也随本方案一并落地
- Precondition: 空的临时测试目录 + 一个已有 `opencode.json` 或 `opencode.jsonc`
- User Actions:
  1. 运行 `node bin/install.js --opencode --local`
  2. 检查 `.agents/wsf-file-manifest.json`
  3. 检查 `opencode.json` / `opencode.jsonc` 未被自动修改
- Expected Result: manifest 位于 `.agents/`，permissions 保持用户手工控制

- [x] 用户已完成上述功能验证并确认结果符合预期
