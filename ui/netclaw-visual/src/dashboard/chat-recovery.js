// A composer is never evidence of what was submitted. Native history without
// request IDs may be reconciled only at the recorded position and full prefix.
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value);
const guidance = 'The recovered reply cannot be matched safely to this transcript. Open the owned conversation history; your draft is unchanged.';
export async function recoveryAnchor(messages) {
  const prefix = messages.map(({role,content}) => ({role,content}));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(prefix)));
  return { count: prefix.length, sha256: [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2,'0')).join('') };
}
export const recoveredDraft = (draft, prompt) => draft === prompt ? '' : draft;
export async function mergeRecoveredTurn(messages, data) {
  const requestId = data.requestId, submission = data.submission;
  const prompt = submission?.prompt, anchor = submission?.anchor, answer = data.response || data.output;
  if (!id(requestId) || typeof prompt !== 'string' || !prompt.trim() ||
      typeof answer !== 'string' || !answer.trim() || !Number.isInteger(anchor?.count) || anchor.count < 0 ||
      !/^[a-f0-9]{64}$/.test(anchor?.sha256 || '')) throw Error(guidance);
  const user = {role:'user',content:prompt,requestId}, assistant = {role:'assistant',content:answer,requestId};
  const tagged = messages.filter(m => m.requestId === requestId);
  if (tagged.length) {
    if (tagged.length === 2 && tagged[0].role === 'user' && tagged[0].content === prompt &&
        tagged[1].role === 'assistant' && tagged[1].content === answer) return messages;
    throw Error(guidance);
  }
  if (messages.length < anchor.count || (await recoveryAnchor(messages.slice(0,anchor.count))).sha256 !== anchor.sha256) throw Error(guidance);
  if (messages.length === anchor.count) return [...messages,user,assistant];
  const original = messages[anchor.count], reply = messages[anchor.count+1];
  if (original.requestId || original.role !== 'user' || original.content !== prompt) throw Error(guidance);
  if (messages.length === anchor.count+1) return [...messages.slice(0,anchor.count),user,assistant];
  if (reply.requestId || reply.role !== 'assistant' || reply.content !== answer) throw Error(guidance);
  return [...messages.slice(0,anchor.count),user,assistant,...messages.slice(anchor.count+2)];
}
