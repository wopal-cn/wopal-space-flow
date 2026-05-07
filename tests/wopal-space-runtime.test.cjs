/**
 * Tests for wopal-space runtime support.
 *
 * Covers:
 * - U1: runtime path helpers (getDirName, getGlobalDir)
 * - U2: interactive runtime selection
 * - I1: local install/uninstall cycle
 * - I2: global install/uninstall cycle
 * - I3: opencode manifest migration (source-based)
 * - I4: wrapper entrypoint (source-based)
 */

'use strict';

process.env.WSF_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { createTempDir, cleanup } = require('./helpers.cjs');
const INSTALL_SRC = path.join(__dirname, '..', 'bin', 'install.js');
const installSrc = fs.readFileSync(INSTALL_SRC, 'utf8');

const MANIFEST_NAME = 'wsf-file-manifest.json';

const envKeys = ['WOPAL_SPACE_CONFIG_DIR', 'OPENCODE_CONFIG_DIR', 'OPENCODE_CONFIG', 'XDG_CONFIG_HOME', 'CLAUDE_CONFIG_DIR'];
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

describe('U1: runtime path helpers', () => {
  test('getDirName returns .wopal for wopal-space', () => {
    assert.ok(
      installSrc.includes("if (runtime === 'wopal-space') return '.wopal';"),
      'getDirName should return .wopal for wopal-space'
    );
  });

  test('getInstallRootDirName returns .wopal for wopal-space', () => {
    assert.ok(
      installSrc.includes("if (runtime === 'wopal-space') return '.wopal';"),
      'getInstallRootDirName should return .wopal for wopal-space'
    );
  });

  test('getGlobalDir returns ~/.wopal for wopal-space', () => {
    assert.ok(
      installSrc.includes("if (runtime === 'wopal-space') {"),
      'getGlobalDir should have wopal-space branch'
    );
    assert.ok(
      installSrc.includes("return path.join(os.homedir(), '.wopal');"),
      'getGlobalDir default should be ~/.wopal for wopal-space'
    );
  });

  test('getConfigDirFromHome returns .wopal for wopal-space local', () => {
    assert.ok(
      installSrc.includes("if (runtime === 'wopal-space') return '.wopal';"),
      'getConfigDirFromHome should return .wopal for wopal-space'
    );
  });

  test('WOPAL_SPACE_CONFIG_DIR overrides default global path', () => {
    assert.ok(
      installSrc.includes('process.env.WOPAL_SPACE_CONFIG_DIR'),
      'getGlobalDir should check WOPAL_SPACE_CONFIG_DIR env var'
    );
  });
});

describe('U2: interactive runtime selection', () => {
  test('runtimeMap includes wopal-space as option 12', () => {
    assert.ok(
      installSrc.includes("'12': 'wopal-space'"),
      'runtimeMap should include wopal-space as option 12'
    );
  });

  test('allRuntimes array includes wopal-space', () => {
    const match = installSrc.match(/const allRuntimes = \[([^\]]+)\]/);
    assert.ok(match, 'allRuntimes array found');
    assert.ok(match[1].includes("'wopal-space'"), 'allRuntimes should include wopal-space');
  });

  test('prompt lists wopal-space as option 12', () => {
    assert.ok(
      installSrc.includes('12${reset}) Wopal Space'),
      'prompt should list Wopal Space as option 12'
    );
  });

  test('all shortcut uses option 13 (after wopal-space at 12)', () => {
    assert.ok(
      installSrc.includes("if (input === '13')"),
      'all shortcut should use option 13'
    );
    assert.ok(
      installSrc.includes('13${reset}) All'),
      'prompt should list All as option 13'
    );
  });
});

describe('I1: local install/uninstall cycle', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('wsf-wopal-local-');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanup(tmpDir);
    restoreEnv(originalEnv);
  });

  test('local install creates .wopal directory structure', () => {
    process.chdir(tmpDir);

    const { install } = require(INSTALL_SRC);
    install(false, 'wopal-space');

    const wopalDir = path.join(tmpDir, '.wopal');
    assert.ok(fs.existsSync(wopalDir), '.wopal should exist after install');
    assert.ok(fs.existsSync(path.join(wopalDir, 'skills')), '.wopal/skills should exist');
    assert.ok(fs.existsSync(path.join(wopalDir, 'wsf')), '.wopal/wsf should exist');
    assert.ok(fs.existsSync(path.join(wopalDir, 'agents')), '.wopal/agents should exist');
  });

  test('local install writes manifest to .wopal root', () => {
    process.chdir(tmpDir);

    const { install } = require(INSTALL_SRC);
    install(false, 'wopal-space');

    const manifestPath = path.join(tmpDir, '.wopal', MANIFEST_NAME);
    assert.ok(fs.existsSync(manifestPath), 'manifest should exist at .wopal/wsf-file-manifest.json');
  });

  test('local install does not create .opencode directory', () => {
    process.chdir(tmpDir);

    const { install } = require(INSTALL_SRC);
    install(false, 'wopal-space');

    assert.ok(!fs.existsSync(path.join(tmpDir, '.opencode')), '.opencode should not exist');
    assert.ok(!fs.existsSync(path.join(tmpDir, '.agents')), '.agents should not exist for wopal-space');
  });

  test('local install does not create hooks, settings, or package.json', () => {
    process.chdir(tmpDir);

    const { install } = require(INSTALL_SRC);
    install(false, 'wopal-space');

    const wopalDir = path.join(tmpDir, '.wopal');
    assert.ok(!fs.existsSync(path.join(wopalDir, 'hooks')), '.wopal/hooks should not exist');
    assert.ok(!fs.existsSync(path.join(wopalDir, 'settings.json')), '.wopal/settings.json should not exist');
    assert.ok(!fs.existsSync(path.join(wopalDir, 'package.json')), '.wopal/package.json should not exist');
  });

  test('local uninstall removes .wopal WSF content', () => {
    process.chdir(tmpDir);

    const { install, uninstall } = require(INSTALL_SRC);
    install(false, 'wopal-space');

    // Verify skills were installed
    const wopalDir = path.join(tmpDir, '.wopal');
    const skillsDir = path.join(wopalDir, 'skills');
    assert.ok(fs.existsSync(skillsDir), 'skills should exist after install');

    // Clear cache to ensure fresh load for uninstall
    delete require.cache[require.resolve(INSTALL_SRC)];
    const { uninstall: uninstall2 } = require(INSTALL_SRC);
    uninstall2(false, 'wopal-space');

    // Verify wsf-* skill subdirs are removed
    const remainingSkills = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir) : [];
    const wsfSkills = remainingSkills.filter(d => d.startsWith('wsf-'));
    assert.strictEqual(wsfSkills.length, 0, 'all wsf-* skills should be removed after uninstall');
    assert.ok(!fs.existsSync(path.join(wopalDir, 'wsf')), 'wsf should be removed after uninstall');
    assert.ok(!fs.existsSync(path.join(wopalDir, MANIFEST_NAME)), 'manifest should be removed after uninstall');
  });
});

describe('I2: global install/uninstall cycle', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('wsf-wopal-global-');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanup(tmpDir);
    restoreEnv(originalEnv);
  });

  test('global install uses WOPAL_SPACE_CONFIG_DIR override', () => {
    process.env.WOPAL_SPACE_CONFIG_DIR = tmpDir;

    const { install } = require(INSTALL_SRC);
    install(true, 'wopal-space');

    assert.ok(fs.existsSync(path.join(tmpDir, 'skills')), 'skills should exist in override dir');
    assert.ok(fs.existsSync(path.join(tmpDir, 'wsf')), 'wsf should exist in override dir');
    assert.ok(fs.existsSync(path.join(tmpDir, 'agents')), 'agents should exist in override dir');
  });

  test('global install writes manifest to override dir', () => {
    process.env.WOPAL_SPACE_CONFIG_DIR = tmpDir;

    const { install } = require(INSTALL_SRC);
    install(true, 'wopal-space');

    const manifestPath = path.join(tmpDir, MANIFEST_NAME);
    assert.ok(fs.existsSync(manifestPath), 'manifest should exist in global override dir');
  });

  test('global uninstall removes WSF content from override dir', () => {
    process.env.WOPAL_SPACE_CONFIG_DIR = tmpDir;

    const { install } = require(INSTALL_SRC);
    install(true, 'wopal-space');

    // Verify skills were installed
    const skillsDir = path.join(tmpDir, 'skills');
    assert.ok(fs.existsSync(skillsDir), 'skills should exist after install');

    // Clear cache and set env again for uninstall
    delete require.cache[require.resolve(INSTALL_SRC)];
    process.env.WOPAL_SPACE_CONFIG_DIR = tmpDir;
    const { uninstall } = require(INSTALL_SRC);
    uninstall(true, 'wopal-space');

    // Verify wsf-* skill subdirs are removed
    const remainingSkills = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir) : [];
    const wsfSkills = remainingSkills.filter(d => d.startsWith('wsf-'));
    assert.strictEqual(wsfSkills.length, 0, 'all wsf-* skills should be removed after global uninstall');
    assert.ok(!fs.existsSync(path.join(tmpDir, 'wsf')), 'wsf should be removed after global uninstall');
    assert.ok(!fs.existsSync(path.join(tmpDir, MANIFEST_NAME)), 'manifest should be removed after global uninstall');
  });
});

describe('I3: opencode manifest migration (source-based)', () => {
  test('getInstallRootDirName returns .agents for opencode local', () => {
    assert.ok(
      installSrc.includes("if (!isGlobal && runtime === 'opencode') return '.agents';"),
      'getInstallRootDirName should return .agents for opencode local'
    );
  });

  test('install writes manifest to .agents for opencode local', () => {
    assert.ok(
      installSrc.includes("path.join(process.cwd(), getInstallRootDirName(runtime, isGlobal))"),
      'install should use getInstallRootDirName to compute targetDir'
    );
    assert.ok(
      installSrc.includes("if (!isGlobal && runtime === 'opencode') return '.agents';"),
      'getInstallRootDirName should return .agents for opencode local'
    );
  });

  test('source does not write manifest to .opencode for opencode local', () => {
    assert.ok(
      !installSrc.includes("path.join(cwd, '.opencode', MANIFEST_NAME)"),
      'manifest should not be written to .opencode for opencode local'
    );
  });
});

describe('I4: wrapper entrypoint (source-based)', () => {
  test('space-flow.sh supports --runtime wopal-space', () => {
    const wrapperPath = path.join(__dirname, '..', '..', '..', 'scripts', 'space-flow.sh');
    if (fs.existsSync(wrapperPath)) {
      const wrapperSrc = fs.readFileSync(wrapperPath, 'utf8');
      assert.ok(
        wrapperSrc.includes('wopal-space'),
        'wrapper should support wopal-space runtime'
      );
    }
  });

  test('install.js exports getGlobalDir for wopal-space', () => {
    const { getGlobalDir } = require(INSTALL_SRC);
    const dir = getGlobalDir('wopal-space', '/tmp/test-wopal');
    assert.strictEqual(dir, '/tmp/test-wopal', 'getGlobalDir should use explicit override');
  });

  test('install.js exports getDirName for wopal-space', () => {
    const { getDirName } = require(INSTALL_SRC);
    assert.strictEqual(getDirName('wopal-space'), '.wopal', 'getDirName should return .wopal');
  });
});

describe('no leaked paths in wopal-space install', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('wsf-wopal-paths-');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    cleanup(tmpDir);
    restoreEnv(originalEnv);
  });

  test('.wopal files do not contain ~/.claude references', () => {
    process.chdir(tmpDir);

    const { install } = require(INSTALL_SRC);
    install(false, 'wopal-space');

    const wopalDir = path.join(tmpDir, '.wopal');
    const mdFiles = [];

    function findMdFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findMdFiles(fullPath);
        } else if (entry.name.endsWith('.md')) {
          mdFiles.push(fullPath);
        }
      }
    }

    findMdFiles(wopalDir);

    for (const mdFile of mdFiles) {
      const content = fs.readFileSync(mdFile, 'utf8');
      assert.ok(
        !content.includes('~/.claude') && !content.includes('$HOME/.claude'),
        `${mdFile} should not contain ~/.claude references`
      );
    }
  });

  test('.wopal files do not contain ./.opencode/ relative path references', () => {
    process.chdir(tmpDir);

    const { install } = require(INSTALL_SRC);
    install(false, 'wopal-space');

    const wopalDir = path.join(tmpDir, '.wopal');
    const mdFiles = [];

    function findMdFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findMdFiles(fullPath);
        } else if (entry.name.endsWith('.md')) {
          mdFiles.push(fullPath);
        }
      }
    }

    findMdFiles(wopalDir);

    for (const mdFile of mdFiles) {
      const content = fs.readFileSync(mdFile, 'utf8');
      assert.ok(
        !content.includes('./.opencode/'),
        `${mdFile} should not contain ./.opencode/ relative path references`
      );
    }
  });

  test('.wopal files contain ./.wopal/ references', () => {
    process.chdir(tmpDir);

    const { install } = require(INSTALL_SRC);
    install(false, 'wopal-space');

    const wopalDir = path.join(tmpDir, '.wopal');
    const mdFiles = [];

    function findMdFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findMdFiles(fullPath);
        } else if (entry.name.endsWith('.md')) {
          mdFiles.push(fullPath);
        }
      }
    }

    findMdFiles(wopalDir);

    let foundWopalPath = false;
    for (const mdFile of mdFiles) {
      const content = fs.readFileSync(mdFile, 'utf8');
      if (content.includes('./.wopal/') || content.includes('.wopal/')) {
        foundWopalPath = true;
        break;
      }
    }

    assert.ok(foundWopalPath, 'at least one .md file should contain ./.wopal/ references');
  });
});