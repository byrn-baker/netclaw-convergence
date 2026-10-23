// The API origin and allowed operations are code-owned, never caller-controlled.
export const PAL_TOOL_NAME = 'netclaw_pal_query';
export const PAL_TOOL = {
  name: PAL_TOOL_NAME,
  description: 'Ask the local NetClaw companion for help. Device actions and configuration are unavailable. Results may require local review before speech.',
  trigger_type: 'in_call', origin: 'llm',
  parameters: { type: 'object', additionalProperties: false, properties: { question: { type: 'string', maxLength: 1000 } }, required: ['question'] },
  on_call: 'static_filler', static_filler: 'I will check with your local NetClaw.',
  on_resolve: 'response_in_result', delivery: { app_message: true },
};
export function palDefinition(faceId) {
  return {
    pal_name: 'NetClaw Pal', default_face_id: faceId, pipeline_mode: 'full',
    system_prompt: 'You are NetClaw Pal, a voice interface to the local NetClaw companion. Call netclaw_pal_query for questions. Never claim to have observed or changed a device. Requests cannot approve changes. If a result says to review the local panel, say exactly that and wait. Do not invent results. Use short, clear sentences. Do not ask for credentials or private configurations.',
    layers: { llm: { speculative_inference: false }, perception: { perception_model: 'off' } },
  };
}
export class PalError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
export function tavusClient({ key, fetchImpl = fetch }) {
  async function request(method, route, body) {
    if (!key || !/^\/v2\/[a-z0-9_/?=&-]+$/i.test(route)) throw new PalError('Tavus is not configured.', 503);
    let response;
    try {
      response = await fetchImpl('https://tavusapi.com' + route, {
        method, redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new PalError('Tavus request could not be confirmed. Reconcile before retrying.', 503); }
    // Never echo provider bodies, headers, tokens or internal URLs in errors.
    if (!response.ok) throw new PalError(`Tavus rejected the request (HTTP ${response.status}). No upgrade was attempted.`, 503);
    const text = await response.text();
    if (text.length > 2_000_000) throw new PalError('Tavus response is too large.', 503);
    try { return text ? JSON.parse(text) : {}; } catch { throw new PalError('Tavus returned an invalid response.', 503); }
  }
  return {
    async faces() {
      const result = await request('GET', '/v2/faces?face_type=system&verbose=true&limit=100');
      return (Array.isArray(result.data) ? result.data : []).filter(f => id(f.face_id) && f.status === 'completed')
        .map(f => ({ id: f.face_id, name: String(f.face_name || 'Stock face').slice(0,100), model: String(f.model_name || '') }));
    },
    async validate(palId, faceId) {
      if (!id(palId) || !id(faceId)) throw new PalError('Configure a NetClaw PAL and eligible stock face.', 503);
      const pal = await request('GET', `/v2/pals/${palId}`);
      const attached = await request('GET', `/v2/pals/${palId}/tools`);
      const tools = attached.data || attached.tools;
      if (pal.pipeline_mode !== 'full' || pal.layers?.llm?.speculative_inference !== false ||
          pal.layers?.perception?.perception_model !== 'off' || pal.layers?.mcp?.connectors?.length ||
          pal.layers?.llm?.tools?.length || pal.layers?.llm?.base_url || pal.document_ids?.length || pal.document_tags?.length ||
          pal.memory_stores?.length || pal.memory_store_id ||
          !Array.isArray(tools) || tools.length !== 1 || tools[0].name !== PAL_TOOL_NAME ||
          tools[0].on_resolve !== 'response_in_result' || tools[0].delivery?.app_message !== true || tools[0].delivery?.api) {
        throw new PalError('PAL configuration does not match the restricted NetClaw profile.', 503);
      }
      if (!(await this.faces()).some(f => f.id === faceId)) throw new PalError('Choose an available stock face.', 400);
      return true;
    },
    async create({ palId, faceId, name, duration }) {
      return request('POST', '/v2/conversations', {
        pal_id: palId, face_id: faceId, conversation_name: name,
        require_auth: true,
        properties: { max_call_duration: duration, participant_absent_timeout: 30, participant_left_timeout: 0, enable_recording: false },
      });
    },
    async end(conversationId) {
      if (!id(conversationId)) throw new PalError('Invalid conversation.', 400);
      await request('POST', `/v2/conversations/${conversationId}/end`);
      const result = await request('GET', `/v2/conversations/${conversationId}`);
      if (result.status !== 'ended') throw new PalError('Conversation end is not confirmed.', 503);
    },
    async conversations() { return request('GET', '/v2/conversations?limit=100'); },
    async provision(faceId) {
      if (!(await this.faces()).some(f => f.id === faceId)) throw new PalError('Choose an available stock face.', 400);
      // Deliberately no automatic retry: lost responses require inventory reconciliation.
      const tool = await request('POST', '/v2/tools', PAL_TOOL);
      if (!id(tool.tool_id)) throw new PalError('Tool creation could not be confirmed.', 503);
      const pal = await request('POST', '/v2/pals', palDefinition(faceId));
      if (!id(pal.pal_id)) throw new PalError('PAL creation could not be confirmed.', 503);
      await request('POST', `/v2/pals/${pal.pal_id}/tools`, { tool_ids: [tool.tool_id] });
      return { palId: pal.pal_id, toolId: tool.tool_id, faceId };
    },
  };
}
