import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnvData, updateEnvironment, writePrivateAtomic } from './private-files.js';

test('environment updates preserve literal secrets and unrelated lines privately', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'netclaw-env-'));
  try {
    const file = path.join(root, '.env');
    fs.writeFileSync(file, '# retained\nOTHER=keep\nexport TOKEN=old\nTOKEN=duplicate\n');
    const value = 'quotes " and apostrophe\' and \\ backslash # $() ${LITERAL}';
    updateEnvironment(file, { TOKEN:value });
    const data = fs.readFileSync(file, 'utf8');
    assert.equal(parseEnvData(data).TOKEN, value);
    assert.equal(parseEnvData(data).OTHER, 'keep');
    assert.ok(data.startsWith('# retained\n'));
    assert.equal((data.match(/^TOKEN=/gm) || []).length, 1);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    updateEnvironment(file, { TOKEN:value });
    assert.equal(fs.readFileSync(file, 'utf8'), data);
    for (const invalid of [{TOKEN:'x\nINJECTED=y'}, {'BAD\nKEY':'x'}, {TOKEN:42}, ['x']]) {
      assert.throws(() => updateEnvironment(file, invalid));
      assert.equal(fs.readFileSync(file, 'utf8'), data);
    }
  } finally { fs.rmSync(root, { recursive:true }); }
});

test('private atomic writes refuse links and preserve old state on failed replacement', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'netclaw-file-'));
  try {
    const file = path.join(root, 'config');
    writePrivateAtomic(file, 'original');
    const link = path.join(root, 'linked'); fs.symlinkSync(file, link);
    assert.throws(() => writePrivateAtomic(link, 'bad'));
    const stub = t.mock.method(fs, 'renameSync', () => { throw new Error('synthetic disk failure'); });
    assert.throws(() => writePrivateAtomic(file, 'replacement'));
    stub.mock.restore();
    assert.equal(fs.readFileSync(file, 'utf8'), 'original');
    assert.deepEqual(fs.readdirSync(root).sort(), ['config', 'linked']);
  } finally { fs.rmSync(root, { recursive:true }); }
});
