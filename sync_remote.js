const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_PATH = path.join(__dirname, 'scripts.config.yaml');
const CLASPRC_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.clasprc.json'
);

// Load existing scripts from config
function getExistingScriptIds() {
  if (!fs.existsSync(CONFIG_PATH)) return new Set();
  const content = fs.readFileSync(CONFIG_PATH, 'utf8');
  const matches = [...content.matchAll(/id:\s*["']?([a-zA-Z0-9_-]+)["']?/g)];
  return new Set(matches.map(m => m[1]));
}

// Fetch all Apps Script projects from Google Drive API
async function fetchRemoteScripts(token) {
  const query = encodeURIComponent("mimeType = 'application/vnd.google.apps.script' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`Drive API error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  return data.files || [];
}

async function main() {
  if (!fs.existsSync(CLASPRC_PATH)) {
    console.error('Missing .clasprc.json authentication file.');
    process.exit(1);
  }

  const auth = JSON.parse(fs.readFileSync(CLASPRC_PATH, 'utf8'));
  const accessToken = auth.token?.access_token;
  if (!accessToken) {
    console.error('No access_token found in .clasprc.json.');
    process.exit(1);
  }

  console.log('Scanning Google Drive for Apps Script projects...');
  const remoteProjects = await fetchRemoteScripts(accessToken);
  const existingIds = getExistingScriptIds();

  const newProjects = remoteProjects.filter(p => !existingIds.has(p.id));

  if (newProjects.length === 0) {
    console.log('No new Google Apps Script projects found.');
    return;
  }

  console.log(`Found ${newProjects.length} new project(s):`);

  // Append each new project to scripts.config.yaml and pull via runner
  for (const project of newProjects) {
    const safeName = project.name.replace(/\s+/g, '-').replace(/[<>:"/\\|?*]/g, '_');
    console.log(`- Adding: ${safeName} (${project.id})`);

    const yamlEntry = `\n  - name: "${safeName}"\n    id: "${project.id}"\n    enabled: true\n`;
    fs.appendFileSync(CONFIG_PATH, yamlEntry, 'utf8');

    try {
      execSync(`node runner.js pull "${safeName}"`, { stdio: 'inherit' });
    } catch (err) {
      console.error(`Failed to pull ${safeName}:`, err.message);
    }
  }

  console.log('\nDiscovery and pull completed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});