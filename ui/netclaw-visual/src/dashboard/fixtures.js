// Synthetic data is opt-in in the offline preview only, never a live fallback.
export function previewSources(now = new Date().toISOString()) {
  const integrationNames = ['pyATS', 'NetBox', 'Jev', 'GAIT', 'RAG', 'Zoom', 'Telemetry', 'ServiceNow', 'Memory', 'GCF', 'Topolograph', 'DefenseClaw'];
  const graph = { identity: { name: 'NetClaw' }, generatedAt: now,
    integrations: integrationNames.map((name, i) => ({ id: name.toLowerCase(), name, category: ['Device Automation', 'Knowledge', 'Operations'][i % 3], description: `Synthetic ${name} capability for preview.`, skillCount: 3 })),
    skills: integrationNames.map(name => ({ id: name.toLowerCase() + '-review', name: name + ' review', integrationId: name.toLowerCase(), description: 'Review available evidence in scope.' })),
    devices: [{ id: 'demo-core', name: 'Demo core', os: 'iosxe', type: 'router' }, { id: 'demo-edge', name: 'Demo edge', os: 'junos', type: 'router' }],
    settings: [{ label: 'Preview', value: 'Synthetic data · no live operations' }] };
  const n2n = { available: true, generatedAt: now, identity: 'demo-border', risk: { role: 'border', name: 'Demonstration Risk' },
    members: [
      { member_id: 'demo/network', display_name: 'Network Claw', status: 'ready', last_seen: now, capabilities: ['routing', 'interfaces', 'topology'], inventory: { source:'Synthetic member report', received_at:now, llm:{primary_model:'example/network-model'}, mcp_servers:[{name:'pyats-mcp',tools:['pyats_list_devices','pyats_run_show_command']},{name:'memory-mcp',tools:[]}] } },
      { member_id: 'demo/security', display_name: 'Security Claw', status: 'unreachable', last_seen: new Date(Date.parse(now) - 480000).toISOString(), capabilities: ['posture', 'vulnerabilities'] },
      { member_id: 'demo/knowledge', display_name: 'Knowledge Claw', status: 'ready', last_seen: now, capabilities: ['rag', 'memory'] },
      { member_id: 'demo/phone', display_name: 'Field iPhone', node_type: 'edge', status: 'connected', last_seen: now, capabilities: ['camera.capture', 'audio.record'] },
    ], peers: [{ identity: 'external:demo-lab', display_name: 'Lab neighbour', state: 'federated', channel_state: 'live', last_seen: now, capabilities: ['lab-analysis'], inventory:{ received_at:now, inventory:{llm:{primary_model:'example/lab-model',guarded:true},mcp_servers:[{name:'cml-mcp',tools:['list_labs']}]}} }],
    advisors: [{ advisor_id: 'jev-science-officer', display_name: 'Jev · Science Officer', status: 'configured', model: 'Synthetic model', updated_at: now, budgets: { daily_used_usd: .014, daily_limit_usd: 5, case_used_usd: .002, case_limit_usd: .25 }, case_scope: 'Synthetic task' }],
    posture: { mode: 'testing', state:'testing', computed_at:Date.parse(now)/1000, controls:[{name:'sandbox',available:false,detail:'Synthetic preview: containment not verified'},{name:'model-guard',available:false,detail:'Synthetic preview: guard not verified'},{name:'audit',available:true,detail:'Synthetic audit example'}], summary: 'Synthetic deployment. No production enforcement claim.' }, approvals: [], gait: [], recentPushes: [] };
  return Object.fromEntries(Object.entries({ graph, n2n, security:{labMode:true,riskMode:'testing',strictAll:false,defenseMode:'hobby',guardMode:'observe',guardPort:4000,source:'Synthetic configuration'}, runtime:{available:true,source:'Synthetic runtime configuration',llm:{primary_model:'example/border-model'},mcp_servers:[{name:'rag-mcp',tools:['rag_search','rag_list']}]}, gateway: { online: true, reachable: true }, budget: { sessionCostUsd: .08, sessionBudgetUsd: 5, status: 'ok' }, bgp: { available: false } })
    .map(([key, payload]) => [key, { payload, state: payload.available === false ? 'unavailable' : 'available', retrievedAt: now, lastSuccess: now }]));
}
export const previewAssessment = {
  assessment_id: 'synthetic-original', status: 'ok', purpose: 'diagnostic_advice', model: 'Synthetic model', provider: 'Preview only', created_at: '2026-09-28T12:00:00Z',
  questions: {
    adjacency: { type: 'noul', instructions: 'Does the supplied adjacency evidence support an area mismatch?', criteria: { true: 'Area mismatch supported', false: 'Not supported by this evidence' } },
    next: { type: 'choice', instructions: 'Which read would best distinguish the competing explanations?', criteria: { interfaces: 'Inspect interface area and timers', logs: 'Review recent link events', uncertain: 'Insufficient evidence' } },
    completeness: { type: 'score', instructions: 'How complete is the diagnostic evidence?', criteria: ['Insufficient', 'Partial', 'Adequate', 'Comprehensive'] },
  }, answers: { adjacency: { type: 'noul', noul: .72 }, next: { type: 'choice', choice: 'interfaces', confidence: .81, probabilities: { interfaces: .81, logs: .12, uncertain: .07 } }, completeness: { type: 'score', score: 1.4, confidence: .68, probabilities: { 0: .1, 1: .5, 2: .3, 3: .1 } } },
  evidence_metadata: [{ source: 'Synthetic interface observations', observed_at: '2026-09-28T11:59:00Z' }], cost_usd: .0002,
  influence: { status: 'challenged', explanation: 'Synthetic Border interpretation: inspect both interfaces before accepting the area-mismatch hypothesis.' },
};
