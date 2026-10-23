import { validateArtifactContent } from './artifact-formats.js';

export function capturedGenieOutput(source) {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  // Command boundaries only; the device data itself is parsed exclusively by Genie.
  const prompt = /^[\w.():/@-]+[#>]\s*(.*)$/;
  let start = -1;
  let command = '';
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(prompt);
    if (match && /^(?:sh(?:ow)?|display)\s+/i.test(match[1])) {
      start = i;
      command = match[1].trim().replace(/^sh\s+/i, 'show ');
    }
  }
  if (start < 0) return { command: '', output: lines.join('\n').trim(), latest: false };
  const end = lines.findIndex((line, i) => i > start && prompt.test(line));
  return { command, output: lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim(), latest: true };
}

export function genieArtifact(response, device = 'terminal') {
  if (response?.parser !== 'Genie / pyATS' || !response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
    throw new Error('Genie returned an invalid structured response. Preview withheld.');
  }
  const content = `${JSON.stringify(response.data, null, 2)}\n`;
  const validation = validateArtifactContent(content, 'json');
  if (validation.status !== 'valid') throw new Error('Invalid JSON. Preview withheld.');
  if (content.length > 1_000_000) throw new Error('Parsed JSON is too large to store as a Result. Select a smaller command response.');
  return {
    format: 'json', label: 'JSON', extension: 'json', mime: 'application/json',
    name: `${String(device).replace(/[^\w.-]+/g, '-').slice(0, 80) || 'terminal'}-genie.json`,
    content, validation, bytes: new TextEncoder().encode(content).byteLength,
    records: Object.keys(response.data).length, structure: 'native',
    parser: response.parser, parserVersion: response.version,
    command: response.command, os: response.os,
  };
}
