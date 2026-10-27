const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse simple YAML without external packages
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
        enabled: true
      };
    } else if (currentScript) {
      if (line.startsWith('id:')) {
        currentScript.id = line.replace('id:', '').replace(/['"]/g, '').trim();
      } else if (line.startsWith('enabled:')) {
        currentScript.enabled = line.replace('enabled:', '').trim() === 'true';
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
const baseDir = __dirname; // Current directory (gas_scripts)

const command = process.argv[2];
const targetName = process.argv[3];

if (!['pull', 'push', 'status'].includes(command)) {
  console.log(`
Usage:
  node runner.js <command> [project-name]

Commands:
  pull    Pull code from Google Apps Script into folders
  push    Push local code to Google Apps Script
  status  Check local folder and clasp setup status

Examples:
  node runner.js pull
  node runner.js pull Time-Sheets
  node runner.js push REMaps
  `);
  process.exit(0);
}

const filteredScripts = targetName
  ? config.scripts.filter(s => s.name.toLowerCase() === targetName.toLowerCase())
  : config.scripts.filter(s => s.enabled !== false);

if (filteredScripts.length === 0) {
  console.error(`No matching script found for: "${targetName}"`);
  process.exit(1);
}

console.log(`Executing '${command}' on ${filteredScripts.length} script(s)...\n`);

let successCount = 0;
let failureCount = 0;

filteredScripts.forEach((script, idx) => {
  const projectDir = path.join(baseDir, script.name);
  console.log(`[${idx + 1}/${filteredScripts.length}] ${script.name} (${script.id})`);

  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  const claspConfigPath = path.join(projectDir, '.clasp.json');
  const claspConfig = {
    scriptId: script.id,
    rootDir: projectDir
  };
  fs.writeFileSync(claspConfigPath, JSON.stringify(claspConfig, null, 2), 'utf8');

  if (command === 'status') {
    const files = fs.readdirSync(projectDir).filter(f => f !== '.clasp.json');
    console.log(`  Local files: ${files.length ? files.join(', ') : '(empty)'}\n`);
    successCount++;
    return;
  }

  try {
    execSync('npx @google/clasp ' + command, {
      cwd: projectDir,
      stdio: 'inherit'
    });
    console.log(`✓ ${command} succeeded for ${script.name}\n`);
    successCount++;
  } catch (err) {
    console.error(`✗ ${command} failed for ${script.name}: ${err.message}\n`);
    failureCount++;
  }
});

console.log(`========================================`);
console.log(`Finished: ${successCount} succeeded, ${failureCount} failed.`);
console.log(`========================================`);