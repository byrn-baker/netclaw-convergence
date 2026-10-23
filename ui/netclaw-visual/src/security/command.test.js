import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mcpCommand } from './command.js';

test('MCP command survives the Python parser with literal checkout characters', () => {
  for (const root of ['/Users/operator/netclaw', "/tmp/operator's NetClaw", '/tmp/$(literal); & \\ "project"']) {
    const argv = ['python3', '-u', `${root}/rag_mcp_server.py`];
    const parsed = execFileSync('python3', ['-c', 'import json,shlex,sys; print(json.dumps(shlex.split(sys.argv[1])))', mcpCommand(argv)], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(parsed), argv);
  }
});
