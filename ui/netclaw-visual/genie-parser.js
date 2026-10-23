import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isLocalTerminalRequest } from './terminal-local-request.js';

const script = readFileSync(new URL('./genie_parse.py', import.meta.url), 'utf8');
export const GENIE_MAX_INPUT = 500_000;
const OS_NAMES = new Set(['ios', 'iosxe', 'iosxr', 'nxos', 'junos', 'eos', 'asa', 'aireos', 'linux']);
const ERRORS = {
  runtime_missing: 'The API cannot import Genie from its pyATS Python. Set PYATS_PYTHON to the same interpreter used by the existing NetClaw pyATS integration.',
  runtime_unavailable: 'The existing pyATS runtime could not start from the API. Check PYATS_PYTHON; for a Windows-hosted API using Linux pyATS, ensure WSL can start.',
  unsupported_parser: 'Genie has no parser for this command and OS. Check the full command name and OS, or use Raw text.',
  empty_output: 'Genie found no records. Select a complete command response, including its table headings.',
  parse_failed: 'Genie could not validate this output. Check the command, OS and complete captured response. No synthetic JSON was substituted.',
  timeout: 'Genie parsing timed out. Try a smaller, complete command response.',
};
export function validateGenieInput(input) {
  if (!input || !OS_NAMES.has(input.os)) throw new Error('Choose the device OS for Genie.');
  const command = typeof input.command === 'string' ? input.command.trim() : '';
  if (!/^(show|display)\s+[^\r\n\0|;<>]{1,240}$/i.test(command)) {
    throw new Error('Enter one full show/display command without pipes or redirects. This identifies the parser; it is not executed.');
  }
  if (typeof input.output !== 'string' || !input.output.trim()) throw new Error('Select a complete command response to parse.');
  if (Buffer.byteLength(input.output, 'utf8') > GENIE_MAX_INPUT) throw new Error('Output is too large. Select one command response (maximum 500 KB).');
  return { command, os: input.os, output: input.output };
}

// Only administrator-controlled environment variables choose the executable.
// CLI output travels on stdin, never in a shell command, argv, or a temp file.
export function genieRuntime(env = process.env, platform = process.platform) {
  const configured = String(env.PYATS_PYTHON || '').trim();
  const python = configured.replace(/^(['"])(.*)\1$/, '$2') || 'python3';
  if (platform === 'win32' && !/^(?:[A-Za-z]:[\\/]|\\\\)/.test(python)) {
    return { executable: 'wsl.exe', args: ['-d', env.PYATS_WSL_DISTRO || 'Ubuntu', '--exec', python, '-c', script] };
  }
  return { executable: python, args: ['-c', script] };
}

export function runGenie(input, { env = process.env, execute = execFile } = {}) {
  const { executable, args } = genieRuntime(env);
  return new Promise((resolve) => {
    const child = execute(executable, args, { timeout: 30_000, maxBuffer: 2_000_000, windowsHide: true, encoding: 'utf8' }, (error, stdout) => {
      if (error) return resolve({ error: error.killed ? 'timeout' : 'runtime_unavailable' });
      try {
        const result = JSON.parse(stdout);
        if (result.error) return resolve({ error: ERRORS[result.error] ? result.error : 'parse_failed' });
        if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data) || !Object.keys(result.data).length) throw new Error();
        resolve({ data: result.data, parser: 'Genie / pyATS', version: String(result.version || 'unknown').slice(0, 40) });
      } catch { resolve({ error: 'parse_failed' }); }
    });
    child.stdin?.on('error', () => {}); // WSL/Python may exit before reading input.
    child.stdin?.end(JSON.stringify(input));
  });
}

export function registerGenieRoutes(app, { parse = runGenie, getEnv = () => process.env } = {}) {
  let active = 0;
  app.post('/api/terminal/parse/genie', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!isLocalTerminalRequest(req)) return res.status(403).json({ error: 'Genie parsing is restricted to a localhost browser.' });
    let input;
    try { input = validateGenieInput(req.body); }
    catch (e) { return res.status(400).json({ error: e.message }); }
    if (active >= 2) return res.status(429).json({ error: 'Genie is busy. Retry when the current parsing finishes.' });
    active += 1;
    try {
      const result = await parse(input, { env: getEnv() });
      if (result.error) return res.status(result.error.startsWith('runtime_') ? 503 : 422).json({ code: result.error, error: ERRORS[result.error] || ERRORS.parse_failed });
      res.json({ ...result, command: input.command, os: input.os });
    } catch { res.status(503).json({ code: 'runtime_unavailable', error: ERRORS.runtime_unavailable }); }
    finally { active -= 1; }
  });
}
