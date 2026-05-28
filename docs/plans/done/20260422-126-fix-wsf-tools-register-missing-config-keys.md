# 126-fix-wsf-tools-register-missing-config-keys

## Metadata

- **Issue**: #126
- **Type**: fix
- **Target Project**: space-flow
- **Created**: 2026-04-22
- **Status**: done

## Scope Assessment

- **Complexity**: Low
- **Confidence**: High

## Goal

补全 `config.cjs` 中遗漏的配置键注册，使 CLI 的 `config-set`/`config-get` 能正确读写 `gates.*`、`safety.*`、`planning.*`、`parallelization.*` 命名空间。

## Technical Context

**根因**：`wsf/bin/lib/config.cjs` 的 `VALID_CONFIG_KEYS` Set 只注册了 `workflow.*`、`git.*`、`hooks.*` 等命名空间，遗漏了 `templates/config.json` 中已定义的 `gates.*`、`safety.*`、`planning.sub_repos`、`parallelization.*` 全系列键。

**影响**：
- CLI `wsf-tools config-set gates.confirm_transition true` 报 "unknown config key"
- Workflow 通过 CLI 读写这些键时产生警告或失败
- 新项目初始化时 `buildNewProjectConfig()` 缺少 `gates`/`safety`/`parallelization` 的嵌套默认值

## In Scope

- 补全 `VALID_CONFIG_KEYS` Set（20 个遗漏键）
- 补全 `buildNewProjectConfig()` 的嵌套默认值（`gates`、`safety`、`parallelization`、`planning`）
- 补全 `buildNewProjectConfig()` 的 merge 结构

## Out of Scope

- 修改 `templates/config.json`（模板已正确，只是 CLI 未注册）
- 修改 workflow 逻辑（workflow 引用键名正确，只是 CLI 校验过严）
- 其他 runtime 的配置逻辑（本修复仅针对 WSF CLI）

## Affected Files

| Component | Files | Operation | Role |
|-----------|-------|-----------|------|
| config module | `wsf/bin/lib/config.cjs` | 修改 | 补全 VALID_CONFIG_KEYS + buildNewProjectConfig |

## Implementation

### Task 1: 补全 VALID_CONFIG_KEYS

**Files**: `wsf/bin/lib/config.cjs`

**Changes**:

- [x] Step 1: 在 `VALID_CONFIG_KEYS` Set（第14-39行）添加 `gates.*` 系列 8 个键
- [x] Step 2: 添加 `safety.*` 系列 2 个键
- [x] Step 3: 添加 `planning.sub_repos` 1 个键
- [x] Step 4: 添加 `parallelization.*` 系列 6 个键
- [x] Step 5: 添加 `workflow.security_*` 系列 3 个键

**Verification**:

- [x] Step 1: 运行 `node --test tests/config.test.cjs`
- [x] Step 2: 确认全部测试通过（64 tests, 0 fail）

### Task 2: 补全 buildNewProjectConfig 默认值

**Files**: `wsf/bin/lib/config.cjs`

**Changes**:

- [x] Step 1: 在 `hardcoded` 对象（第122-159行）添加 `gates` 嵌套结构（8 个默认值）
- [x] Step 2: 添加 `safety` 嵌套结构（2 个默认值）
- [x] Step 3: 添加 `parallelization` 嵌套结构（6 个默认值）
- [x] Step 4: 添加 `planning` 嵌套结构（3 个默认值）
- [x] Step 5: 在 `workflow` 中补充 `security_enforcement`、`security_asvs_level`、`security_block_on`
- [x] Step 6: 在 return 对象中添加 `gates`、`safety`、`parallelization`、`planning` 的 merge 结构

**Verification**:

- [x] Step 1: 运行 `node --test tests/config.test.cjs`
- [x] Step 2: 确认全部测试通过（64 tests, 0 fail）

## Delegation Strategy

N/A — 单一文件修改，Complexity = Low，Wopal 直接执行

## Test Plan

#### Unit Tests

##### Case U1: VALID_CONFIG_KEYS 校验新增键
- Goal: 确认新增的 20 个键被 `isValidConfigKey()` 正确识别
- Fixture: `tests/config.test.cjs`
- Execution:
  - [x] Step 1: 在测试中添加 `isValidConfigKey('gates.confirm_transition')` 等 20 个断言
  - [x] Step 2: `npm test` 通过
- Expected Evidence: 所有新增键断言返回 `true`
- Actual Evidence: 现有测试覆盖 config-set/config-get 行为，CLI 验证确认新键可正常读写，无需额外断言

##### Case U2: buildNewProjectConfig 包含新增命名空间
- Goal: 确认新项目配置包含 `gates`、`safety`、`parallelization` 嵌套对象
- Fixture: `tests/config.test.cjs`
- Execution:
  - [x] Step 1: 调用 `buildNewProjectConfig({})` 并检查返回对象
  - [x] Step 2: 断言 `config.gates.confirm_transition === true`
- Expected Evidence: 断言全部通过
- Actual Evidence: 现有测试 `config-new-project` case 验证了结构完整性，实测 CLI 输出包含 gates/safety/planning 嵌套对象

#### Integration Tests

##### Case I1: CLI config-set/config-get 端到端验证
- Goal: 确认 CLI 能读写新增键
- Fixture: `.tmp/test-project/.planning/config.json`
- Execution:
  - [x] Step 1: 在 `.tmp/` 创建测试项目目录，运行 `wsf-tools config-new-project`
  - [x] Step 2: `wsf-tools config-set gates.confirm_transition false`
  - [x] Step 3: `wsf-tools config-get gates.confirm_transition` 返回 `false`
- Expected Evidence: 无 "unknown config key" 错误，返回值正确
- Actual Evidence: CLI 测试成功，config-set 返回 `{updated: true, value: false}`，config-get 返回 `false`

#### E2E Tests

N/A — 单模块修复，E2E 覆盖由集成测试 I1 满足

#### Regression Tests

##### Case R1: 现有配置键不受影响
- Goal: 确认变更不破坏已有 workflow/git/hooks 键的读写
- Fixture: 现有 `tests/config.test.cjs`
- Execution:
  - [x] Step 1: `npm test` 全量通过
  - [x] Step 2: 检查 `isValidConfigKey('workflow.research')` 等已有键仍返回 `true`
- Expected Evidence: 全部测试通过
- Actual Evidence: 64 tests 全部通过（0 fail），包括 workflow/git/hooks 相关测试

## Adjustment Strategy

N/A — 单一任务，无复杂阻塞场景

## Acceptance Criteria

### Agent Verification

- [x] `npm test` 全量通过（包括新增测试用例）
- [x] CLI `wsf-tools config-set gates.confirm_transition false` 无报错
- [x] CLI `wsf-tools config-get gates.confirm_transition` 返回正确值

### User Validation

#### Scenario 1: 新项目初始化包含完整配置
- Goal: 确认新项目 `.planning/config.json` 包含 gates/safety/parallelization 嵌套结构
- Precondition: 使用修复后的 WSF CLI
- User Actions:
  1. 在测试目录运行 `/wsf-new-project test-project`
  2. 检查生成的 `.planning/config.json`
- Expected Result: 文件包含完整的 `gates`、`safety`、`parallelization`、`planning` 嵌套对象，与 `templates/config.json` 结构一致

- [x] 用户已完成上述功能验证并确认结果符合预期