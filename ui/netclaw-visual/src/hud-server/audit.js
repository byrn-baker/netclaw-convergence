import path from 'node:path';
import { execFile } from 'node:child_process';
import { mcpCommand } from '../security/command.js';
export function assessmentAudit(root) {
  return async ({ taskRef, assessmentId }) => new Promise(resolve => {
    const safe = [taskRef, assessmentId].every(v => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(v));
    if (!safe) return resolve({ status: 'unavailable' });
    execFile('python3', [path.join(root,'scripts/mcp-call.py'),mcpCommand(['python3','-u',path.join(root,'scripts/gait-stdio.py')]),'gait_record_turn',JSON.stringify({ user_text: 'Authorized HUD assessment read', assistant_text: `Read assessment ${assessmentId} in HUD task ${taskRef}. Read-only; no provider inference. Evidence contents omitted.` })], { cwd: root, timeout: 5000, maxBuffer: 65536 }, (error, stdout) => {
      try { if (error) throw Error(); const result = JSON.parse(stdout); const value=result.structuredContent?.result || JSON.parse(result.content[0].text); if (result.isError || !value.ok) throw Error(); resolve({ status: 'recorded', commit: value.commit }); }
      catch { resolve({ status: 'unavailable' }); }
    });
  });
}
