/**
 * Regression tests for OpenCode permission config handling.
 *
 * Ensures the installer does not crash when opencode.json uses the valid
 * top-level string form: "permission": "allow", and that path-specific
 * permissions are written against the actual resolved install directory.
 */

process.env.WSF_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createTempDir, cleanup } = require('./helpers.cjs');
const { configureOpencodePermissions, install, writeManifest, convertClaudeCommandToOpencodeSkill } = require('../bin/install.js');

const installSrc = fs.readFileSync(path.join(__dirname, '..', 'bin', 'install.js'), 'utf8');

const envKeys = ['OPENCODE_CONFIG_DIR', 'OPENCODE_CONFIG', 'XDG_CONFIG_HOME'];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const originalCwd = process.cwd();

function restoreEnv(snapshot) {
  for (const key of envKeys) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

describe('configureOpencodePermissions', () => {
  let configDir;

  beforeEach(() => {
    configDir = createTempDir('wsf-opencode-');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanup(configDir);
    restoreEnv(originalEnv);
  });

  test('does not crash or rewrite top-level string permissions', () => {
    const configPath = path.join(configDir, 'opencode.json');
    const original = JSON.stringify({
      $schema: 'https://opencode.ai/config.json',
      permission: 'allow',
      skills: { paths: ['/tmp/skills'] },
    }, null, 2) + '\n';

    fs.writeFileSync(configPath, original);
    process.env.OPENCODE_CONFIG_DIR = configDir;

    assert.doesNotThrow(() => configureOpencodePermissions(true, configDir));
    assert.strictEqual(fs.readFileSync(configPath, 'utf8'), original);
  });

  test('adds path-specific read and external_directory permissions for object configs', () => {
    const configPath = path.join(configDir, 'opencode.json');
    fs.writeFileSync(configPath, JSON.stringify({ permission: {} }, null, 2) + '\n');
    process.env.OPENCODE_CONFIG_DIR = configDir;

    configureOpencodePermissions(true, configDir);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const wsfPath = `${configDir.replace(/\\/g, '/')}/wsf/*`;

    assert.strictEqual(config.permission.read[wsfPath], 'allow');
    assert.strictEqual(config.permission.external_directory[wsfPath], 'allow');
  });

  test('finishInstall passes the actual config dir to OpenCode permissions', () => {
    assert.ok(
      installSrc.includes('configureOpencodePermissions(isGlobal, configDir);'),
      'OpenCode permission config uses actual install dir'
    );
  });

  test('local install does not create unsupported hooks or CommonJS package marker', () => {
    process.chdir(configDir);

    install(false, 'opencode');

    const installRoot = path.join(configDir, '.agents');
    const compatRoot = path.join(configDir, '.opencode');
    assert.ok(fs.existsSync(path.join(installRoot, 'skills')), 'OpenCode install should create .agents/skills/');
    assert.ok(!fs.existsSync(path.join(installRoot, 'hooks')), 'OpenCode install must not create hooks/');
    assert.ok(!fs.existsSync(path.join(installRoot, 'package.json')), 'OpenCode install must not create package.json');
    assert.ok(fs.existsSync(path.join(compatRoot, 'wsf-file-manifest.json')), 'OpenCode install should still write manifest to .opencode/');
  });

  test('local install removes stale WSF hooks but preserves user hook files', () => {
    const targetDir = path.join(configDir, '.agents');
    const hooksDir = path.join(targetDir, 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(path.join(hooksDir, 'wsf-check-update.js'), 'legacy');
    fs.writeFileSync(path.join(hooksDir, 'wsf-statusline.js'), 'legacy');
    fs.writeFileSync(path.join(hooksDir, 'custom.js'), 'keep');
    fs.writeFileSync(path.join(targetDir, 'package.json'), '{"type":"commonjs"}\n');
    const compatSkillsDir = path.join(configDir, '.opencode', 'skills', 'wsf-legacy');
    fs.mkdirSync(compatSkillsDir, { recursive: true });
    fs.writeFileSync(path.join(compatSkillsDir, 'SKILL.md'), 'legacy');

    process.chdir(configDir);
    install(false, 'opencode');

    assert.ok(!fs.existsSync(path.join(hooksDir, 'wsf-check-update.js')), 'stale wsf-check-update.js should be removed');
    assert.ok(!fs.existsSync(path.join(hooksDir, 'wsf-statusline.js')), 'stale WSF hook files should be removed');
    assert.ok(fs.existsSync(path.join(hooksDir, 'custom.js')), 'user hook files must be preserved');
    assert.ok(!fs.existsSync(path.join(targetDir, 'package.json')), 'legacy CommonJS marker should be removed');
    assert.ok(!fs.existsSync(path.join(configDir, '.opencode', 'skills', 'wsf-legacy')), 'legacy .opencode skills should be removed during reinstall');
  });

  test('local install preserves user package.json in .opencode', () => {
    const targetDir = path.join(configDir, '.opencode');
    fs.mkdirSync(targetDir, { recursive: true });
    const original = JSON.stringify({ name: 'custom-opencode-config' }, null, 2) + '\n';
    fs.writeFileSync(path.join(targetDir, 'package.json'), original);

    process.chdir(configDir);
    install(false, 'opencode');

    assert.strictEqual(
      fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'),
      original,
      'user package.json must be preserved'
    );
  });

  test('writeManifest tracks OpenCode skills from .agents via .opencode manifest', () => {
    const compatDir = path.join(configDir, '.opencode');
    const targetDir = path.join(configDir, '.agents');
    const skillDir = path.join(targetDir, 'skills', 'wsf-test');
    const wsfDir = path.join(targetDir, 'wsf');
    const agentsDir = path.join(targetDir, 'agents');
    fs.mkdirSync(compatDir, { recursive: true });
    fs.mkdirSync(skillDir, { recursive: true });
    fs.mkdirSync(wsfDir, { recursive: true });
    fs.mkdirSync(agentsDir, { recursive: true });

    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# skill\n');
    fs.writeFileSync(path.join(wsfDir, 'VERSION'), '1.34.2\n');
    fs.writeFileSync(path.join(agentsDir, 'wsf-test.md'), '---\nname: wsf-test\n---\n');

    writeManifest(compatDir, 'opencode');

    const manifest = JSON.parse(
      fs.readFileSync(path.join(compatDir, 'wsf-file-manifest.json'), 'utf8')
    );

    assert.ok(
      manifest.files['skills/wsf-test/SKILL.md'],
      'OpenCode manifest should include skills/wsf-test/SKILL.md'
    );
  });

  test('OpenCode skill conversion preserves required name field', () => {
    const input = `---
name: wsf-map-codebase
description: Analyze codebase
allowed-tools:
  - Read
  - Glob
---

Run it.`;

    const result = convertClaudeCommandToOpencodeSkill(input, 'wsf-map-codebase');
    const frontmatter = result.split('---')[1] || '';

    assert.ok(frontmatter.includes('name: wsf-map-codebase'), 'skill frontmatter should keep name');
    assert.ok(frontmatter.includes('description:'), 'skill frontmatter should keep description field');
    assert.ok(frontmatter.includes('tools:'), 'skill frontmatter should emit tools block');
  });
});
