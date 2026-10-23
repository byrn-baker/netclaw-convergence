import fs from 'node:fs';
import path from 'node:path';

const MAX_READ = 256 * 1024;
const MAX_LINE = 512 * 1024;

// Deliberately conservative: secret-bearing output is withheld as a whole,
// before truncation. Activity is a diagnostic preview, not a raw config export.
export function activityText(value, limit = 5000) {
  if (typeof value !== 'string') return '';
  if (/password|passwd|secret|token|authorization|credential|(?:private|api|access|shared)[ _-]?key|\bpsk\b|community|pre[ -]?shared|keyring|crypto[^\n]*\bkey\b|BEGIN .*KEY|\b(?:sk|ghp|gho)[_-][A-Za-z0-9]|:\/\/[^\s/]+:[^\s/]+@/i.test(value)) {
    return '[Content withheld: may contain credentials or other secrets.]';
  }
  const clean = value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
  return clean.length > limit ? `${clean.slice(0, limit)}\n[Preview truncated]` : clean;
}

function previewArguments(args) {
  if (!args || typeof args !== 'object') return '';
  // Do not expose arbitrary tool arguments (environment, keys, file contents,
  // prompts, etc.). Only familiar device/CLI fields are eligible for preview.
  return Object.entries(args).filter(([key]) => /^(device|device_id|device_name|hostname|host|router|command|commands|cli_command|config_commands)$/.test(key))
    .map(([key, value]) => `${key}: ${activityText(typeof value === 'string' ? value : JSON.stringify(value), 2500)}`).join('\n');
}

export function transcriptActivity(entry) {
  if (entry?.type !== 'message') return [];
  const message = entry.message;
  if (!message) return [];
  const at = new Date(entry.timestamp || message.timestamp || 0).toISOString();
  const blocks = Array.isArray(message.content) ? message.content : [];
  if (message.role === 'assistant') {
    // Never publish thinking/reasoning, user prompts, or system context.
    // Assistant text is delivered through the existing final/report channel.
    return blocks.filter(block => ['toolCall', 'tool_use'].includes(block.type)).map((block, index) => ({
      id: `${entry.id || at}:call:${index}`, at, kind: 'tool-start',
      tool: activityText(block.name || 'Tool', 180), callId: String(block.id || '').slice(0, 256),
      title: `Tool requested: ${activityText(block.name || 'Tool', 180)}`,
      detail: previewArguments(block.arguments || block.input), source: 'gateway-transcript',
    }));
  }
  if (message.role !== 'toolResult') return [];
  const output = typeof message.content === 'string' ? message.content : blocks.filter(block => block.type === 'text').map(block => block.text).join('\n');
  return [{ id: `${entry.id || at}:result`, at, kind: message.isError ? 'tool-error' : 'tool-result',
    tool: activityText(message.toolName || 'Tool', 180), callId: String(message.toolCallId || '').slice(0, 256),
    title: `${activityText(message.toolName || 'Tool', 180)} ${message.isError ? 'reported an error' : 'returned output'}`,
    detail: activityText(output) || 'No text output was exposed by this tool.', source: 'gateway-transcript' }];
}

// Exact application-owned session only. No global "latest session" fallback.
// Files are read-only; this observer cannot affect Gateway execution.
export function createTranscriptActivityReader({ directory, sessionKey, startedAt }) {
  let current = '', offset = 0, pending = Buffer.alloc(0), droppingLine = false;
  const seen = new Set();
  const startTime = Date.parse(startedAt);
  function resolveFile() {
    const root = fs.realpathSync(directory);
    const manifest = path.join(root, 'sessions.json');
    if (fs.realpathSync(manifest) !== manifest || fs.statSync(manifest).size > 8 * 1024 * 1024) throw new Error('Unsupported session store');
    const record = JSON.parse(fs.readFileSync(manifest, 'utf8'))[sessionKey];
    if (!record) return null;
    if (!/^[a-f0-9-]{36}$/i.test(record.sessionId || '')) throw new Error('Unsupported session ID');
    const candidate = path.resolve(root, record.sessionFile || `${record.sessionId}.jsonl`);
    const actual = fs.realpathSync(candidate);
    if (path.dirname(actual) !== root || !actual.endsWith('.jsonl')) throw new Error('Transcript outside session directory');
    return { file: actual, size: fs.statSync(actual).size };
  }
  // Skip all existing bytes before submitting a continuation request.
  let baselineUnavailable = false;
  try { const baseline = resolveFile(); if (baseline) { current = baseline.file; offset = baseline.size; } }
  catch (error) { baselineUnavailable = error.code !== 'ENOENT'; }
  return {
    poll() {
      try {
        if (baselineUnavailable) return { status: 'unavailable', events: [] };
        const resolved = resolveFile();
        if (!resolved) return { status: 'waiting', events: [] };
        if (current !== resolved.file || resolved.size < offset) {
          current = resolved.file; offset = 0; pending = Buffer.alloc(0); droppingLine = false;
        }
        const count = Math.min(MAX_READ, resolved.size - offset);
        if (count <= 0) return { status: 'connected', events: [] };
        const buffer = Buffer.alloc(count);
        const fd = fs.openSync(current, 'r');
        let bytes;
        try { bytes = fs.readSync(fd, buffer, 0, count, offset); } finally { fs.closeSync(fd); }
        offset += bytes;
        pending = Buffer.concat([pending, buffer.subarray(0, bytes)]);
        const events = [];
        let newline;
        while ((newline = pending.indexOf(10)) !== -1) {
          const line = pending.subarray(0, newline); pending = pending.subarray(newline + 1);
          if (droppingLine || line.length > MAX_LINE) { droppingLine = false; continue; }
          try {
            const entry = JSON.parse(line.toString('utf8'));
            const time = Date.parse(entry.timestamp) || Number(entry.message?.timestamp);
            if (!Number.isFinite(time) || time < startTime) continue;
            for (const event of transcriptActivity(entry)) {
              if (seen.has(event.id)) continue;
              seen.add(event.id); events.push(event);
              if (seen.size > 4000) seen.delete(seen.values().next().value);
            }
          } catch { /* Partial/unsupported records do not interrupt the job. */ }
        }
        if (pending.length > MAX_LINE) { pending = Buffer.alloc(0); droppingLine = true; }
        return { status: 'connected', events };
      } catch { return { status: 'unavailable', events: [] }; }
    },
  };
}
