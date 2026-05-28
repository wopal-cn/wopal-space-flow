# Business Rules — space-flow

> 定位: 业务规则的单一真相源。技术规则归 AGENTS.md。

---

## 工作流生命周期

### BR-001 四阶段闭环必须完整执行 `active`
任何项目开发任务必须经过 discuss → plan → execute → verify 四个阶段的完整闭环，不允许跳过任一阶段。

### BR-002 每个阶段必须先讨论后规划 `active`
进入 plan 之前必须经过 discuss 阶段收集灰区决策，减少执行期返工。

### BR-003 渐进式规划：只对下一步做详细规划 `active`
当前阶段的详细规划仅在前序阶段完成后制定，后续阶段只做方向性描述。

## 阶段编号与命名

### BR-004 阶段编号全局连续递增 `active`
整数阶段编号在当前里程碑内连续递增，不允许出现编号空缺。删除阶段后必须重新编号后续阶段。

### BR-005 999.x 专用于 backlog 停放区 `active`
编号 999 及其小数变体（999.1、999.2 等）保留给 backlog 条目，不参与正常阶段序列的递增和重编号。

### BR-006 插入阶段使用小数编号 `active`
在两个现有阶段之间插入紧急工作时，使用小数编号（如 6.1 插入在 6 和 7 之间），后续同级小数阶段自动重编号。

### BR-007 阶段编号上限为 99 `active`
整数阶段编号最大值为 99。此上限约束了重编号循环的范围。

## 计划（Plan）

### BR-008 每个 Plan 必须包含 XML 结构化任务 `active`
Plan 文件必须使用 `<task>` 元素定义任务，每个任务至少包含 `<name>` 和 `<action>` 子元素。

### BR-009 Plan frontmatter 必须声明必填字段 `active`
Plan 文件的 YAML frontmatter 必须包含：phase、plan、type、wave、depends_on、files_modified、autonomous、must_haves。缺少任一字段视为无效 Plan。

### BR-010 Wave > 1 的 Plan 必须声明依赖 `active`
当 Plan 的 wave 大于 1 时，depends_on 不能为空。并行编排要求显式声明前置依赖。

### BR-011 包含 checkpoint 任务的 Plan 必须设 autonomous=false `active`
当 Plan 中存在 type="checkpoint" 的任务时，autonomous 必须为 false，以确保人工介入。

### BR-012 每个 Plan 必须有对应的 SUMMARY 才算完成 `active`
Plan 的完成标志是对应 SUMMARY.md 的存在。Plan 没有配套 SUMMARY 视为未完成。

## 验证（Verify）

### BR-013 SUMMARY 验证必须检查文件存在性和自检结果 `active`
SUMMARY.md 验证至少包括：引用的文件是否实际存在、commit hash 是否有效、Self-Check 章节是否通过。

### BR-014 阶段完整性要求 Plan 与 SUMMARY 一一对应 `active`
每个阶段目录中，PLAN.md 文件必须有对应的 SUMMARY.md。存在 SUMMARY 但没有 PLAN 视为孤儿产物并产生警告。

### BR-015 Goal-Backward 验证：交付物必须回溯到目标 `active`
验证阶段不能只检查"文件已创建"，必须确认实际产出能回溯到阶段 Goal 和 Success Criteria。

### BR-016 Key Links 验证：模块间引用必须连通 `active`
Plan 的 must_haves.key_links 中声明的模块间引用关系必须在实际代码中得到验证（通过 pattern 匹配或引用检查）。

## 项目状态管理

### BR-017 .planning/ 是项目执行现场的唯一状态载体 `active`
所有项目工作流状态存储在 `.planning/` 目录中，包含 PROJECT.md、ROADMAP.md、STATE.md、config.json 和 phases/ 子目录。

### BR-018 .planning/ 写操作必须通过文件锁串行化 `active`
并发写入 `.planning/` 文件时必须获取文件锁。锁超时为 10 秒，超过 30 秒的陈旧锁自动回收。

### BR-019 STATE.md 跟踪当前工作位置 `active`
STATE.md 必须维护当前阶段（Phase）、当前计划（Plan）、里程碑版本等关键字段，作为工作流进度指针。

## 多项目空间支持

### BR-020 空间根目录不被当作项目根 `active`
当工作空间根目录存在 `projects/` 但不存在 `.planning/` 时，关键命令（new-project、plan-phase、execute-phase 等）必须要求显式项目参数，禁止默认把工作空间根目录当作项目根。

### BR-021 子仓库通过 .planning/config.json 的 sub_repos 声明 `active`
多仓库项目通过 `config.json` 的 `sub_repos` 字段声明子仓库列表。列表与文件系统自动同步：检测到新的子仓库目录时自动加入。

### BR-022 项目根解析优先使用 .planning/ 定位 `active`
findProjectRoot 优先检测 `.planning/config.json` 中的 sub_repos 显式声明，其次使用 `.git` 启发式检测。不假设当前目录就是项目根。

## 模型与 Agent 分配

### BR-023 模型配置有三档 profile `active`
model_profile 支持四个合法值：quality、balanced、budget、inherit。每个 agent 根据当前 profile 查表获取对应模型。

### BR-024 子代理超时默认 5 分钟 `active`
subagent_timeout 默认 300,000ms（5 分钟）。大型代码库或慢模型可调高。此值注入到所有 init 输出中供工作流使用。

## 路线图（Roadmap）

### BR-025 路线图必须同时包含概览清单和详情章节 `active`
ROADMAP.md 中每个阶段必须同时存在于概览清单（`- [ ] **Phase N: Name**`）和详情章节（`### Phase N: Name`），缺一视为 malformed_roadmap。

### BR-026 里程碑归档后阶段不可变 `active`
已归档里程碑（shipped）的阶段定义不再参与当前里程碑的解析和操作。

## 安装与部署

### BR-027 WopalSpace runtime 使用单根目录模型 `active`
wopal-space runtime 安装时，skills、wsf、agents、manifest 全部部署在同一目录下（local 为 `./.wopal/`，global 为 `~/.wopal/`）。不创建 `.opencode/`、`.agents/`、`hooks/` 等辅助目录。

### BR-028 禁止在子项目目录内执行 local 安装 `active`
在子项目目录（如 `projects/space-flow/`）内执行 `--local` 安装会导致 WSF 被部署到错误位置。安装必须从目标目录执行。

## 文档输出

### BR-029 文档输出语言可配置 `active`
所有生成文档的命令和工作流支持 `--lang <code>` 参数。语言决策链：显式参数 → 上下文推断 → 默认英文。技术术语和代码标识符保持英文。

### BR-030 JSON 输出超过 50KB 必须写临时文件 `active`
当 CLI 工具的 JSON 输出超过 50,000 字节时，必须写入临时文件并输出 `@file:` 前缀路径，避免截断。

### BR-031 临时文件 5 分钟后自动清理 `active`
wsf-* 前缀的临时文件和目录超过 5 分钟未修改时，在下一次临时文件写入前自动清理。

## 安全

### BR-032 工作流和项目名禁止路径穿越字符 `active`
WSF_PROJECT 和 WSF_WORKSTREAM 的值禁止包含 `/`、`\`、`..` 等路径穿越字符，防止目录遍历攻击。

### BR-033 禁止提交敏感配置 `active`
`.env`、API 密钥、用户配置文件禁止提交到版本控制。

## 评估与整合

### BR-034 整合判断必须通过三项独立验证 `active`
Space Flow 是否整合为空间原生工作流内核，必须同时满足：(1) 比 dev-flow 更强；(2) 能被空间稳定承载；(3) 值得维护和迁移成本。三项中任一不成立则不整合。

### BR-035 渐进式实施：随时可以停下 `active`
每个 Phase 完成后都可以决定终止。不沉没成本，不做不可逆的架构承诺。
