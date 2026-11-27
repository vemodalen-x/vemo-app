import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// The destination is a public GitHub repository. Keep local data and runtime
// secrets outside this manifest. Existing public assets are fetched by hash.
const output = 'dist/client/luma-source-sync';
const publicConfig = new Set(['.gitignore', '.npmrc', '.openai/hosting.json']);
const runtimeDirectories = new Set(['node_modules', 'dist', 'outputs', 'upload']);
const credential = /(?:sk-[a-z0-9_-]{15,}|gh[pousr]_[a-z0-9_]{20,}|github_pat_[a-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
const options = { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 };
const entries = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], options)
  .split('\0').filter(Boolean);
const files = {};

for (const name of [...new Set(entries)].sort()) {
  const parts = name.split('/');
  if (!publicConfig.has(name) && (parts.some(part => part.startsWith('.')) || runtimeDirectories.has(parts[0]))) continue;
  const stat = lstatSync(name, { throwIfNoEntry: false });
  if (!stat) continue;
  if (!stat.isFile()) throw new Error('Expected a regular file in the public source tree: ' + name);
  const content = readFileSync(name);
  if (!name.startsWith('public/') && credential.test(content.toString('utf8'))) {
    throw new Error('Potential credential in public source: ' + name);
  }
  const asset = name.startsWith('public/');
  files[name] = {
    sha256: createHash('sha256').update(content).digest('hex'),
    size: content.byteLength,
    ...(asset ? {} : { data: content.toString('base64') }),
  };
}

const { project_id: project } = JSON.parse(readFileSync('.openai/hosting.json', 'utf8'));
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'manifest.json'), JSON.stringify({ schema: 1, project, files }) + '\n');
console.log('Prepared ' + Object.keys(files).length + ' repository files for GitHub synchronization.');
