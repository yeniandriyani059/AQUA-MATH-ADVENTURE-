import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fingerprints from './retired-credential-fingerprints.json' with { type: 'json' };
export function containsRetiredCredential(text, checks = fingerprints) {
  const groups = new Map();
  for (const entry of checks) {
    if (!groups.has(entry.length)) groups.set(entry.length, new Set());
    groups.get(entry.length).add(entry.sha256);
  }
  for (const [length, hashes] of groups) {
    for (let i = 0; i <= text.length - length; i++) {
      if (hashes.has(createHash('sha256').update(text.slice(i, i + length)).digest('hex'))) return true;
    }
  }
  return false;
}
export function checkArtifacts(directory) {
  let count = 0;
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) { count += checkArtifacts(path); continue; }
    if (!/\.(js|css|html|json|map|txt|webmanifest)$/.test(item.name)) continue;
    if (containsRetiredCredential(readFileSync(path, 'utf8'))) throw new Error('Retired student credential detected in public build. Build rejected.');
    count++;
  }
  return count;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`Public credential guard: ${checkArtifacts('dist')} artifacts passed.`);
