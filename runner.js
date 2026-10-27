const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse simple YAML without external dependencies
function parseSimpleYaml(content) {
  const lines = content.split(/\r?\n/);
  const scripts = [];
  let currentScript = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('- name:')) {
      if (currentScript && currentScript.name && currentScript.id) {
        scripts.push(currentScript);
      }
      currentScript = {
        name: line.replace('- name:', '').replace(/['"]/g, '').trim(),
        enabled: true,
        private: false
      };
    } else if (currentScript) {
      if (line.startsWith('id:')) {
        currentScript.id = line.replace('id:', '').replace(/['"]/g, '').trim();
      } else if (line.startsWith('enabled:')) {
        currentScript.enabled = line.replace('enabled:', '').trim() === 'true';
      } else if (line.startsWith('private:')) {
        currentScript.private = line.replace('private:', '').trim() === 'true';
      }
    }
  }

  if (currentScript && currentScript.name && currentScript.id) {
    scripts.push(currentScript);
  }

  return { scripts };
}

const CONFIG_FILE = path.join(__dirname, 'scripts.config.yaml');
if (!fs.existsSync(CONFIG_FILE)) {
  console.error(`Error: Could not find ${CONFIG_FILE}`);
  process.exit(1);
}

const rawConfig = fs.readFileSync(CONFIG_FILE, 'utf8');
const config = parseSimpleYaml(rawConfig);
const rootDir = __dirname;

// Directory locations
const PUBLIC_DIR = path.join(rootDir, 'gas_scripts');
const PRIVATE_DIR = path.join(rootDir, 'private_scripts');

// Ensure base directories exist
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(PRIVATE_DIR)) fs.mkdirSync(PRIVATE_DIR, { recursive: true });

// Resolve the correct folder for a given script
function resolveProjectDir(script) {
  const privatePath = path.join(PRIVATE_DIR, script.name);
  const publicPath = path.join(PUBLIC_DIR, script.name);

  // 1. If it already exists in either location, use that location
  if (fs.existsSync(privatePath)) return privatePath;
  if (fs.existsSync(publicPath)) return publicPath;

  // 2. If it's brand new, place it based on the 'private' flag in yaml
  return script.private ? privatePath : publicPath;
}

// Arguments handling (order-independent)
const rawArgs = process.argv.slice(2);
const command = rawArgs.find(arg => ['pull', 'push', 'status'].includes(arg));
const onlyMissing = rawArgs.includes('--missing');
const targetName = rawArgs.find(arg => !['pull', 'push', 'status', '--missing'].includes(arg));

if (!command) {
  console.log(`
Usage:
  node runner.js <command> [project-name] [--missing]

Commands:
  pull       Pull code from Google Apps Script into folders
  push       Push local code to Google Apps Script
  status     Show local files and location (public vs private)

Options:
  --missing  Only run on scripts that don't already have local files (pull only)

Examples:
  node runner.js status
  node runner.js pull --missing
  node runner.js push REMaps
  node runner.js pull Bridge_Descriptions
  `);
  process.exit(0);
}

// Filter scripts based on command line arguments
let filteredScripts = targetName
  ? config.scripts.filter(s => s.name.toLowerCase() === targetName.toLowerCase())
  : config.scripts.filter(s => s.enabled !== false);

if (onlyMissing && command === 'pull') {
  filteredScripts = filteredScripts.filter(script => {
    const projectDir = resolveProjectDir(script);
    return !fs.existsSync(projectDir) || fs.readdirSync(projectDir).filter(f => f !== '.clasp.json').length === 0;
  });
}

if (filteredScripts.length === 0) {
  console.log(onlyMissing ? 'No missing script folders found to pull.' : `No matching script found for: "${targetName}"`);
  process.exit(0);
}

console.log(`Executing '${command}' across ${filteredScripts.length} script(s)...\n`);

let successCount = 0;
let failureCount = 0;

filteredScripts.forEach((script, idx) => {
  const projectDir = resolveProjectDir(script);
  const isPrivate = projectDir.startsWith(PRIVATE_DIR);
  const scopeTag = isPrivate ? '[PRIVATE]' : '[PUBLIC]';

  console.log(`[${idx + 1}/${filteredScripts.length}] ${scopeTag} ${script.name} (${script.id})`);

  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });