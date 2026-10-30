#!/usr/bin/env node
// Skills use the existing YAML parser; installer/runtime consumers need only JSON.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parseDocument} from '../extensions/netclaw-vscode/node_modules/yaml/dist/index.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'config/components/catalog.json');
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
const actual = fs.readdirSync(path.join(root, 'workspace/skills')).filter(id => fs.existsSync(path.join(root, 'workspace/skills', id, 'SKILL.md'))).sort();
if (JSON.stringify(actual) !== JSON.stringify(catalog.skills.map(s => s.id).sort())) throw Error('Skill inventory changed: add explicit component/server joins before generation.');
let drift = false;
for (const skill of catalog.skills) {
  if (skill.path !== `workspace/skills/${skill.id}/SKILL.md`) throw Error('Invalid skill source');
  const content = fs.readFileSync(path.join(root, skill.path), 'utf8');
  const front = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!front) throw Error(`Missing front matter: ${skill.id}`);
  const document = parseDocument(front[1], {uniqueKeys: true});
  if (document.errors.length) throw Error(`Invalid skill YAML: ${skill.id}`);
  const metadata = document.toJS({maxAliasCount: 50});
  if (typeof metadata.name !== 'string' || typeof metadata.description !== 'string') throw Error(`Invalid skill descriptor: ${skill.id}`);
  const next = {title: metadata.name, description: metadata.description, sha256: createHash('sha256').update(content).digest('hex')};
  for (const [key,value] of Object.entries(next)) { if (skill[key] !== value) drift = true; skill[key] = value; }
}
if (process.argv.includes('--check')) {
  if (drift) throw Error('Skill descriptors differ; run node scripts/build-catalog.mjs then python3 scripts/build-catalog.py.');
} else fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + '\n');
process.stdout.write(`Skill descriptor parity: PASS (${catalog.skills.length})\n`);
